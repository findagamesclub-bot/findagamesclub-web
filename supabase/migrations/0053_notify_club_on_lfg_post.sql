-- 0053 · Telling the club when a member is looking for a game
--
-- 0052 told the poster when their advert was taken. Nothing told the club that
-- an advert existed at all, so a member could sit on the board for a fortnight
-- with the one person who could help find them an opponent never knowing.
--
-- I argued against this on the grounds that an advert asks nothing of the owner
-- and they hear about it when it converts into a booking. Overruled, and
-- rightly: an advert that never converts is exactly the one the club needs to
-- see, and by the time it converts nobody needed telling.
--
-- Not counted as a task on My clubs, the line 0048 drew: this is news, not a
-- job. Withdrawals are not announced either; a member changing their mind is
-- not something the club acts on.

create or replace function public.notify_club_on_lfg_post()
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
  if new.status <> 'open' then
    return new;
  end if;

  select slug, name, owner_id into v_club from public.clubs where id = new.club_id;

  -- No owner is a data gap, not an error. And nobody is told about their own
  -- doing, the same rule as every other notification here.
  if v_club.owner_id is null or v_club.owner_id = new.created_by then
    return new;
  end if;

  select full_name into v_who from public.profiles where id = new.created_by;
  v_who   := coalesce(nullif(btrim(v_who), ''), 'A member');
  v_night := to_char(new.session_date, 'FMDay FMDD Mon');

  perform public.notify_person(
    v_club.owner_id, 'looking_for_game',
    v_who || ' is looking for a game of ' || v_game,
    v_night || coalesce(', ' || nullif(new.session_time, ''), ''),
    '/clubs/' || v_club.slug || '/bookings',
    'looking_for_game', new.id::text);

  return new;
end;
$$;

drop trigger if exists club_lfg_notify_club on public.club_looking_for_games;
create trigger club_lfg_notify_club
  after insert on public.club_looking_for_games
  for each row execute function public.notify_club_on_lfg_post();
