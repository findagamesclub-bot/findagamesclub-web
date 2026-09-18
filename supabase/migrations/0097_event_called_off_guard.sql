-- 0097 · A called-off event cannot be booked
--
-- The client called an event off, went to its public page, and was offered the
-- last ticket. The page is fixed, but the page was never the guard: the cart is
-- an ordinary table and the anon key is public, so anyone can reach PostgREST
-- with their own JWT and check out against an event nobody is running. Same
-- reasoning as capacity and eligibility, which live here rather than in the
-- service for exactly that reason.
--
-- A trigger on the booking rather than another `if` inside checkout_event_cart,
-- because the check belongs to the row: every way a place is ever created has
-- to pass it, including whatever the console grows next. checkout_event_cart is
-- the only insert path today and it would not have needed both.
--
-- Draft is refused too. Nobody can reach a draft event's page but the club, and
-- the club is handed the sales board rather than the desk, so this is a hole
-- nobody has fallen down. It is the same sentence to close.
--
-- Cancelling an event does NOT trip this: 0092 updates the places that already
-- exist, and an update is not an insert.
--
-- Checked on a throwaway Postgres by replaying 0001 to 0097 and then, as an
-- ordinary member with a cart on a published event: checkout succeeds; the club
-- calls the event off; checkout raises EVENT_CANCELLED and writes no booking;
-- the event goes back on and checkout succeeds again.

create or replace function public.club_event_bookings_event_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select e.status into v_status
    from public.club_events e where e.id = new.event_id;

  if v_status = 'cancelled' then
    raise exception 'EVENT_CANCELLED' using errcode = 'check_violation';
  end if;

  if v_status = 'draft' then
    raise exception 'EVENT_NOT_ON_SALE' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.club_event_bookings_event_open() from public, anon, authenticated;

drop trigger if exists club_event_bookings_open on public.club_event_bookings;

create trigger club_event_bookings_open
  before insert on public.club_event_bookings
  for each row execute function public.club_event_bookings_event_open();
