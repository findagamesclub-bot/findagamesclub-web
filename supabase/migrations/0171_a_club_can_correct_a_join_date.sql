-- 0171 · The club says when somebody actually joined
--
-- The client's words: "we need to allow a club owner to edit a members join
-- date that is stored. When a club first creates a listing, they could have
-- members that have been with the club years but would show as a new member on
-- the site."
--
-- `club_memberships.joined_at` has been in the owner's column grant since
-- 0012 and `club_memberships_manage` has let a manager write it ever since.
-- Nothing in the app has ever set it except `approve`, which stamps today.
-- So a club that has been running for ten years lists itself, approves forty
-- people who have been coming since 2015, and every one of them reads as
-- having joined this morning. Sixth time this shape has come up: a capability
-- with no control on it.
--
-- It is a definer function rather than an ordinary update for one reason: the
-- year badges have to follow. 0162 awards them from the join date, so a
-- correction that does not re-award leaves the roster saying "9 YRS" beside a
-- member with no year badge until the nightly job catches up, and the owner
-- who just pressed Save has no way to know it is coming.
--
-- Checked on a throwaway Postgres built from every migration: a club can set
-- it, a stranger cannot, a date in the future is refused, backdating past a
-- band awards that badge on the spot, and the award is silent.

-- `create or replace` cannot add a parameter, and a default makes a NEW
-- function rather than replacing the old one, which is 0136's lesson and
-- 0165's. The no-argument call the cron job makes still resolves afterwards.
drop function if exists public.award_due_tenure_badges();

/**
 * Award every band a member has reached and has not been given.
 *
 * 0162's function with one argument added, rather than a second copy scoped to
 * one membership: two implementations of "which band has this person reached"
 * would drift, and the one that drifted would be the one an owner watched
 * fail to fire.
 *
 * Null is every approved membership, which is what the nightly job passes.
 */
create or replace function public.award_due_tenure_badges(
  p_membership bigint default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_made integer;
begin
  insert into public.member_badges (club_id, badge_id, profile_id, note, awarded_by)
  select m.club_id, due.id, m.profile_id, '', null
    from public.club_memberships m
    join lateral (
      select b.id
        from public.club_badges b
       where b.club_id = m.club_id
         and b.active
         and b.tenure_years is not null
         and b.tenure_years <= floor(extract(year from age(
               public.london_today(),
               coalesce(m.joined_at, m.created_at)::date)))
       order by b.tenure_years desc
       limit 1
    ) due on true
   where m.status = 'approved'
     and (p_membership is null or m.id = p_membership)
     and coalesce(m.joined_at, m.created_at) is not null
     -- Against every award, revoked or not: `member_badges_one_live` covers
     -- only live rows, so without this a badge an owner took off by hand would
     -- come back on the next run.
     and not exists (
       select 1 from public.member_badges held
        where held.badge_id = due.id and held.profile_id = m.profile_id)
  on conflict do nothing;

  get diagnostics v_made = row_count;
  return v_made;
end $$;

/**
 * Put a membership's join date right.
 *
 * Definer so the re-award happens in the same statement, and guarded on
 * `members.manage`, which is the capability that already covers approving
 * somebody and moving their tier. `is_admin` as well, because `club_can` is
 * false for a site admin holding no team row.
 *
 * The award is **quiet**. 0124 tells a member every time a badge lands, which
 * is right when a club recognises something and wrong here: this is
 * bookkeeping, and a club fixing forty dates on the day it lists would send
 * forty "you have been given a badge" notices for a correction nobody did.
 * Same switch 0162's own backfill uses, for the same reason. The badge still
 * appears on their profile.
 *
 * Nothing is taken away when the date moves the other way. A member who holds
 * "Member for 5 years" keeps it when a club corrects the date to last year,
 * because 0162 never revokes automatically and an owner can take it off from
 * the badges page. The screen says so rather than leaving it to be found.
 */
create or replace function public.set_membership_joined_at(
  p_membership bigint, p_joined date)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare v_club bigint;
begin
  if p_joined is null then
    raise exception 'JOINED_REQUIRED';
  end if;
  -- A club day, never the session's: `london_today` is the rule everywhere
  -- else and a bare `current_date` reads in whatever zone the session is in.
  if p_joined > public.london_today() then
    raise exception 'JOINED_IN_FUTURE';
  end if;
  -- Catches a mistyped year rather than any real club. The oldest wargaming
  -- clubs in the country are post-war.
  if p_joined < date '1900-01-01' then
    raise exception 'JOINED_TOO_OLD';
  end if;

  select club_id into v_club from public.club_memberships where id = p_membership;
  if v_club is null then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;

  if not (public.club_can(v_club, 'members.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  update public.club_memberships
     set joined_at = p_joined, updated_at = now()
   where id = p_membership;

  perform set_config('app.badge_notify_quiet', 'on', true);
  perform public.award_due_tenure_badges(p_membership);
  perform set_config('app.badge_notify_quiet', 'off', true);

  return p_joined;
end $$;

revoke all on function public.award_due_tenure_badges(bigint)
  from public, anon, authenticated;
revoke all on function public.set_membership_joined_at(bigint, date) from public, anon;
grant execute on function public.set_membership_joined_at(bigint, date) to authenticated;
