-- 0070 · Making the per-row checks cheap
--
-- can_manage_club() and is_club_member() are security definer, and Postgres
-- does not inline a definer function into a policy. So `using (is_club_member
-- (club_id))` runs the function once per candidate row. On a club page that is
-- a handful of rows and nobody notices. On a roster of twelve hundred, or a
-- season of bookings, it is twelve hundred calls to answer one question that
-- has the same answer every time.
--
-- The fix is the set form Supabase recommends: a subquery with no reference to
-- the outer row is evaluated once and hashed, so each row costs a hash probe.
--
--   using (club_id in (select public.my_member_club_ids()))
--
-- The rewritten policies below say exactly what they said before. Only the
-- shape changed. Each was checked with explain (analyze, buffers) under
-- `set role authenticated` with a member's JWT claim before being shipped.

-- ---------------------------------------------------------------------------
-- 1. The two sets
-- ---------------------------------------------------------------------------

-- Every club the caller runs. An admin runs all of them, which is why this
-- returns the whole table for them rather than an empty set.
create or replace function public.my_managed_club_ids()
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select c.id from public.clubs c where public.is_admin()
  union
  select t.club_id from public.club_team t
   where t.profile_id = (select auth.uid()) and t.role in ('owner', 'manager');
$$;

-- Every club the caller is inside: any team role, or an approved membership.
create or replace function public.my_member_club_ids()
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select c.id from public.clubs c where public.is_admin()
  union
  select t.club_id from public.club_team t where t.profile_id = (select auth.uid())
  union
  select m.club_id from public.club_memberships m
   where m.profile_id = (select auth.uid()) and m.status = 'approved';
$$;

revoke all on function public.my_managed_club_ids() from public, anon;
revoke all on function public.my_member_club_ids() from public, anon;
grant execute on function public.my_managed_club_ids() to authenticated;
grant execute on function public.my_member_club_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The reads that scale with a club's size
-- ---------------------------------------------------------------------------

drop policy if exists club_memberships_select on public.club_memberships;
create policy club_memberships_select
  on public.club_memberships for select to authenticated
  using (
    profile_id = (select auth.uid())
    or club_id in (select public.my_managed_club_ids())
    or (status = 'approved' and club_id in (select public.my_member_club_ids()))
  );

drop policy if exists club_bookings_select on public.club_bookings;
create policy club_bookings_select
  on public.club_bookings for select to authenticated
  using (
    booked_by = (select auth.uid())
    or opponent_profile_id = (select auth.uid())
    or accepted_by = (select auth.uid())
    or club_id in (select public.my_managed_club_ids())
    or (club_id in (select public.my_member_club_ids())
        and session_date >= public.london_today())
  );

drop policy if exists club_booking_participants_select on public.club_booking_participants;
create policy club_booking_participants_select
  on public.club_booking_participants for select to authenticated
  using (profile_id = (select auth.uid()) or club_id in (select public.my_member_club_ids()));

-- ---------------------------------------------------------------------------
-- 3. auth.uid() called per row
-- ---------------------------------------------------------------------------

-- Bare, these are a function call per notification. Wrapped in a subquery the
-- planner lifts them into an InitPlan and calls them once.
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for select to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists notifications_mark_read on public.notifications;
create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Indexes for the lists Stage 1 onwards pages through
-- ---------------------------------------------------------------------------

-- The roster, filtered by tab and ordered newest first.
create index if not exists club_memberships_club_status_idx
  on public.club_memberships (club_id, status, created_at desc);

-- The score queue: games with a score on them, grouped by whether the club has
-- confirmed. Partial, because a club's unscored bookings are the majority and
-- are not what this query asks for.
create index if not exists club_bookings_result_queue_idx
  on public.club_bookings (club_id, result_confirmation)
  where booked_by_score is not null;

create index if not exists club_membership_payments_club_idx
  on public.club_membership_payments (club_id, created_at desc);

create index if not exists club_merchandise_orders_club_idx
  on public.club_merchandise_orders (club_id, status, created_at desc);

create index if not exists club_event_bookings_club_idx
  on public.club_event_bookings (club_id, created_at desc);

-- The admin's club and event tables.
create index if not exists clubs_status_created_idx
  on public.clubs (status, created_at desc);

create index if not exists club_events_when_idx
  on public.club_events (start_date desc, club_id) where start_date is not null;

-- Finding an account by name. pg_trgm is enabled on Supabase by default; the
-- guard keeps this migration applying on a project where it is not.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    create index if not exists profiles_full_name_trgm_idx
      on public.profiles using gin (full_name gin_trgm_ops);
  else
    raise notice 'pg_trgm is not enabled; account name search will fall back to a scan';
  end if;
end;
$$;
