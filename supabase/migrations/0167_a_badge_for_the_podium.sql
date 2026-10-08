-- 0167 · First, second and third, given automatically
--
-- The client's words: "Badges, when a member is added as either 1st, 2nd or
-- 3rd placing for an event or a competition/league, a badge should be auto
-- created and assigned for them. Any achievements like this should be visible
-- on their profile member page automatically."
--
-- An event podium had no badge at all. A competition podium had one, but a
-- derived one: `competition-badges.ts` reads standings and paints "League
-- Champion" with no row behind it, so an owner cannot rename it, retire it,
-- see it in their own list or hand it to somebody the table does not know
-- about. That is 0162's argument word for word, and the client has now asked
-- for the same thing here.
--
-- So the podium becomes three ordinary `club_badges` rows per club, seeded the
-- way the tenure bands are, and `competition-badges.ts` stops deriving the two
-- it covers. Two badges for one finish, side by side on the same profile, is
-- the one-tag-one-vocabulary rule being broken in the most visible place there
-- is.
--
-- One badge per rank per club, not one per finish. Somebody who wins twice
-- holds "First place" once, which is what `member_badges_one_live` has always
-- said and what a tenure badge already does. Where they won is a different
-- question and the profile already answers it: the Competitions and Podium
-- panels list every finish with its event and its season. The badge is the
-- summary, those are the detail, and the note on the first award names the one
-- that earned it.
--
-- Nothing is ever taken back automatically. For tenure that was a judgement;
-- here it is forced, because one badge can stand for several finishes and a
-- single correction cannot know whether any are left. An owner can still take
-- it off by hand, and 0126 tells the member when they do.
--
-- Checked on a throwaway Postgres built from every migration: a first place at
-- an event awards on the spot, a league awards nothing while it is running and
-- all three the moment it is completed, a second finish adds no second badge,
-- a member who is not in the club still gets theirs, and an owner's revoke is
-- not undone by the next placing.

alter table public.club_badges
  add column if not exists podium_rank smallint
    check (podium_rank is null or podium_rank between 1 and 3);

-- One badge per place per club, for the reason 0162 gives about two "after 5
-- years" rows: two "First place" badges is no way to say which is meant.
create unique index if not exists club_badges_one_podium
  on public.club_badges (club_id, podium_rank) where podium_rank is not null;

grant update (podium_rank) on public.club_badges to authenticated;

/**
 * The three a club starts with.
 *
 * First takes the `champion` tone, which `CLUB_TONES` deliberately withholds
 * from the picker because 0121 says a club should not be able to hand out
 * something that reads as "won the league". Nobody chooses this one, so that
 * reservation is exactly what makes it right here. Second and third share
 * `podium`, which is the tone the derived badge they replace already used.
 */
create or replace function public.podium_badge_bands()
returns table (place integer, label text, description text, icon text, tone text)
language sql immutable as $$
  values
    (1, 'First place',  'Given automatically for winning an event or a league.',           'trophy', 'champion'),
    (2, 'Second place', 'Given automatically for finishing second at an event or league.', 'medal',  'podium'),
    (3, 'Third place',  'Given automatically for finishing third at an event or league.',  'medal',  'podium')
$$;

create or replace function public.seed_podium_badges(p_club bigint)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_made integer;
begin
  insert into public.club_badges (club_id, label, description, icon, tone, podium_rank)
  select p_club, b.label, b.description, b.icon, b.tone, b.place
    from public.podium_badge_bands() b
  on conflict do nothing;

  get diagnostics v_made = row_count;
  return v_made;
end $$;

-- A club made from now on gets them without anybody remembering to ask. Its
-- own trigger rather than more of 0162's, so neither can break the other.
create or replace function public.clubs_seed_podium_badges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_podium_badges(new.id);
  return new;
end $$;

drop trigger if exists clubs_seed_podium_badges on public.clubs;
create trigger clubs_seed_podium_badges after insert on public.clubs
  for each row execute function public.clubs_seed_podium_badges();

-- ------------------------------------------------------------- the awarding

/**
 * One door, so the event path and the league path cannot drift.
 *
 * `not exists` against every award, revoked or not, is what makes an owner's
 * revoke stick: `member_badges_one_live` only covers live rows, so without it
 * the next placing would hand back a badge they had deliberately taken off.
 *
 * The holder does not have to be a member. A club running an open tournament
 * puts somebody on the podium who has never joined, and refusing them the
 * badge would be the club's own results page disagreeing with its badges.
 */
create or replace function public.award_podium_badge(
  p_club bigint, p_profile uuid, p_place integer, p_note text default '')
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_badge bigint;
begin
  if p_profile is null or p_place is null or p_place not between 1 and 3 then
    return false;
  end if;

  select id into v_badge from public.club_badges
   where club_id = p_club and podium_rank = p_place and active;
  if v_badge is null then
    -- The club retired it, or this runs before the seed on a club made by
    -- hand. Either way there is nothing to give and that is not an error.
    return false;
  end if;

  insert into public.member_badges (club_id, badge_id, profile_id, note, awarded_by)
  select p_club, v_badge, p_profile, left(coalesce(p_note, ''), 200), null
   where not exists (
     select 1 from public.member_badges held
      where held.badge_id = v_badge and held.profile_id = p_profile)
  on conflict do nothing;

  return found;
end $$;

/**
 * An event placing, the moment the club types it.
 *
 * A placing is only entered after the event has run, so recording one is the
 * deliberate moment and there is nothing to wait for.
 */
create or replace function public.event_placing_badge() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_club bigint; v_title text;
begin
  if new.member_profile_id is null or coalesce(new.rank, 0) not between 1 and 3 then
    return new;
  end if;

  select e.club_id, e.title into v_club, v_title
    from public.club_events e where e.id = new.event_id;
  if v_club is null then return new; end if;

  perform public.award_podium_badge(
    v_club, new.member_profile_id, new.rank::integer,
    coalesce(nullif(btrim(new.placement), ''), 'Placed') || ' at ' ||
      coalesce(nullif(btrim(v_title), ''), 'one of our events') || '.');

  return new;
end $$;

drop trigger if exists club_event_results_badge on public.club_event_results;
create trigger club_event_results_badge
  after insert or update of rank, member_profile_id on public.club_event_results
  for each row execute function public.event_placing_badge();

/**
 * A league, and only once it is over.
 *
 * Taking the client's "when a member is added as 1st, 2nd or 3rd" literally
 * would hand the badge to whoever leads in week two, and take nothing back
 * when they slip to fourth. A standings table is a running total until the
 * club says otherwise, which is the same line `competition-badges.ts` already
 * draws between "Champion" and "Current Leader", and what M3-PLAN meant by
 * competition badges persisting when a competition becomes completed.
 *
 * `replaceStandings` deletes and re-inserts every row on each save, so this
 * must not fire on an ordinary edit: a delete would otherwise revoke and the
 * insert re-award, and the member would hear about both every week.
 */
create or replace function public.award_competition_podium(p_competition bigint)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_club bigint; v_title text; v_label text; v_given integer := 0; r record;
begin
  select c.club_id, c.title, c.type_label into v_club, v_title, v_label
    from public.club_competitions c
   where c.id = p_competition and c.status = 'completed';
  if v_club is null then return 0; end if;

  for r in
    select s.profile_id, s.rank from public.club_competition_standings s
     where s.competition_id = p_competition
       and s.profile_id is not null
       and s.rank between 1 and 3
  loop
    if public.award_podium_badge(v_club, r.profile_id, r.rank::integer,
         'Finished ' || r.rank || ' in ' ||
           coalesce(nullif(btrim(v_title), ''), nullif(btrim(v_label), ''), 'a competition') || '.')
    then
      v_given := v_given + 1;
    end if;
  end loop;

  return v_given;
end $$;

create or replace function public.competition_completed_badges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.award_competition_podium(new.id);
  end if;
  return new;
end $$;

drop trigger if exists club_competitions_podium_badge on public.club_competitions;
create trigger club_competitions_podium_badge
  after update of status on public.club_competitions
  for each row execute function public.competition_completed_badges();

/**
 * A table corrected after the competition was closed.
 *
 * On insert only, and only when the competition is already completed, so an
 * ordinary mid-season save reaches nothing.
 */
create or replace function public.standing_podium_badge() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_club bigint; v_title text;
begin
  if new.profile_id is null or coalesce(new.rank, 0) not between 1 and 3 then
    return new;
  end if;

  select c.club_id, c.title into v_club, v_title
    from public.club_competitions c
   where c.id = new.competition_id and c.status = 'completed';
  if v_club is null then return new; end if;

  perform public.award_podium_badge(v_club, new.profile_id, new.rank::integer,
    'Finished ' || new.rank || ' in ' ||
      coalesce(nullif(btrim(v_title), ''), 'a competition') || '.');
  return new;
end $$;

drop trigger if exists club_competition_standings_badge on public.club_competition_standings;
create trigger club_competition_standings_badge
  after insert on public.club_competition_standings
  for each row execute function public.standing_podium_badge();

/**
 * Everything already on a podium, for the backfill.
 *
 * Not scheduled. Both paths above are triggers, so there is nothing that
 * arrives with time the way a tenure band does, and a nightly sweep over every
 * placing in the database would be work that can only ever find nothing.
 */
create or replace function public.award_due_podium_badges()
returns integer
language plpgsql security definer set search_path = public as $$
declare v_given integer := 0; r record;
begin
  for r in
    select e.club_id, res.member_profile_id as profile_id, res.rank::integer as rank,
           coalesce(nullif(btrim(res.placement), ''), 'Placed') || ' at ' ||
             coalesce(nullif(btrim(e.title), ''), 'one of our events') || '.' as note
      from public.club_event_results res
      join public.club_events e on e.id = res.event_id
     where res.member_profile_id is not null and res.rank between 1 and 3
    union all
    select c.club_id, s.profile_id, s.rank::integer,
           'Finished ' || s.rank || ' in ' ||
             coalesce(nullif(btrim(c.title), ''), 'a competition') || '.'
      from public.club_competition_standings s
      join public.club_competitions c on c.id = s.competition_id
     where s.profile_id is not null and s.rank between 1 and 3
       and c.status = 'completed'
  loop
    if public.award_podium_badge(r.club_id, r.profile_id, r.rank, r.note) then
      v_given := v_given + 1;
    end if;
  end loop;

  return v_given;
end $$;

revoke all on function public.podium_badge_bands() from public, anon;
revoke all on function public.seed_podium_badges(bigint) from public, anon, authenticated;
revoke all on function public.clubs_seed_podium_badges() from public, anon, authenticated;
revoke all on function public.award_podium_badge(bigint, uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.award_competition_podium(bigint) from public, anon, authenticated;
revoke all on function public.competition_completed_badges() from public, anon, authenticated;
revoke all on function public.standing_podium_badge() from public, anon, authenticated;
revoke all on function public.event_placing_badge() from public, anon, authenticated;
revoke all on function public.award_due_podium_badges() from public, anon, authenticated;
grant execute on function public.podium_badge_bands() to authenticated;

-- ------------------------------------------------------------------ the read

-- `create or replace` cannot change a return type, so this drops first. Same
-- reason 0162 had to.
drop function if exists public.club_badges_for(bigint);
create function public.club_badges_for(p_club bigint)
returns table (
  id bigint, label text, description text, icon text, tone text,
  active boolean, awarded bigint, tenure_years integer, podium_rank smallint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_club_member(p_club) or public.can_manage_club(p_club)) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select b.id, b.label, b.description, b.icon, b.tone, b.active,
         (select count(*) from public.member_badges m
           where m.badge_id = b.id and m.revoked_at is null),
         b.tenure_years, b.podium_rank
    from public.club_badges b
   where b.club_id = p_club
   -- The two automatic ladders first and each in its own order, because both
   -- read wrong alphabetically: "10 years" above "2 years", "Third" above
   -- "First".
   order by b.active desc,
            (b.podium_rank is null and b.tenure_years is null),
            b.podium_rank nulls last,
            b.tenure_years nulls last,
            lower(b.label);
end $$;

revoke all on function public.club_badges_for(bigint) from public, anon;
grant execute on function public.club_badges_for(bigint) to authenticated;

-- ----------------------------------------------------------------- backfill

do $$
declare v_club record;
begin
  for v_club in select id from public.clubs loop
    perform public.seed_podium_badges(v_club.id);
  end loop;

  -- Quiet, or everybody who has ever been on a podium hears about it at once
  -- for something that happened seasons ago.
  perform set_config('app.badge_notify_quiet', 'on', true);
  perform public.award_due_podium_badges();
  perform set_config('app.badge_notify_quiet', 'off', true);
end $$;
