-- 0052 · Telling the poster when somebody takes up their game
--
-- accept_looking_for_game books a table with the POSTER as booked_by and the
-- acceptor in the second seat (0014:684). So the poster is committed to a
-- night, at a price, against a named opponent, at a moment they were not
-- looking at the site and did not ask again.
--
-- That is exactly the waitlist-promotion case, which 0047 treats as the one
-- notification that cannot go unsent. Nothing told the poster at all: the only
-- notification the accept produced was the club owner's "X booked a table",
-- fired by notify_on_booking on the row underneath.
--
-- The acceptor is told nothing, deliberately. They just did it themselves.

create or replace function public.notify_on_game_found()
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
  if tg_op <> 'UPDATE' or new.status <> 'accepted' or old.status = 'accepted' then
    return new;
  end if;

  select slug, name into v_club from public.clubs where id = new.club_id;
  select full_name into v_who from public.profiles where id = new.accepted_by;
  v_who   := coalesce(nullif(btrim(v_who), ''), 'Somebody');
  v_night := to_char(new.session_date, 'FMDay FMDD Mon');

  perform public.notify_person(
    new.created_by, 'game_found',
    v_who || ' took up your game of ' || v_game,
    v_night || coalesce(', ' || nullif(new.session_time, ''), '')
      || '. The table is booked in your name.',
    '/clubs/' || v_club.slug || '/bookings',
    'looking_for_game', new.id::text);

  return new;
end;
$$;

drop trigger if exists club_lfg_notify_poster on public.club_looking_for_games;
create trigger club_lfg_notify_poster
  after update on public.club_looking_for_games
  for each row execute function public.notify_on_game_found();
