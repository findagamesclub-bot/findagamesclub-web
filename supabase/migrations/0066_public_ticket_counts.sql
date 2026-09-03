-- 0066 · Tickets left, counted honestly
--
-- The event page reported how many tickets remained by reading
-- club_event_booking_items directly. That table is RLS-guarded to your own
-- bookings, which means the count came back as follows:
--
--   the club      every booking          right
--   a member      only their own         under-counted
--   signed out    none at all            every ticket type reads as untouched
--
-- Didcot's Autumn Open has 17 of 67 tickets gone. Signed out, the page offered
-- all 67, and the "1 LEFT" late entry — which is the one somebody would hurry
-- for — read as available whatever had happened to it.
--
-- Nothing could be oversold: club_event_booking_items_guard locks the ticket
-- type and refuses at checkout. But a page that says "1 left" and a checkout
-- that says "sold out" is a worse experience than either being honest.
--
-- A count, and only a count. No names, no references, no money — the same
-- reasoning as club_event_roster: how many seats are gone is what a shop
-- window says out loud, while who bought them is not.
--
-- `status = 'reserved'` matches the capacity guard exactly, so the page and
-- the checkout are counting the same thing. A cart that has not been checked
-- out holds no items yet and so takes nothing.

create or replace function public.event_tickets_taken(p_event bigint)
returns table (ticket_type_id bigint, taken integer)
language sql
stable
security definer
set search_path = public
as $$
  select i.ticket_type_id, sum(i.quantity)::integer
    from public.club_event_booking_items i
    join public.club_event_bookings b on b.id = i.booking_id
    join public.club_event_ticket_types t on t.id = i.ticket_type_id
   where t.event_id = p_event
     and b.status = 'reserved'
   group by i.ticket_type_id;
$$;

revoke all on function public.event_tickets_taken(bigint) from public;
grant execute on function public.event_tickets_taken(bigint) to anon, authenticated;
