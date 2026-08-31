-- 0034 · How each member is doing, for the opponent finder
--
-- Legacy scores recommendations partly on win rate: two people with similar
-- records make a better game than a whitewash (members.js:232). It works that
-- out in the browser from a payload carrying every member's stats, which is
-- fine at forty members and a lot of rows at a thousand.
--
-- Counted here instead, one row per member who has a scored game.

create or replace function public.club_member_form(p_club bigint)
returns table (
  member_id uuid,
  played integer,
  wins integer,
  draws integer,
  losses integer
)
language sql
stable
security definer
set search_path = public
as $$
  with sides as (
    select b.booked_by as member_id,
           b.booked_by_score as own_score,
           b.opponent_score  as other_score
      from public.club_bookings b
     where b.club_id = p_club
       and b.status = 'booked'
       and b.booked_by_score is not null
       and b.opponent_profile_id is not null
       -- Members only, the same rule as the roster this feeds.
       and (public.is_club_member(p_club) or public.can_manage_club(p_club))
    union all
    select b.opponent_profile_id,
           b.opponent_score,
           b.booked_by_score
      from public.club_bookings b
     where b.club_id = p_club
       and b.status = 'booked'
       and b.booked_by_score is not null
       and b.opponent_profile_id is not null
       and (public.is_club_member(p_club) or public.can_manage_club(p_club))
  )
  select
    s.member_id,
    count(*)::integer,
    count(*) filter (where s.own_score > s.other_score)::integer,
    count(*) filter (where s.own_score = s.other_score)::integer,
    count(*) filter (where s.own_score < s.other_score)::integer
  from sides s
  where s.member_id is not null
  group by s.member_id;
$$;

revoke all on function public.club_member_form(bigint) from public, anon;
grant execute on function public.club_member_form(bigint) to authenticated;
