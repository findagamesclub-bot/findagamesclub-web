-- 0065 · A finished event is a public record
--
-- The client, on a tournament from April: "it does not have the roster and
-- pairings and results for each round. This is usually info we would want to
-- retain for a completed event, so you can see the history."
--
-- Nothing was lost. Legacy gates the draw and the attendee list on
-- _can_access_event_board (club_store.py:16187) — club manager, or you hold a
-- ticket — with no exception for an event that has already happened, and ours
-- copied it. So a tournament's own results were readable by the people who
-- already knew them and nobody else, and the standings sat underneath, public,
-- naming the same players.
--
-- The gate exists for two reasons and both expire on the day. Who is coming is
-- not a stranger's business before an event; the info board is a conversation
-- between the people going. Neither survives the event finishing. What is left
-- is a record the club published on purpose, of the same kind as the standings
-- beside it, and of the same kind the Best Coast Pairings link on these pages
-- opens to the whole internet.
--
-- So: once an event has ended, its roster opens. The ticket counts do not —
-- how many seats somebody bought is the club's business, not the record's, and
-- on a past event it says nothing anybody wants to know.
--
-- The board itself is deliberately NOT opened. It is a conversation, not a
-- record, and people wrote in it believing only the room could read it.

/**
 * Whether an event is over, in London.
 *
 * Same rule as the TypeScript (`hasEnded` in eventDetail.service.ts): the end
 * date, or the start date when there is no end, plus an end time if one was
 * given. An event with no date at all reads as finished rather than as
 * permanently upcoming.
 */
create or replace function public.event_has_ended(target_event bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select
       case
         when coalesce(e.end_date, e.start_date) is null then true
         else (coalesce(e.end_date, e.start_date)
                -- Only a real HH:MM is trusted; anything else means the club
                -- typed a note rather than a time, and the day is the answer.
                + case when btrim(coalesce(e.end_time, '')) ~ '^[0-2][0-9]:[0-5][0-9]$'
                       then btrim(e.end_time)::time
                       else time '23:59:59' end)
              < (now() at time zone 'Europe/London')
       end
     from public.club_events e where e.id = target_event),
    true);
$$;

revoke all on function public.event_has_ended(bigint) from public;
grant execute on function public.event_has_ended(bigint) to anon, authenticated;

/**
 * Who was there, or who is coming.
 *
 * Open to the club and to ticket holders while the event is ahead, and to
 * anybody once it is behind. The seat counts stay with the first group either
 * way: null rather than zero, so the reader is told nothing rather than told
 * nought.
 */
create or replace function public.club_event_roster(p_event bigint)
returns table (
  profile_id uuid,
  full_name text,
  is_member boolean,
  tickets integer,
  bookings integer,
  first_booked timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with access as (
    select public.can_access_event_board(p_event) as inner_circle,
           public.event_has_ended(p_event)        as finished
  ),
  tickets as (
    select b.id,
           b.profile_id,
           -- The name typed at checkout, which is what the club prints on a
           -- door list. Their profile name only stands in if it was blank.
           coalesce(nullif(btrim(b.full_name), ''),
                    nullif(btrim(p.full_name), ''),
                    'Guest')                             as who,
           b.created_at,
           coalesce((select sum(i.quantity)
                       from public.club_event_booking_items i
                      where i.booking_id = b.id), 0)::integer as seats
      from public.club_event_bookings b
      left join public.profiles p on p.id = b.profile_id
      cross join access a
     where b.event_id = p_event
       and b.status <> 'cancelled'
       and (a.inner_circle or a.finished)
  )
  select
    t.profile_id,
    t.who,
    t.profile_id is not null as is_member,
    case when (select inner_circle from access) then sum(t.seats)::integer end as tickets,
    case when (select inner_circle from access) then count(*)::integer end     as bookings,
    min(t.created_at) as first_booked
    from tickets t
   group by t.profile_id, t.who
   order by min(t.created_at);
$$;

revoke all on function public.club_event_roster(bigint) from public;
grant execute on function public.club_event_roster(bigint) to anon, authenticated;
