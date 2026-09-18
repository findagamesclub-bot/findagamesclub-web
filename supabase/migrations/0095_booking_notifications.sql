-- 0095 · The club changes your booking, you are told
--
-- Marking somebody paid, checking them in and taking their place back are all
-- things done to a member's booking by somebody else. Until now only two of
-- them sent an email and none of them reached the bell, so a member had to
-- open the site and look to find out what had happened to their ticket.
--
-- A trigger rather than a hook in the service, for the reason the loyalty
-- awards are triggers (CLAUDE.md): the same row is written from the event's
-- own list, the club-wide bookings tab and anything added later, and a hook
-- would have to be remembered in each.
--
-- Nobody is told about their own doing. A member cancelling their own place
-- knows they cancelled it.

/**
 * Whether the event-wide cancellation is doing this.
 *
 * `club_events_cancel_notify` tells every holder the event is off and then
 * cancels their bookings, which would fire this trigger for a second notice
 * saying the same thing. Same shape as `app.audit_quiet` in 0068.
 */
create or replace function public.club_event_bookings_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_href text;
  club_name   text;
  event_title text;
begin
  if new.profile_id is null then
    return new;
  end if;

  -- Their own doing needs no telling.
  if auth.uid() = new.profile_id then
    return new;
  end if;

  if coalesce(current_setting('app.booking_notify_quiet', true), '') = 'on' then
    return new;
  end if;

  select e.title, c.name into event_title, club_name
    from public.club_events e
    join public.clubs c on c.id = e.club_id
   where e.id = new.event_id;

  ticket_href := '/tickets/' || coalesce(new.reference, '');

  -- ------------------------------------------------------------- the money
  if new.payment_status is distinct from old.payment_status then
    if new.payment_status = 'unpaid' then
      perform public.notify_person(
        new.profile_id, 'ticket-unpaid',
        'Your ticket is marked unpaid again',
        coalesce(club_name, 'The club') || ' has taken the payment mark off your place at '
          || coalesce(event_title, 'their event') || '.',
        ticket_href, 'booking', new.id::text, club_name);
    else
      perform public.notify_person(
        new.profile_id, 'ticket-paid',
        'Your ticket is paid',
        coalesce(club_name, 'The club') || ' has recorded your payment for '
          || coalesce(event_title, 'their event') || '.'
          || case when btrim(coalesce(new.payment_method, '')) = '' then ''
                  else ' Paid by ' || new.payment_method || '.' end,
        ticket_href, 'booking', new.id::text, club_name);
    end if;
  end if;

  -- -------------------------------------------------------------- the door
  -- Only on the way in. Undoing a check in is a correction at the desk, and a
  -- notice saying "you are no longer here" to somebody standing there is noise.
  if new.checked_in_at is not null and old.checked_in_at is null then
    perform public.notify_person(
      new.profile_id, 'ticket-checked-in',
      'You are checked in',
      coalesce(club_name, 'The club') || ' has you at '
        || coalesce(event_title, 'their event') || '. Have a good one.',
      ticket_href, 'booking', new.id::text, club_name);
  end if;

  -- ------------------------------------------------------------- the place
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    perform public.notify_person(
      new.profile_id, 'ticket-cancelled-by-club',
      'Your place has been cancelled',
      coalesce(nullif(btrim(new.cancel_reason), ''),
               coalesce(club_name, 'The club') || ' has cancelled your place.'),
      ticket_href, 'booking', new.id::text, club_name);
  end if;

  -- ------------------------------------------------------------ the refund
  if new.refund_status is distinct from old.refund_status
     and new.refund_status = 'refunded' then
    perform public.notify_person(
      new.profile_id, 'ticket-refunded',
      'Your refund is settled',
      coalesce(club_name, 'The club') || ' has marked your refund for '
        || coalesce(event_title, 'their event') || ' as sorted.',
      ticket_href, 'booking', new.id::text, club_name);
  end if;

  return new;
end;
$$;

drop trigger if exists club_event_bookings_notified on public.club_event_bookings;
create trigger club_event_bookings_notified
  after update on public.club_event_bookings
  for each row execute function public.club_event_bookings_notify();

-- --------------------------------------------------------------- the quiet
--
-- Re-created only to wrap its bulk update in the flag. Everything else about
-- it is 0092's.

create or replace function public.club_events_cancel_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  holder record;
  club   record;
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' then
    return new;
  end if;

  select slug, name into club from public.clubs where id = new.club_id;

  for holder in
    select distinct b.profile_id
      from public.club_event_bookings b
     where b.event_id = new.id
       and b.status <> 'cancelled'
       and b.profile_id is not null
  loop
    perform public.notify_person(
      holder.profile_id,
      'event-cancelled',
      new.title || ' has been called off',
      coalesce(nullif(btrim(new.cancel_reason), ''), 'The club has cancelled this event.'),
      '/clubs/' || club.slug || '/events/' || new.legacy_id,
      'event',
      new.id::text,
      club.name
    );
  end loop;

  -- Everybody has just been told the event is off. Without this the per-row
  -- trigger tells each of them again that their place is gone.
  perform set_config('app.booking_notify_quiet', 'on', true);

  update public.club_event_bookings
     set status = 'cancelled',
         cancel_reason = case when btrim(cancel_reason) = ''
                              then 'The event was called off' else cancel_reason end
   where event_id = new.id and status <> 'cancelled';

  perform set_config('app.booking_notify_quiet', 'off', true);

  return new;
end;
$$;
