-- 0051 · Telling the club when somebody books event tickets
--
-- Nothing has ever notified anyone about an event booking. Merchandise orders
-- tell the owner (0041), table bookings tell the owner (0048), coaching tells
-- the owner (0041), and the one thing that takes real money at the door told
-- nobody at all. An owner found out by opening the door list and counting.
--
-- Cancellation is included for the same reason it matters more here than
-- elsewhere: a place going back into the pool is a place the club can resell,
-- and the club is the only party who can act on that.
--
-- Not counted as a task on My clubs. That count is things waiting on the owner
-- (join requests, tier requests, unpaid coaching, open orders). A booking is
-- news, not a job, which is the line 0048 drew.

create or replace function public.notify_club_on_event_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club  record;
  v_event record;
  v_who   text;
  v_when  text;
  v_href  text;
begin
  -- A guest booking has no profile to name, but the club still wants to know.
  select c.slug, c.name, c.owner_id into v_club
    from public.clubs c where c.id = new.club_id;

  if v_club.owner_id is null then
    return new;
  end if;

  -- Nobody is told about their own doing, the same rule as everywhere else.
  if new.profile_id is not null and v_club.owner_id = new.profile_id then
    return new;
  end if;

  select e.legacy_id, e.title, e.start_date into v_event
    from public.club_events e where e.id = new.event_id;

  v_who := coalesce(nullif(btrim(new.full_name), ''), 'Someone');
  v_when := coalesce(to_char(v_event.start_date, 'FMDay FMDD Mon'), '');
  -- The door list, which is where an owner acts on this rather than only reads it.
  v_href := '/clubs/' || v_club.slug || '/events/' || v_event.legacy_id || '/attendees';

  if tg_op = 'INSERT' and new.status = 'reserved' then
    -- No ticket count: the lines are inserted after the booking row, so an
    -- AFTER trigger on the booking cannot have them yet. Same reason the
    -- merchandise one says "ordered merchandise" rather than "2 items"; the
    -- door list behind the link has the detail.
    perform public.notify_person(
      v_club.owner_id, 'tickets_booked',
      v_who || ' booked tickets for ' || coalesce(v_event.title, 'an event'),
      v_when, v_href, 'event_booking', new.id::text);
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status = 'reserved' then
    perform public.notify_person(
      v_club.owner_id, 'tickets_cancelled',
      v_who || ' cancelled tickets for ' || coalesce(v_event.title, 'an event'),
      'Their place has gone back into the pool.',
      v_href, 'event_booking', new.id::text);
  end if;

  return new;
end;
$$;

drop trigger if exists club_event_bookings_notify_club on public.club_event_bookings;
create trigger club_event_bookings_notify_club
  after insert or update on public.club_event_bookings
  for each row execute function public.notify_club_on_event_booking();
