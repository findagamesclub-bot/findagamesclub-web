-- 0162 · Length-of-membership badges a club starts with, given automatically
--
-- The client's words: "club owners should start with suggested badges for
-- length of membership, and these are applied automatically to members, but
-- can be assigned manually also."
--
-- Stage 7 decided the opposite and said so: "Derived badges stay derived."
-- `tenure-badges.ts` works out 1, 2, 3, 5 and 10 years from the join date and
-- paints the answer, storing nothing. That was the right call for competition
-- badges, which are a reading of standings nobody should be able to edit, and
-- the wrong one here. A derived badge has no definition, so an owner cannot
-- rename it, cannot retire it, cannot see it in their own list, and cannot
-- hand it to somebody whose join date does not tell the whole story. All four
-- are things the client has now asked for.
--
-- So tenure badges become ordinary `club_badges` rows with a `tenure_years` on
-- them. Everything an owner can already do to a badge works on them unchanged;
-- the only extra is that something awards them without being asked.

alter table public.club_badges
  add column if not exists tenure_years integer
    check (tenure_years is null or tenure_years between 1 and 100);

-- One badge per band per club. Two "after 5 years" rows is two awards for one
-- milestone and no way to say which is meant.
create unique index if not exists club_badges_one_tenure
  on public.club_badges (club_id, tenure_years) where tenure_years is not null;

grant update (tenure_years) on public.club_badges to authenticated;

/**
 * The bands a club starts with.
 *
 * Legacy's, unchanged (`_build_membership_tenure_badge`, club_store.py:22992),
 * and the same five `tenure-badges.ts` has been painting since Stage 7, so no
 * club's badges change meaning on the day this runs.
 *
 * One tone for all five, because they are one kind of thing and the number is
 * what differs. `service` and not `podium`: 0121's own comment says a
 * competition tone on a club badge reads as "won the league", and turning up
 * for five years is not winning anything. The icon escalates instead.
 */
create or replace function public.tenure_badge_bands()
returns table (years integer, label text, description text, icon text)
language sql immutable as $$
  values
    (1,  'Member for 1 year',   'Given automatically a year after joining.',   'shield'),
    (2,  'Member for 2 years',  'Given automatically after two years.',        'shield'),
    (3,  'Member for 3 years',  'Given automatically after three years.',      'medal'),
    (5,  'Member for 5 years',  'Given automatically after five years.',       'medal'),
    (10, 'Member for 10 years', 'Given automatically after ten years.',        'trophy')
$$;

/**
 * Give a club the suggested set.
 *
 * `on conflict do nothing` twice over: a club that already has a badge called
 * "Member for 1 year" keeps theirs, and running this again changes nothing.
 * Both unique indexes are doing that work, which is why neither is dropped.
 */
create or replace function public.seed_tenure_badges(p_club bigint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_made integer;
begin
  insert into public.club_badges (club_id, label, description, icon, tone, tenure_years)
  select p_club, b.label, b.description, b.icon, 'service', b.years
    from public.tenure_badge_bands() b
  on conflict do nothing;

  get diagnostics v_made = row_count;
  return v_made;
end $$;

-- A club created from now on gets them without anybody remembering to ask.
create or replace function public.clubs_seed_tenure_badges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_tenure_badges(new.id);
  return new;
end $$;

drop trigger if exists clubs_seed_tenure_badges on public.clubs;
create trigger clubs_seed_tenure_badges after insert on public.clubs
  for each row execute function public.clubs_seed_tenure_badges();

-- ------------------------------------------------------------- the awarding

/**
 * Award every band a member has reached and has not been given.
 *
 * `age()` rather than dividing days: 365 is wrong across a leap year, and
 * somebody who joined on 29 February is not a year older on 28 February.
 * Postgres counts by anniversary and `tenure-badges.ts` already did the same
 * thing by hand, which is why the two agree.
 *
 * Only the highest band they have reached, so a club switching this on does not
 * hand a five-year member four badges at once. Crossing into the next band next
 * year adds that one and leaves the old; nothing is ever taken away, because a
 * revoke is somebody's decision and 0126 tells the member about it.
 *
 * `not exists` against every row, revoked or not, is what makes a revoke stick.
 * The unique index only covers live awards, so without this the next run would
 * hand back a badge an owner had deliberately taken off.
 */
create or replace function public.award_due_tenure_badges()
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
     and coalesce(m.joined_at, m.created_at) is not null
     and not exists (
       select 1 from public.member_badges held
        where held.badge_id = due.id and held.profile_id = m.profile_id)
  on conflict do nothing;

  get diagnostics v_made = row_count;
  return v_made;
end $$;

revoke all on function public.tenure_badge_bands() from public, anon;
revoke all on function public.seed_tenure_badges(bigint) from public, anon, authenticated;
revoke all on function public.award_due_tenure_badges() from public, anon, authenticated;
revoke all on function public.clubs_seed_tenure_badges() from public, anon, authenticated;
grant execute on function public.tenure_badge_bands() to authenticated;

-- ------------------------------------------------- not forty notices at once

/**
 * 0124 tells a member every time a badge lands, which is right for one award
 * and wrong for a backfill that hands out years of history in one statement.
 * Same quiet switch 0092 and 0095 use around their bulk writes.
 */
create or replace function public.member_badge_told() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_label text; v_club text; v_slug text;
begin
  if coalesce(current_setting('app.badge_notify_quiet', true), '') = 'on' then
    return new;
  end if;

  if new.profile_id is not distinct from (select auth.uid()) then
    return new;
  end if;

  select b.label into v_label from public.club_badges b where b.id = new.badge_id;
  select c.name, c.slug::text into v_club, v_slug
    from public.clubs c where c.id = new.club_id;

  perform public.notify_person(
    new.profile_id,
    'badge-awarded',
    coalesce(v_club, 'A club') || ' gave you a badge',
    coalesce(nullif(btrim(new.note), ''), 'You have been given ' || coalesce(v_label, 'a badge') || '.'),
    '/account/profile',
    'member_badge', new.id::text, coalesce(v_label, ''));

  return new;
end $$;

-- ------------------------------------------------------------------ the read

-- `create or replace` cannot change a function's return type, so this drops
-- first. Same reason 0094 had to.
drop function if exists public.club_badges_for(bigint);
create function public.club_badges_for(p_club bigint)
returns table (
  id bigint, label text, description text, icon text, tone text,
  active boolean, awarded bigint, tenure_years integer
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
         b.tenure_years
    from public.club_badges b
   where b.club_id = p_club
   -- Automatic ones first and in order of years, because that is a ladder and
   -- reading it alphabetically puts "10 years" above "2 years".
   order by b.active desc,
            (b.tenure_years is null),
            b.tenure_years,
            lower(b.label);
end $$;

revoke all on function public.club_badges_for(bigint) from public, anon;
grant execute on function public.club_badges_for(bigint) to authenticated;

-- ----------------------------------------------------------------- backfill

do $$
declare v_club record;
begin
  for v_club in select id from public.clubs loop
    perform public.seed_tenure_badges(v_club.id);
  end loop;

  -- Quiet, or every member with a year behind them hears about it at once for
  -- something that happened months ago.
  perform set_config('app.badge_notify_quiet', 'on', true);
  perform public.award_due_tenure_badges();
  perform set_config('app.badge_notify_quiet', 'off', true);
end $$;

-- ------------------------------------------------------------------- daily

-- pg_cron, not a hosted job: it is one statement, it sends no email, and
-- CLAUDE.md draws that line. Early morning, because the only thing that
-- changes overnight is the date.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.unschedule('award-tenure-badges')
      where exists (select 1 from cron.job where jobname = 'award-tenure-badges');
    perform cron.schedule('award-tenure-badges', '20 2 * * *',
      $job$select public.award_due_tenure_badges()$job$);
  end if;
end $$;
