/**
 * 0121 · Badges a club hands out itself
 *
 * The client asked for two kinds and legacy only has one:
 *
 *   "Members should be assigned badges for set things like member for 1 year,
 *    2 years etc but also owner can add badges for other things like
 *    tournaments win, competitions win etc"
 *
 * The first half is derived and stays derived. Competition badges come from
 * standings (`competition-badges.ts`, legacy's rules at club_store.py:22907)
 * and tenure comes from the join date (`tenure-badges.ts`, legacy at 22992).
 * Neither needs a row: a badge computed from data already in the database is a
 * badge a row could only let drift, and M3-PLAN's idea of persisting them was
 * to feed an activity-feed kind that does not exist.
 *
 * The second half cannot be derived from anything, so it is these two tables.
 *
 * Icons and tones are closed sets checked here as well as in
 * `src/utils/badge-style.ts`, because an icon name the front end does not know
 * renders nothing at all. The two lists are the same list twice and the TS test
 * asserts against a copy of these constraints.
 *
 * Behaviour-tested on scripts/pg-harness.sh, which builds from every migration.
 */

-- ------------------------------------------------------------------ tables

create table public.club_badges (
  id          bigint generated always as identity primary key,
  club_id     bigint not null references public.clubs (id) on delete cascade,
  label       text not null,
  description text not null default '',
  icon        text not null default 'star',
  tone        text not null default 'club',
  -- Retired rather than deleted: a badge somebody has been awarded cannot be
  -- taken off their profile by the club tidying up its own list.
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint club_badges_label_len check (char_length(btrim(label)) between 1 and 40),
  constraint club_badges_description_len check (char_length(description) <= 160),
  constraint club_badges_icon check (icon in
    ('trophy', 'medal', 'shield', 'star', 'brush', 'hammer', 'handshake', 'spark')),
  constraint club_badges_tone check (tone in
    ('champion', 'leader', 'podium', 'streak', 'campaign', 'club', 'service'))
);

-- One badge of a given name per club. Case-insensitive, because "Terrain
-- wizard" and "Terrain Wizard" are the same badge to everybody but Postgres.
create unique index club_badges_one_label
  on public.club_badges (club_id, lower(btrim(label)));

create trigger club_badges_set_updated_at
  before update on public.club_badges
  for each row execute function public.set_updated_at();

create table public.member_badges (
  id         bigint generated always as identity primary key,
  club_id    bigint not null references public.clubs (id) on delete cascade,
  badge_id   bigint not null references public.club_badges (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  note       text not null default '',
  awarded_by uuid references public.profiles (id) on delete set null,
  awarded_at timestamptz not null default now(),
  -- Revoked, not deleted, for the same reason a loyalty cancellation writes its
  -- own row: a record that edits its own history cannot be audited.
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  constraint member_badges_note_len check (char_length(note) <= 200),
  constraint member_badges_revoke_pair
    check ((revoked_at is null) = (revoked_by is null))
);

-- Somebody holds a badge once. Awarding it again after a revoke is allowed,
-- which is what `where revoked_at is null` buys.
create unique index member_badges_one_live
  on public.member_badges (badge_id, profile_id) where revoked_at is null;

create index member_badges_profile_idx
  on public.member_badges (profile_id, club_id) where revoked_at is null;
create index member_badges_club_idx
  on public.member_badges (club_id, awarded_at desc) where revoked_at is null;

-- ------------------------------------------------------------------ grants

-- Supabase grants the whole table to `authenticated` on creation, so this comes
-- first and the column grants after it would otherwise be inert.
revoke insert, update, delete on public.club_badges from authenticated, anon;
revoke insert, update, delete on public.member_badges from authenticated, anon;
grant select on public.club_badges to authenticated;
grant select on public.member_badges to authenticated;

alter table public.club_badges enable row level security;
alter table public.member_badges enable row level security;

-- Readable by anybody who can see the club's roster: its own approved members,
-- its team, and an admin. A badge is a club saying something about one of its
-- own, so it is not public and it is not secret from the club.
create policy club_badges_select on public.club_badges
  for select to authenticated
  using (public.is_club_member(club_id) or public.can_manage_club(club_id));

create policy member_badges_select on public.member_badges
  for select to authenticated
  using (profile_id = (select auth.uid())
         or public.is_club_member(club_id) or public.can_manage_club(club_id));

-- Every write goes through a definer function below. Nothing is granted here,
-- so a hand-rolled PostgREST call has nothing to reach.

do $$
declare v_bad boolean;
begin
  select bool_or(column_name is null) into v_bad from (
    select null::text as column_name from information_schema.role_table_grants
     where table_name in ('club_badges', 'member_badges')
       and grantee = 'authenticated' and privilege_type = 'INSERT'
    union all
    select column_name from information_schema.role_column_grants
     where table_name in ('club_badges', 'member_badges')
       and grantee = 'authenticated' and privilege_type = 'INSERT') g;
  if coalesce(v_bad, false) then
    raise exception 'badge tables still carry a whole-table insert grant';
  end if;
end $$;

-- --------------------------------------------------------------- functions

/**
 * Create or rename a badge.
 *
 * `members.manage`, which is owner and manager but not helper: a badge is the
 * club speaking about somebody, and a helper runs a night.
 */
create or replace function public.save_club_badge(
  p_club bigint, p_badge bigint, p_label text, p_description text,
  p_icon text, p_tone text, p_active boolean default true
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.club_can(p_club, 'members.manage') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if char_length(btrim(coalesce(p_label, ''))) = 0 then
    raise exception 'BADGE_NEEDS_NAME';
  end if;

  if p_badge is null then
    insert into public.club_badges
      (club_id, label, description, icon, tone, active, created_by)
    values (p_club, btrim(p_label), coalesce(p_description, ''),
            coalesce(p_icon, 'star'), coalesce(p_tone, 'club'),
            coalesce(p_active, true), (select auth.uid()))
    returning id into v_id;
    return v_id;
  end if;

  -- Matched on the club as well as the id, so a badge id from another club
  -- cannot be edited by somebody who manages this one.
  update public.club_badges
     set label = btrim(p_label), description = coalesce(p_description, ''),
         icon = coalesce(p_icon, 'star'), tone = coalesce(p_tone, 'club'),
         active = coalesce(p_active, true)
   where id = p_badge and club_id = p_club
  returning id into v_id;

  if v_id is null then raise exception 'BADGE_NOT_FOUND'; end if;
  return v_id;
end $$;

/**
 * Give it to somebody.
 *
 * Refuses anybody who is not an approved member of the club. A club may only
 * say something about its own, and without this an owner could pin a badge to
 * a stranger's profile.
 */
create or replace function public.award_member_badge(
  p_badge bigint, p_profile uuid, p_note text default ''
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_club bigint; v_active boolean; v_id bigint;
begin
  select club_id, active into v_club, v_active
    from public.club_badges where id = p_badge;
  if v_club is null then raise exception 'BADGE_NOT_FOUND'; end if;

  if not public.club_can(v_club, 'members.manage') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if not coalesce(v_active, false) then
    raise exception 'BADGE_RETIRED';
  end if;

  if not exists (select 1 from public.club_memberships
                  where club_id = v_club and profile_id = p_profile
                    and status = 'approved') then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.member_badges (club_id, badge_id, profile_id, note, awarded_by)
  values (v_club, p_badge, p_profile, left(coalesce(p_note, ''), 200), (select auth.uid()))
  -- Awarding one somebody already holds is not an error, it is a no-op: two
  -- managers working the same list should not see a refusal.
  on conflict do nothing
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.revoke_member_badge(p_award bigint)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_club bigint;
begin
  select club_id into v_club from public.member_badges
   where id = p_award and revoked_at is null;
  if v_club is null then raise exception 'AWARD_NOT_FOUND'; end if;

  if not public.club_can(v_club, 'members.manage') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  update public.member_badges
     set revoked_at = now(), revoked_by = (select auth.uid())
   where id = p_award and revoked_at is null;
  return true;
end $$;

/**
 * A club's own badges, with how many hold each.
 *
 * The count rides along rather than being a second query, because the page
 * shows it on every card and a club with twelve badges would otherwise be
 * twelve round trips.
 */
create or replace function public.club_badges_for(p_club bigint)
returns table (
  id bigint, label text, description text, icon text, tone text,
  active boolean, awarded bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_club_member(p_club) or public.can_manage_club(p_club)) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select b.id, b.label, b.description, b.icon, b.tone, b.active,
         (select count(*) from public.member_badges m
           where m.badge_id = b.id and m.revoked_at is null)
    from public.club_badges b
   where b.club_id = p_club
   order by b.active desc, lower(b.label);
end $$;

/** What one member holds at one club. */
create or replace function public.member_badges_for(p_club bigint, p_profile uuid)
returns table (
  id bigint, badge_id bigint, label text, description text,
  icon text, tone text, note text, awarded_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_club_member(p_club) or public.can_manage_club(p_club)
          or p_profile = (select auth.uid())) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select m.id, b.id, b.label, b.description, b.icon, b.tone, m.note, m.awarded_at
    from public.member_badges m
    join public.club_badges b on b.id = m.badge_id
   where m.club_id = p_club and m.profile_id = p_profile and m.revoked_at is null
   order by m.awarded_at desc;
end $$;

/** Everybody holding a badge, for the club's own list. */
create or replace function public.club_badge_awards(p_club bigint, p_badge bigint default null)
returns table (
  id bigint, badge_id bigint, label text, icon text, tone text,
  profile_id uuid, member_name text, note text, awarded_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.club_can(p_club, 'members.manage') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select m.id, b.id, b.label, b.icon, b.tone, m.profile_id,
         coalesce(nullif(btrim(p.full_name), ''), 'No name yet'), m.note, m.awarded_at
    from public.member_badges m
    join public.club_badges b on b.id = m.badge_id
    left join public.profiles p on p.id = m.profile_id
   where m.club_id = p_club and m.revoked_at is null
     and (p_badge is null or m.badge_id = p_badge)
   order by m.awarded_at desc;
end $$;

revoke all on function public.save_club_badge(bigint, bigint, text, text, text, text, boolean)
  from public, anon;
revoke all on function public.award_member_badge(bigint, uuid, text) from public, anon;
revoke all on function public.revoke_member_badge(bigint) from public, anon;
revoke all on function public.club_badges_for(bigint) from public, anon;
revoke all on function public.member_badges_for(bigint, uuid) from public, anon;
revoke all on function public.club_badge_awards(bigint, bigint) from public, anon;

grant execute on function public.save_club_badge(bigint, bigint, text, text, text, text, boolean)
  to authenticated;
grant execute on function public.award_member_badge(bigint, uuid, text) to authenticated;
grant execute on function public.revoke_member_badge(bigint) to authenticated;
grant execute on function public.club_badges_for(bigint) to authenticated;
grant execute on function public.member_badges_for(bigint, uuid) to authenticated;
grant execute on function public.club_badge_awards(bigint, bigint) to authenticated;
