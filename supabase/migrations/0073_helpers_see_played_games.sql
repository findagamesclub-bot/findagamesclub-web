-- 0073 · A helper could not see the games they are there to rule on
--
-- 0069 gave helpers results.manage, so record_booking_result and the score
-- queue accept them. 0070 then wrote the read policy around two sets: clubs
-- you manage, which is owner and manager only, and clubs you are a member of,
-- which is capped at today's date so a member cannot read the whole history of
-- a club they joined last week.
--
-- A helper is in neither. They fell to the member arm and saw only nights that
-- have not happened yet, which is every game except the ones needing a score.
-- Their console showed one game where the owner's showed eight, and the Scores
-- card said "all ruled" because there was nothing left it could see.
--
-- The fix is a third set: everybody on the team, whatever their role. It is
-- still the set form, so it costs one hashed probe per row rather than a
-- function call.

create or replace function public.my_team_club_ids()
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select c.id from public.clubs c where public.is_admin()
  union
  select t.club_id from public.club_team t where t.profile_id = (select auth.uid());
$$;

revoke all on function public.my_team_club_ids() from public, anon;
grant execute on function public.my_team_club_ids() to authenticated;

drop policy if exists club_bookings_select on public.club_bookings;
create policy club_bookings_select
  on public.club_bookings for select to authenticated
  using (
    booked_by = (select auth.uid())
    or opponent_profile_id = (select auth.uid())
    or accepted_by = (select auth.uid())
    -- Anybody running the club, helpers included: the night is their job and
    -- half of it is what happened last week.
    or club_id in (select public.my_team_club_ids())
    -- An ordinary member sees the diary, not the archive.
    or (club_id in (select public.my_member_club_ids())
        and session_date >= public.london_today())
  );

-- The same split applies to the waiting list: a helper handing out a spare
-- table needs to see who asked for one, and 0014 gated that on can_manage_club
-- before helpers existed.
drop policy if exists club_booking_waitlist_select on public.club_booking_waitlist;
create policy club_booking_waitlist_select
  on public.club_booking_waitlist for select to authenticated
  using (
    requested_by = (select auth.uid())
    or club_id in (select public.my_team_club_ids())
    or (club_id in (select public.my_member_club_ids())
        and session_date >= public.london_today())
  );
