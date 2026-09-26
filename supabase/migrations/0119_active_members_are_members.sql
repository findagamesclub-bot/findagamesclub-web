/**
 * 0119 · "Active members 4, 200% of the roster did something"
 *
 * That is what Didcot showed: four active against a roster of two. The tile
 * says ACTIVE MEMBERS and the line under it divides by the roster, so the only
 * number that can go there is members who were active. 0117 counted everybody
 * who did anything, member or not, and a club whose events sell to the public
 * therefore got a percentage above 100 and an "active members" figure larger
 * than its membership.
 *
 * The people it was accidentally counting are worth knowing about, though:
 * somebody who books a table or buys a ticket without joining is exactly who a
 * club wants to convert. So they get a figure of their own rather than being
 * folded into a number that cannot hold them.
 *
 *   activeMembers   on the roster, and did something in the window
 *   activeVisitors  did something in the window, and is not on the roster
 *   activeRate      activeMembers over the roster, so it cannot exceed 100
 *
 * Behaviour-tested on scripts/pg-harness.sh, which carries the real schema:
 * a club with two members and two outsiders reads 2 active, 2 visitors, 100%.
 */

create or replace function public.club_analytics_summary(
  p_club bigint, p_from date, p_to date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.analytics_allowed(p_club);
  return (
  with
  roster as (
    select profile_id from public.club_memberships
     where club_id = p_club and status = 'approved'
  ),
  tables as (
    select booked_by as profile_id from public.club_bookings
     where club_id = p_club and status <> 'cancelled'
       and session_date between p_from and p_to
  ),
  tickets as (
    select profile_id from public.club_event_bookings
     where club_id = p_club and status <> 'cancelled'
       and created_at::date between p_from and p_to
  ),
  posts as (
    select author_profile_id as profile_id from public.club_discussion_posts
     where club_id = p_club and removed_at is null
       and created_at::date between p_from and p_to
  ),
  replies as (
    select r.author_profile_id as profile_id from public.club_discussion_replies r
      join public.club_discussion_posts p on p.id = r.post_id
     where p.club_id = p_club and r.removed_at is null
       and r.created_at::date between p_from and p_to
  ),
  active as (
    select distinct profile_id from (
      select profile_id from tables union all
      select profile_id from tickets union all
      select profile_id from posts   union all
      select profile_id from replies
    ) all_of_it where profile_id is not null
  ),
  -- The split. `in (select ...)` rather than a join, so somebody with two
  -- memberships at the same club cannot be counted twice.
  active_members as (
    select profile_id from active
     where profile_id in (select profile_id from roster)
  ),
  active_visitors as (
    select profile_id from active
     where profile_id not in (select profile_id from roster
                               where profile_id is not null)
  )
  select jsonb_build_object(
    'members',        (select count(*) from roster),
    'newMembers',     (select count(*) from public.club_memberships
                        where club_id = p_club and status = 'approved'
                          and coalesce(joined_at, created_at)::date between p_from and p_to),
    'activeMembers',  (select count(*) from active_members),
    'activeVisitors', (select count(*) from active_visitors),
    'tableBookings',  (select count(*) from tables),
    'eventTickets',   (select count(*) from tickets),
    'posts',          (select count(*) from posts),
    'replies',        (select count(*) from replies),
    -- The rate legacy shows, and the working behind it, because "44%" on its
    -- own invites "out of what". Members over the roster: both sides of the
    -- division are now the same population, which is what makes it a rate.
    'activeRate',     case when (select count(*) from roster) > 0
                        then round((select count(*) from active_members)::numeric
                                   / (select count(*) from roster) * 100, 1)
                        else 0 end
  ));
end $$;

revoke all on function public.club_analytics_summary(bigint, date, date) from public, anon;
grant execute on function public.club_analytics_summary(bigint, date, date) to authenticated;
