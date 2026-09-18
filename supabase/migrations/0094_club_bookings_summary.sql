-- 0094 · One round trip for the bookings tab's furniture
--
-- The tab was making nine queries before it drew a single row: five to count
-- the five states, two to list the events for the picker, two more for the
-- events tab's own badge. Measured against the dev project, every query to it
-- costs about 215ms whatever it asks for, so nine of them is two seconds of
-- waiting for numbers that all come off one table.
--
-- The five tallies are the same five groups `utils/door-list.ts` splits a
-- roster into. They are written twice, once there and once here, and they have
-- to stay in step: the tab a row lands in decides which count it is under.

create or replace function public.club_event_bookings_summary(
  p_club bigint, p_event bigint default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.club_can(p_club, 'events.manage') then
    raise exception 'NOT_PERMITTED';
  end if;

  select jsonb_build_object(
    -- The Events tab's own badge, so showing Bookings costs nothing extra.
    'events', (select count(*) from public.club_events e where e.club_id = p_club),

    'counts', (
      select jsonb_build_object(
        'all',       count(*),
        'cancelled', count(*) filter (where b.status = 'cancelled'),
        'paid',      count(*) filter (where b.status <> 'cancelled'
                                        and b.payment_status <> 'unpaid'),
        'checkedin', count(*) filter (where b.status <> 'cancelled'
                                        and b.checked_in_at is not null),
        -- Still to pay: holding a place, nothing recorded, not through the door.
        'reserved',  count(*) filter (where b.status <> 'cancelled'
                                        and b.payment_status = 'unpaid'
                                        and b.checked_in_at is null)
      )
      from public.club_event_bookings b
      where b.club_id = p_club
        and (p_event = 0 or b.event_id = p_event)
    ),

    -- Only events somebody has actually booked. A picker listing ten years of
    -- events, nine of which filter to nothing, is a longer list and a worse one.
    'picker', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title,
                                          'bookings', t.bookings)
                       order by t.start_date desc nulls last)
        from (
          select e.id, e.title, e.start_date, count(b.id) as bookings
            from public.club_events e
            join public.club_event_bookings b on b.event_id = e.id
           where e.club_id = p_club
           group by e.id, e.title, e.start_date
        ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.club_event_bookings_summary(bigint, bigint) from public, anon;
grant execute on function public.club_event_bookings_summary(bigint, bigint) to authenticated;
