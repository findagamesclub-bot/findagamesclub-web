-- 0045 · Telling the other player about a result
--
-- 0044 let a club settle or dispute a result and lock the players out of it,
-- and told nobody. A member whose game has just been frozen by the club finds
-- out by opening the dialog and seeing the buttons greyed out, which is the
-- wrong way round.
--
-- Two things get a notification, both to whoever did NOT do it:
--
--   * the other player recorded or changed the score. It moves your win/loss
--     record, so you want to know it happened and check it.
--   * the club changed the state. Disputed and Admin confirmed both take the
--     result out of your hands, so that is the one that really matters.
--
-- Deduped per booking and per kind, as everything else is: ten corrections in
-- an evening leave one notification saying where it ended up, not ten.

create or replace function public.notify_on_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club    record;
  v_actor   text;
  v_game    text := coalesce(nullif(btrim(new.game_title), ''), 'your game');
  v_other   uuid;
  v_scored  boolean;
  v_state   boolean;
begin
  -- Only when something about the result actually moved.
  v_scored := new.booked_by_score is distinct from old.booked_by_score
           or new.opponent_score  is distinct from old.opponent_score;
  v_state  := new.result_confirmation is distinct from old.result_confirmation;

  if not (v_scored or v_state) then
    return new;
  end if;

  select slug, name into v_club from public.clubs where id = new.club_id;
  select full_name into v_actor from public.profiles where id = new.result_by;

  -- Everybody on the booking except whoever just did this. A guest opponent
  -- has no profile row, so there is simply nobody to tell.
  for v_other in
    select unnest(array[new.booked_by, new.opponent_profile_id, new.accepted_by])
  loop
    if v_other is null or v_other = new.result_by then
      continue;
    end if;

    if v_state and new.result_confirmation in ('disputed', 'admin-confirmed') then
      perform public.notify_person(
        v_other, 'result_state',
        case new.result_confirmation
          when 'disputed' then coalesce(v_club.name, 'The club') || ' marked a result disputed'
          else coalesce(v_club.name, 'The club') || ' settled your result'
        end,
        case new.result_confirmation
          when 'disputed' then v_game || ' is locked until the club settles it.'
          else v_game || ' is final now. Only the club can change it.'
        end,
        '/account/games', 'booking', new.id::text);

    elsif v_state and new.result_confirmation = 'confirmed' then
      perform public.notify_person(
        v_other, 'result_state',
        'Your result was confirmed',
        v_game || ' is agreed by both players.',
        '/account/games', 'booking', new.id::text);

    elsif v_scored then
      perform public.notify_person(
        v_other, 'result_recorded',
        coalesce(nullif(btrim(v_actor), ''), 'Someone') || ' recorded ' || v_game,
        'Check the score and correct it if it is wrong.',
        '/account/games', 'booking', new.id::text);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists club_bookings_result_notify on public.club_bookings;
create trigger club_bookings_result_notify
  after update on public.club_bookings
  for each row execute function public.notify_on_result();
