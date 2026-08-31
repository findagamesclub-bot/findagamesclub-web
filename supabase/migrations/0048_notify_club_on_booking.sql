-- 0048 · Telling the club when a table is booked
--
-- 0047 told the opponent and the promoted member and deliberately left the club
-- out, on the grounds that a booking asks nothing of them. Overruled, and
-- reasonably: an owner wants to know their club is being used, and at most of
-- these clubs it is a handful of tables a week rather than a stream.
--
-- Not counted as a task. My clubs still counts only things waiting on the owner
-- (join requests, tier requests, unpaid coaching, open orders), because there
-- is nothing here for them to do. This is news, not a job.

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
  v_when  text;
begin
  if new.status <> 'booked' then
    return new;
  end if;

  select slug, name, owner_id into v_club from public.clubs where id = new.club_id;
  select full_name into v_who from public.profiles where id = new.booked_by;
  v_who   := coalesce(nullif(btrim(v_who), ''), 'Someone');
  v_night := to_char(new.session_date, 'FMDay FMDD Mon');
  v_when  := v_night || coalesce(', ' || nullif(new.session_time, ''), '');

  -- Named into somebody else's game.
  if new.opponent_profile_id is not null
     and new.opponent_profile_id <> new.booked_by then
    perform public.notify_person(
      new.opponent_profile_id, 'booked_in',
      v_who || ' booked you in for ' || v_game,
      coalesce(v_club.name, 'The club') || ', ' || v_when,
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

  -- The club. Skipped when the owner booked it themselves, like every other
  -- notification here: nobody is told about their own doing.
  if v_club.owner_id is not null and v_club.owner_id <> new.booked_by then
    perform public.notify_person(
      v_club.owner_id, 'table_booked',
      v_who || ' booked a table',
      v_game || ', ' || v_when
        || coalesce(' v ' || nullif(btrim(new.opponent_name), ''), ''),
      '/clubs/' || v_club.slug || '/bookings', 'booking', new.id::text);
  end if;

  return new;
end;
$$;
