/**
 * The club can still act on a booking after the session has happened.
 *
 * `club_coaching_bookings_guard` (0020) fires `before insert or update` and
 * runs the same four checks either way: the slot exists, it is open, it has
 * not passed, the caller is a member, and there is room. Those are the rules
 * for **taking** a place. Applied to an update they mean something nobody
 * intended: a club cannot mark anybody paid once the session is over, because
 * the guard raises `SLOT_PASSED` on the way through.
 *
 * Coaching is paid offline after booking. The club page says so in those
 * words. So the one operation the whole feature is built around has been
 * refused for every session in the past, and 0158 would have inherited it:
 * cancelling worked only because `new.status <> 'booked'` returns early, which
 * is why the cancelled rows exist and the paid ones do not.
 *
 * Found by pressing the button. tsc, lint and five static checks were green,
 * the behaviour suite was green, and the row simply did not change: the write
 * raised, the service caught it, and the screen redrew what was already there.
 *
 * The fix keeps every check for the cases they were written for. An update
 * that leaves the booking on the same slot and was already `booked` is the
 * club administering a place that exists; it takes no new seat, so none of the
 * seat rules apply. Anything that creates a place, moves it to another slot,
 * or revives a cancelled one back into `booked` is taking a seat and is
 * checked exactly as before.
 */

create or replace function public.club_coaching_bookings_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap  smallint;
  used integer;
  slot public.club_coaching_slots%rowtype;
begin
  if new.status <> 'booked' then
    return new;
  end if;

  -- Administering a place that already exists takes no seat: the club marking
  -- somebody paid, writing a refund state, or correcting a note. The session
  -- being over is the normal case for all three.
  if tg_op = 'UPDATE'
     and old.status = 'booked'
     and new.slot_id = old.slot_id then
    return new;
  end if;

  select * into slot from public.club_coaching_slots
   where id = new.slot_id for update;

  if slot.id is null then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'check_violation';
  end if;
  if slot.status <> 'open' then
    raise exception 'SLOT_CLOSED' using errcode = 'check_violation';
  end if;
  if slot.slot_date < public.london_today() then
    raise exception 'SLOT_PASSED' using errcode = 'check_violation';
  end if;
  if not public.is_club_member(slot.club_id) then
    raise exception 'MEMBERS_ONLY' using errcode = 'insufficient_privilege';
  end if;

  cap := slot.capacity;
  select count(*) into used from public.club_coaching_bookings
   where slot_id = new.slot_id and status = 'booked' and id <> coalesce(new.id, -1);

  if used >= cap then
    raise exception 'SLOT_FULL' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
