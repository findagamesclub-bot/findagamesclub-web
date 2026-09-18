-- 0096 · Putting a cancelled event back on
--
-- Calling an event off cancels every place with it (0092), and "Put it back
-- on" only ever un-cancelled the event: the people who were coming were never
-- told, and their places had gone. So a club that called off a flooded hall
-- and got a second date had an event nobody knew was on again, with the
-- entries silently emptied.
--
-- Their bookings are deliberately NOT restored. Tickets may have gone to
-- somebody else in the meantime, and putting somebody back into a place, and
-- a charge, that they have not agreed to is worse than asking them to book
-- again. They are told, and they choose.

create or replace function public.club_events_back_on_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  holder record;
  club   record;
begin
  if old.status <> 'cancelled' or new.status <> 'published' then
    return new;
  end if;

  select slug, name into club from public.clubs where id = new.club_id;

  -- Only the people the cancellation took out, not somebody who had given
  -- their own place back beforehand. That wording is what 0092 writes when it
  -- cancels a booking on the event's behalf.
  for holder in
    select distinct b.profile_id
      from public.club_event_bookings b
     where b.event_id = new.id
       and b.status = 'cancelled'
       and b.cancel_reason = 'The event was called off'
       and b.profile_id is not null
  loop
    perform public.notify_person(
      holder.profile_id,
      'event-back-on',
      new.title || ' is back on',
      'Your old place was not held, so book again if you still want to come.',
      '/clubs/' || club.slug || '/events/' || new.legacy_id,
      'event',
      new.id::text,
      club.name
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists club_events_back_on on public.club_events;
create trigger club_events_back_on
  after update of status on public.club_events
  for each row execute function public.club_events_back_on_notify();
