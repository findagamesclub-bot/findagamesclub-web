-- 0049 · Letting a club cancel a member's booking, and telling them
--
-- Two faults, both found by reading rather than by anybody hitting them.
--
-- 1. The Manage night dialog has always offered the club a Cancel button
--    against every booking on a night. The policy behind it only ever allowed
--    the people ON the table:
--
--      booked_by = auth.uid() or opponent_profile_id = ... or accepted_by = ...
--
--    So a club owner could cancel nobody's booking but their own, and the
--    button answered with "that booking can no longer be cancelled", which is
--    not what happened at all. The screen offered something the database
--    refused.
--
-- 2. Nothing told the member. Somebody's table disappearing without a word is
--    the worst of the notification gaps: they turn up on the night.

drop policy if exists club_bookings_cancel on public.club_bookings;

create policy club_bookings_cancel
  on public.club_bookings for update to authenticated
  using (
    status = 'booked'
    and session_date > public.london_today()
    and (booked_by = (select auth.uid())
         or opponent_profile_id = (select auth.uid())
         or accepted_by = (select auth.uid())
         -- The club runs the night, so it may take a table back. Same date
         -- rule as everyone else: not on the day.
         or public.can_manage_club(club_id))
  )
  with check (status = 'cancelled');

-- ------------------------------------------------------------ the notice

create or replace function public.notify_on_booking_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club  record;
  v_game  text := coalesce(nullif(btrim(new.game_title), ''), 'your table');
  v_night text;
  v_other uuid;
begin
  if not (new.status = 'cancelled' and old.status = 'booked') then
    return new;
  end if;

  select slug, name into v_club from public.clubs where id = new.club_id;
  v_night := to_char(new.session_date, 'FMDay FMDD Mon');

  -- Everybody who was on the table except whoever cancelled it. That covers
  -- both cases: the club dropping a member's booking, and one player dropping
  -- a game the other was expecting to turn up for.
  for v_other in
    select unnest(array[new.booked_by, new.opponent_profile_id, new.accepted_by])
  loop
    if v_other is null or v_other = new.cancelled_by then
      continue;
    end if;

    perform public.notify_person(
      v_other, 'booking_cancelled',
      coalesce(v_club.name, 'The club') || ' cancelled ' || v_game,
      v_night || '. Talk to the club if that was not expected.'
        || coalesce(' Reason: ' || nullif(btrim(new.cancel_reason), ''), ''),
      '/clubs/' || v_club.slug || '/bookings', 'booking', new.id::text);
  end loop;

  return new;
end;
$$;

drop trigger if exists club_bookings_cancel_notify on public.club_bookings;
create trigger club_bookings_cancel_notify
  after update on public.club_bookings
  for each row execute function public.notify_on_booking_cancelled();
