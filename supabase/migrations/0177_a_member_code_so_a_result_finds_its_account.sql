/**
 * A member code, so a result can find the right account.
 *
 * The client's words: *"For events, when entering any player names for the
 * event, we ideally want to be able to link them to their specific member
 * profile from whatever clubs they are members of... could we use some sort of
 * unique member ID to do this link? ... I don't think a general member look up
 * will work, due to privacy and the list would potentially be huge if all
 * members of all clubs are looked up. The ID seemed a safe way, as it requires
 * the member to give it if they want to associate their event results to their
 * game history, and awards/badges for their profile."*
 *
 * They are right about all of it. 0032 lets a club say which account a typed
 * name belongs to and refuses anybody who is not an approved member of that
 * club, which is exactly the case this is about: an open tournament at Didcot
 * draws players from four other clubs and not one of them can be linked. So
 * their results reach nobody's profile, their podium finishes hand out no
 * badges, and the Meta Tracker counts a name rather than a person.
 *
 * The code is the consent. Nothing is looked up across clubs and no list of
 * members is ever handed out: a club can only ask about a code somebody chose
 * to give them.
 *
 * **It is not a column on `profiles`.** `profiles_select_authenticated` is
 * `using (true)` (0001), so a column there is readable by every signed-in
 * account on the site, which would turn an opt-in into a directory of every
 * member's code. Its own table with an own-row policy is what makes the
 * opt-in real.
 */

-- ------------------------------------------------------------- the code --

create table if not exists public.member_codes (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  code       citext not null unique,
  created_at timestamptz not null default now(),
  -- When they last asked for a new one. A code read across a hall or pasted
  -- into a group chat is semi-public, so it has to be replaceable.
  rotated_at timestamptz
);

comment on table public.member_codes is
  'One opt-in code per member, given to a club so a typed name can be linked to their account.';

-- `revoke all`, not `revoke insert, update, delete`: Supabase''s whole-table
-- grant also carries TRUNCATE, which ignores row security (0151).
revoke all on public.member_codes from authenticated, anon;
grant select on public.member_codes to authenticated;

alter table public.member_codes enable row level security;

-- Your own and nobody else's. Every other read goes through a definer
-- function that answers one exact code at a time.
drop policy if exists member_codes_select_own on public.member_codes;
create policy member_codes_select_own
  on public.member_codes for select to authenticated
  using ((select auth.uid()) = profile_id);

-- ------------------------------------------------------------- folding --

/**
 * One reading of a code somebody typed.
 *
 * Hyphens are display only, so `K7MP-3QXR`, `k7mp3qxr` and `K7MP 3QXR` are one
 * code. The column is citext, so case is already handled; this is about the
 * separators a person puts in when reading one off a phone.
 */
create or replace function public.fold_member_code(p_code text)
returns text
language sql immutable
set search_path = public
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

/**
 * One reading of a person's name.
 *
 * Used only to decide whether a name on a results sheet is the claimant's own.
 * Deliberately not accent-folding: `unaccent` is not in this schema, and the
 * cost of missing one is that somebody presses a button a club can also press
 * for them, which is the safe direction to fail in.
 */
create or replace function public.fold_person_name(p_name text)
returns text
language sql immutable
set search_path = public
as $$
  select lower(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')))
$$;

-- ---------------------------------------------------------- generating --

/**
 * Eight characters from a 31-letter alphabet, read aloud in two chunks.
 *
 * Twenty-eight characters: the digits, and the consonants other than L. The
 * vowels go because a code is printed on a results sheet and read aloud
 * across a hall, and one that spells a word is an embarrassment nobody can
 * undo. 0, O, 1, I and L go because they are what a person transcribes
 * wrongly, and a mistyped code puts somebody else's win on your profile.
 *
 * Entropy comes from `gen_random_uuid()`, not `random()`, which is seeded per
 * session and predictable. Folding 256 byte values onto 28 letters is very
 * slightly biased towards the first four; at 28^8 that is not worth the
 * rejection loop it would take to remove.
 */
create or replace function public.new_member_code()
returns text
language plpgsql volatile
set search_path = public
as $$
declare
  v_alphabet constant text := '23456789BCDFGHJKMNPQRSTVWXYZ';
  v_code text;
  v_raw  text;
  i int;
begin
  loop
    v_code := '';
    v_raw := replace(gen_random_uuid()::text, '-', '');
    for i in 1..8 loop
      v_code := v_code || substr(
        v_alphabet,
        1 + (('x' || substr(v_raw, i * 2 - 1, 2))::bit(8)::int % 28),
        1);
    end loop;
    exit when not exists (select 1 from public.member_codes where code = v_code);
  end loop;
  return v_code;
end $$;

revoke all on function public.new_member_code() from public, anon, authenticated;

/**
 * The caller's own code, made on the first look.
 *
 * Made on read rather than handed out at sign-up, so the forty thousand
 * accounts that will never go to a tournament never get a row. The re-select
 * after the conflict is for two tabs opening the profile page at once.
 */
create or replace function public.my_member_code()
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_code text;
begin
  if v_me is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;

  select code into v_code from public.member_codes where profile_id = v_me;
  if v_code is not null then return v_code; end if;

  insert into public.member_codes (profile_id, code)
  values (v_me, public.new_member_code())
  on conflict (profile_id) do nothing;

  select code into v_code from public.member_codes where profile_id = v_me;
  return v_code;
end $$;

revoke all on function public.my_member_code() from public, anon;
grant execute on function public.my_member_code() to authenticated;

/**
 * A new code for the caller, retiring the old one.
 *
 * Nothing that was already linked comes apart: a link is a profile id on a
 * row, and the code only ever decided whether the club was allowed to write
 * it. So rotating is free, which is what makes it safe to read one out.
 */
create or replace function public.rotate_member_code()
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_code text;
begin
  if v_me is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;

  v_code := public.new_member_code();

  insert into public.member_codes (profile_id, code, rotated_at)
  values (v_me, v_code, now())
  on conflict (profile_id)
    do update set code = excluded.code, rotated_at = now();

  return v_code;
end $$;

revoke all on function public.rotate_member_code() from public, anon;
grant execute on function public.rotate_member_code() to authenticated;

-- ------------------------------------------------------------- looking up --

/**
 * Who holds this code, asked by somebody running a club.
 *
 * Exact match only, one at a time, and never a list. The guard is the club's
 * own, because the only reason to ask is that you are typing a name into that
 * club's event or results: without it this is an oracle anybody could walk.
 *
 * An unknown code is zero rows rather than a refusal, so the screen can say
 * "no member has that code" without the function deciding how to word it.
 */
create or replace function public.member_by_code(p_club bigint, p_code text)
returns table (profile_id uuid, full_name text)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not (public.club_can(p_club, 'events.manage')
       or public.club_can(p_club, 'members.manage')
       or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- A code eight characters long is the only thing worth asking about, and
  -- refusing the rest keeps a one-character probe out of the table.
  if length(public.fold_member_code(p_code)) <> 8 then
    return;
  end if;

  return query
    select p.id, p.full_name
      from public.member_codes c
      join public.profiles p on p.id = c.profile_id
     where c.code = public.fold_member_code(p_code)
       and p.is_active;
end $$;

revoke all on function public.member_by_code(bigint, text) from public, anon;
grant execute on function public.member_by_code(bigint, text) to authenticated;

-- ------------------------------------------- linking with a code (0032) --

-- A new argument makes a NEW function in Postgres rather than replacing the
-- old one, so both have to be dropped first. Fourth time, after 0136, 0165
-- and 0171.
drop function if exists public.link_standing_member(bigint, uuid);
drop function if exists public.link_event_result_member(bigint, uuid);

/**
 * Whether this club may put this account's name on its own records.
 *
 * Three ways, and they are the three kinds of person on a tournament sheet:
 * one of the club's own members, somebody who bought a ticket to something
 * the club ran, or somebody who gave the club their code.
 *
 * The ticket is in here because it is the same consent said a different way:
 * they signed in, paid this club and turned up, so asking them for a code as
 * well is friction for a link they have already agreed to.
 */
create or replace function public.may_link_profile(
  p_club bigint, p_profile uuid, p_code text
)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
      select 1 from public.club_memberships m
       where m.club_id = p_club and m.profile_id = p_profile
         and m.status = 'approved')
      or exists (
      select 1 from public.club_event_bookings b
       where b.club_id = p_club and b.profile_id = p_profile)
      or (length(public.fold_member_code(p_code)) = 8 and exists (
      select 1 from public.member_codes c
       where c.profile_id = p_profile
         and c.code = public.fold_member_code(p_code)))
$$;

revoke all on function public.may_link_profile(bigint, uuid, text) from public, anon;
grant execute on function public.may_link_profile(bigint, uuid, text) to authenticated;

/**
 * Attach a standing to a member, or detach it by passing null.
 *
 * 0032 admitted an approved member of this club and nobody else, which is
 * right for a club's own league and wrong for the event this item is about.
 * A code the member handed over is the second way in, and it is checked here
 * rather than trusted from the browser: resolving a code to an id on the
 * client and posting the id would let any club manager post any id.
 */
create or replace function public.link_standing_member(
  p_standing bigint,
  p_profile uuid,
  p_code text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  owner_club bigint;
begin
  select c.club_id into owner_club
    from public.club_competition_standings s
    join public.club_competitions c on c.id = s.competition_id
   where s.id = p_standing;

  if owner_club is null then
    raise exception 'No such standing';
  end if;
  if not (public.can_manage_club(owner_club) or public.is_admin()) then
    raise exception 'That is not your club';
  end if;

  if p_profile is not null and not public.may_link_profile(owner_club, p_profile, p_code) then
    raise exception 'MEMBER_CODE_NEEDED';
  end if;

  update public.club_competition_standings
     set profile_id = p_profile
   where id = p_standing;
end $$;

/** The same, for an event's podium. */
create or replace function public.link_event_result_member(
  p_result bigint,
  p_profile uuid,
  p_code text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  owner_club bigint;
begin
  select e.club_id into owner_club
    from public.club_event_results r
    join public.club_events e on e.id = r.event_id
   where r.id = p_result;

  if owner_club is null then
    raise exception 'No such result';
  end if;
  if not (public.can_manage_club(owner_club) or public.is_admin()) then
    raise exception 'That is not your club';
  end if;

  if p_profile is not null and not public.may_link_profile(owner_club, p_profile, p_code) then
    raise exception 'MEMBER_CODE_NEEDED';
  end if;

  update public.club_event_results
     set member_profile_id = p_profile
   where id = p_result;
end $$;

-- Grants go with a dropped function and have to be restated.
revoke all on function public.link_standing_member(bigint, uuid, text) from public, anon;
grant execute on function public.link_standing_member(bigint, uuid, text) to authenticated;
revoke all on function public.link_event_result_member(bigint, uuid, text) from public, anon;
grant execute on function public.link_event_result_member(bigint, uuid, text) to authenticated;

-- ---------------------------------------------------------- that is me --

/**
 * Rows on one event carrying this caller's name and no account.
 *
 * The code answers the door; this answers the morning after. An organiser
 * running fifty people through a hall will not collect fifty codes, so most
 * names are typed and most of them stay unlinked. The person who most wants
 * that fixed is the one whose badge is missing, and they will do it at home.
 *
 * Two things have to be true, and neither is "the club said so": they hold a
 * booking for this event, so they were there, and the name on the row is
 * their own. Matching the name on their own booking as well as their profile
 * name is what covers somebody whose profile says "T. Allen" and whose ticket
 * says "Tom Allen", because the ticket is what the organiser copies.
 */
create or replace function public.claimable_event_names(p_event bigint)
returns integer
language sql stable security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as id
  ), names as (
    select public.fold_person_name(p.full_name) as n
      from public.profiles p, me where p.id = me.id
    union
    select public.fold_person_name(b.full_name)
      from public.club_event_bookings b, me
     where b.event_id = p_event and b.profile_id = me.id
  ), ticket as (
    select 1 from public.club_event_bookings b, me
     where b.event_id = p_event and b.profile_id = me.id
       and b.status <> 'cancelled'
  )
  select case when not exists (select 1 from ticket) then 0 else (
      (select count(*) from public.club_event_results r
        where r.event_id = p_event and r.member_profile_id is null
          and public.fold_person_name(r.member_name) in (select n from names where n <> ''))
    + (select count(*) from public.club_event_pairing_matches m
        where m.event_id = p_event and m.player_one_id is null
          and public.fold_person_name(m.player_one) in (select n from names where n <> ''))
    + (select count(*) from public.club_event_pairing_matches m
        where m.event_id = p_event and m.player_two_id is null
          and public.fold_person_name(m.player_two) in (select n from names where n <> ''))
  )::integer end
$$;

revoke all on function public.claimable_event_names(bigint) from public, anon;
grant execute on function public.claimable_event_names(bigint) to authenticated;

/**
 * Attach every one of them, in one press.
 *
 * All of them rather than one at a time, for the reason `groupUnlinked`
 * already learned on the club's own matching screen: a weekend tournament is
 * five rounds and a placing, and six presses for one obvious answer is how
 * somebody abandons the job half done.
 *
 * The club is told, because this writes to the club's own records and a
 * mis-claim is theirs to undo. Nobody is told when the claimant runs the club
 * themselves, which `notify_person` already handles for the actor's own row
 * and this repeats for the rest of the team.
 */
create or replace function public.claim_event_names(p_event bigint)
returns integer
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_club bigint;
  v_title text;
  v_key text;
  v_name text;
  v_done integer := 0;
  v_hit integer;
  v_person record;
begin
  if v_me is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;

  select e.club_id, e.title, e.legacy_id into v_club, v_title, v_key
    from public.club_events e where e.id = p_event;
  if v_club is null then raise exception 'EVENT_NOT_FOUND'; end if;

  if public.claimable_event_names(p_event) = 0 then
    raise exception 'NOTHING_TO_CLAIM';
  end if;

  select p.full_name into v_name from public.profiles p where p.id = v_me;

  with names as (
    select public.fold_person_name(p.full_name) as n
      from public.profiles p where p.id = v_me
    union
    select public.fold_person_name(b.full_name)
      from public.club_event_bookings b
     where b.event_id = p_event and b.profile_id = v_me
  ), r as (
    update public.club_event_results t set member_profile_id = v_me
     where t.event_id = p_event and t.member_profile_id is null
       and public.fold_person_name(t.member_name) in (select n from names where n <> '')
    returning 1
  ), m1 as (
    update public.club_event_pairing_matches t set player_one_id = v_me
     where t.event_id = p_event and t.player_one_id is null
       and public.fold_person_name(t.player_one) in (select n from names where n <> '')
    returning 1
  ), m2 as (
    update public.club_event_pairing_matches t set player_two_id = v_me
     where t.event_id = p_event and t.player_two_id is null
       and public.fold_person_name(t.player_two) in (select n from names where n <> '')
    returning 1
  )
  select (select count(*) from r) + (select count(*) from m1) + (select count(*) from m2)
    into v_hit;

  v_done := coalesce(v_hit, 0);

  for v_person in
    select t.profile_id from public.club_team t where t.club_id = v_club
  loop
    if v_person.profile_id <> v_me then
      perform public.notify_person(
        v_person.profile_id, 'event-name-claimed',
        coalesce(nullif(btrim(v_name), ''), 'A member') || ' claimed a name on ' || v_title,
        'They hold a ticket for it and the name matched. Open the event if that looks wrong.',
        '/clubs/' || (select c.slug from public.clubs c where c.id = v_club)
          || '/events/' || v_key,
        'club_event', p_event::text);
    end if;
  end loop;

  return v_done;
end $$;

revoke all on function public.claim_event_names(bigint) from public, anon;
grant execute on function public.claim_event_names(bigint) to authenticated;

-- -------------------------------------- the same guard on the other path --

/**
 * A placing takes the same consent the matching screen asks for.
 *
 * `save_event_placing` accepted any `p_profile` at all, so the rule 0032 wrote
 * down lived on one of two paths to the same column: a club could not link a
 * stranger to a podium through the matching screen and could through the
 * placing dialog. That is the sibling-guard shape this codebase has now found
 * four times, and it matters more here, because a podium hands out a badge.
 *
 * Both older signatures go rather than being left as overloads. 0058 made a
 * seven-argument version and 0136 an eight; a third would be two spare ways to
 * call the same function with the guard missing from both.
 */
drop function if exists public.save_event_placing(
  bigint, bigint, integer, text, uuid, text, text);
drop function if exists public.save_event_placing(
  bigint, bigint, integer, text, uuid, text, text, text);

create or replace function public.save_event_placing(
  p_event bigint, p_placing bigint, p_rank integer, p_name text, p_profile uuid,
  p_faction text, p_detachment text, p_disposition text default '',
  p_code text default null
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_club bigint; v_name text := btrim(coalesce(p_name, ''));
  v_army jsonb; v_label text; v_id bigint; v_cat record; v_event record;
begin
  if auth.uid() is null then raise exception 'PLACING_NOT_YOURS'; end if;

  select e.club_id, e.start_date into v_event from public.club_events e where e.id = p_event;
  v_club := v_event.club_id;
  if v_club is null then raise exception 'PLACING_NO_EVENT'; end if;
  if not public.can_manage_club(v_club) then raise exception 'PLACING_NOT_YOURS'; end if;
  if p_rank is null or p_rank < 1 or p_rank > 999 then
    raise exception 'PLACING_RANK_RANGE';
  end if;
  if v_name = '' then raise exception 'PLACING_NAME_MISSING'; end if;

  if p_profile is not null and not public.may_link_profile(v_club, p_profile, p_code) then
    raise exception 'MEMBER_CODE_NEEDED';
  end if;

  -- 1st, 2nd, 3rd, then th. 11th to 13th are the exceptions every naive
  -- version of this gets wrong.
  v_label := p_rank || case
    when p_rank % 100 between 11 and 13 then 'th'
    when p_rank % 10 = 1 then 'st'
    when p_rank % 10 = 2 then 'nd'
    when p_rank % 10 = 3 then 'rd'
    else 'th' end || ' place';

  if p_placing is null then
    v_army := '{}'::jsonb;
  else
    -- Merged, not replaced: a club fixing a spelling must not delete a list
    -- snapshot stage 10 put here.
    select coalesce(r.army, '{}'::jsonb) into v_army
      from public.club_event_results r
     where r.id = p_placing and r.event_id = p_event;
    if v_army is null then raise exception 'PLACING_NOT_FOUND'; end if;
  end if;

  v_army := v_army || jsonb_build_object(
    'factionLabel', nullif(btrim(coalesce(p_faction, '')), ''),
    'detachment',   nullif(btrim(coalesce(p_detachment, '')), ''),
    'disposition',  nullif(btrim(coalesce(p_disposition, '')), ''));

  if p_placing is null then
    insert into public.club_event_results
      (event_id, rank, placement, member_name, member_profile_id, is_member, army)
    values (p_event, p_rank::smallint, v_label, left(v_name, 120), p_profile,
            p_profile is not null, v_army)
    returning id into v_id;
  else
    update public.club_event_results
       set rank = p_rank::smallint, placement = v_label,
           member_name = left(v_name, 120), member_profile_id = p_profile,
           is_member = p_profile is not null, army = v_army
     where id = p_placing and event_id = p_event
    returning id into v_id;
    if v_id is null then raise exception 'PLACING_NOT_FOUND'; end if;
  end if;

  -- And into the one table stage 9 reads. A podium has no scores of its own,
  -- so only the army travels.
  select * into v_cat from public.club_catalogue_version(v_club);
  perform public.put_result_army('event_podium', v_id, 'one', v_club,
    v_event.start_date, p_profile, v_name,
    jsonb_build_object(
      'factionId', lower(btrim(coalesce(p_faction, ''))),
      'factionLabel', btrim(coalesce(p_faction, '')),
      'detachment', btrim(coalesce(p_detachment, '')),
      'disposition', btrim(coalesce(p_disposition, ''))),
    v_cat.edition_id, v_cat.catalogue_version);

  return v_id;
end $$;

-- Grants go with a dropped function and have to be restated.
revoke all on function public.save_event_placing(
  bigint, bigint, integer, text, uuid, text, text, text, text) from public, anon;
grant execute on function public.save_event_placing(
  bigint, bigint, integer, text, uuid, text, text, text, text) to authenticated;
