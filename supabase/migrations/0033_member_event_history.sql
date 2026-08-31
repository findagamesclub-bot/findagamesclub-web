-- 0033 · A member's event bookings, on their profile
--
-- Legacy shows these to anybody who can see member content at that club:
-- upcoming events booked and previous events attended, with the tickets and
-- the total paid (_list_member_event_bookings_for_club, club_store.py:10513).
--
-- Matched here, with one thing left out. Legacy publishes what somebody paid
-- to every member of their club; no other member needs that, and it is the
-- one field on the row that could embarrass. Everything else is already
-- effectively known at a club: who turned up to what.
--
-- A function rather than widening club_event_bookings_select, so the policy
-- stays "yours and the club's" and this returns curated columns instead of
-- rows somebody could then read the money off.

create or replace function public.member_event_history(p_member uuid)
returns table (
  booking_id bigint,
  club_slug text,
  club_name text,
  event_legacy_id text,
  event_title text,
  start_date date,
  start_time text,
  tickets integer,
  is_past boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    c.slug,
    c.name,
    e.legacy_id,
    e.title,
    e.start_date,
    e.start_time,
    coalesce(sum(i.quantity), 0)::integer,
    coalesce(e.end_date, e.start_date) < public.london_today()
  from public.club_event_bookings b
  join public.club_events e on e.id = b.event_id
  join public.clubs c on c.id = b.club_id
  left join public.club_event_booking_items i on i.booking_id = b.id
  where b.profile_id = p_member
    and b.status <> 'cancelled'
    -- Both of them approved at that club, which is legacy's member-content
    -- rule. A club they do not share stays invisible either way.
    and exists (
      select 1 from public.club_memberships m
       where m.club_id = b.club_id and m.profile_id = p_member
         and m.status = 'approved'
    )
    and (
      p_member = auth.uid()
      or public.can_manage_club(b.club_id)
      or exists (
        select 1 from public.club_memberships v
         where v.club_id = b.club_id and v.profile_id = auth.uid()
           and v.status = 'approved'
      )
    )
  group by b.id, c.slug, c.name, e.legacy_id, e.title, e.start_date, e.start_time, e.end_date
  -- What is coming first, then what they went to, most recent first.
  order by (coalesce(e.end_date, e.start_date) < public.london_today()),
           case when coalesce(e.end_date, e.start_date) < public.london_today()
                then null else e.start_date end asc,
           e.start_date desc;
$$;

revoke all on function public.member_event_history(uuid) from public, anon;
grant execute on function public.member_event_history(uuid) to authenticated;
