-- 0047 · Telling people they have been put on a table
--
-- Nothing has ever fired when a booking is created. Two people needed it:
--
--   * the named opponent. Somebody puts your name on a game on a specific
--     night and you are told nothing at all; you find out by opening the club
--     page. That is the same gap orders and coaching had before 0041.
--   * whoever comes off the waiting list. A trigger books a table in their name
--     without them asking, and today the only thing that tells them is an
--     email. Email needs Resend and a real site URL, so on a dev machine, or
--     any environment where mail is not set up, they are simply never told.
--
-- The club owner is deliberately NOT notified. A booking asks nothing of the
-- club, and a club with four tables a night would get dozens of pings a week
-- for something one page already shows. Same reasoning as My clubs counting
-- join requests and unpaid coaching as tasks, but not bookings.

create or replace function public.notify_on_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club  record;
  v_who   text;
  v_game  text := coalesce(nullif(btrim(new.game_title), ''), 'a game');
  v_night text;
begin
  if new.status <> 'booked' then
    return new;
  end if;

  select slug, name into v_club from public.clubs where id = new.club_id;
  v_night := to_char(new.session_date, 'FMDay FMDD Mon');

  -- Named into somebody else's game.
  if new.opponent_profile_id is not null
     and new.opponent_profile_id <> new.booked_by then
    select full_name into v_who from public.profiles where id = new.booked_by;
    perform public.notify_person(
      new.opponent_profile_id, 'booked_in',
      coalesce(nullif(btrim(v_who), ''), 'Someone') || ' booked you in for ' || v_game,
      coalesce(v_club.name, 'The club') || ', ' || v_night
        || coalesce(', ' || nullif(new.session_time, ''), ''),
      '/clubs/' || v_club.slug || '/bookings', 'booking', new.id::text);
  end if;

  -- Off the waiting list and onto a table, without having asked again.
  if new.source = 'waitlist' then
    perform public.notify_person(
      new.booked_by, 'waitlist_promoted',
      'You have a table at ' || coalesce(v_club.name, 'the club'),
      v_night || ' for ' || v_game || '. It came off the waiting list, so it is yours.',
      '/account/bookings', 'booking', new.id::text);
  end if;

  return new;
end;
$$;

drop trigger if exists club_bookings_notify on public.club_bookings;
create trigger club_bookings_notify
  after insert on public.club_bookings
  for each row execute function public.notify_on_booking();
