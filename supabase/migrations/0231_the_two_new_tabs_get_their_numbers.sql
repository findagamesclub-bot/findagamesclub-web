-- 0231 · the two new tabs get their numbers
--
-- 0230 gave the event bookings list a Refund due and a Refunded tab, and the
-- tab row drew both with NOTHING beside them. The counts come from
-- `club_event_bookings_summary`, which builds the five it has known about
-- since 0094 and knows nothing of these two, so the board read `undefined`
-- and the house tab bar printed a blank where a number should be.
--
-- Exactly the failure CLAUDE.md already describes: "a failed counts read
-- falls back to zeros rather than undefined, because the house tab bar prints
-- whatever it is given and undefined renders as a blank". The fallback was
-- right; the summary simply did not answer the question. Found by opening the
-- page, not by any check: tsc, lint and all six static checks were green,
-- because a missing key on a jsonb object is nobody's type error.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-refund-groups.sql.

begin;

CREATE OR REPLACE FUNCTION public.club_event_bookings_summary(p_club bigint, p_event bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                                        and b.checked_in_at is null),
        -- The two money-back groups (0230, the client's item 16f). No
        -- `status <> 'cancelled'` clause on either: a refund is owed on a
        -- place that WAS called off, so copying that clause from the three
        -- above leaves both counts at nought for ever. They overlap
        -- Cancelled rather than slicing it, so the six no longer sum to All.
        'refunddue', count(*) filter (where b.refund_status = 'due'),
        'refunded',  count(*) filter (where b.refund_status = 'refunded')
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
$function$;

revoke all on function public.club_event_bookings_summary(bigint, bigint)
  from public, anon;
grant execute on function public.club_event_bookings_summary(bigint, bigint)
  to authenticated;

commit;
