-- 0057 · Correcting what is written on a table booking
--
-- The club asked to be able to fix a booking's details: the game, the opponent
-- name typed in, the note about the night. Legacy cannot do this at all
-- (club_store.py has update_booking_result and nothing else), so this is new
-- rather than parity.
--
-- It has to be a function. `grant update (status, cancel_reason)` in 0014 is
-- the whole write surface a member or an owner has on club_bookings, and that
-- narrowness is deliberate: game_title, notes and opponent_name sit next to
-- table_index, total_price and loyalty_points_spent, and widening the grant to
-- reach three text columns hands out the row. The same reasoning as
-- record_booking_result (0044), and the same shape.

create or replace function public.edit_booking_details(
  p_booking bigint,
  p_game_title text,
  p_opponent_name text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target  public.club_bookings%rowtype;
  v_manages boolean;
begin
  if auth.uid() is null then
    raise exception 'BOOKING_NOT_YOURS';
  end if;

  select * into v_target from public.club_bookings where id = p_booking;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_target.status <> 'booked' then
    raise exception 'BOOKING_CANCELLED';
  end if;

  v_manages := public.can_manage_club(v_target.club_id);

  -- The club may correct any booking at any time, which is how it already
  -- cancels them (club_bookings_manage, 0014). The member who booked it may
  -- fix their own typo up to the night; after that the record is the club's,
  -- matching the cancel window they already have.
  if not v_manages then
    if v_target.booked_by <> auth.uid() then
      raise exception 'BOOKING_NOT_YOURS';
    end if;
    if v_target.session_date <= public.london_today() then
      raise exception 'BOOKING_PAST';
    end if;
  end if;

  if btrim(coalesce(p_game_title, '')) = '' then
    raise exception 'BOOKING_GAME_MISSING';
  end if;

  update public.club_bookings
     set game_title = left(btrim(p_game_title), 120),
         -- Naming a registered member happens through the booking form, which
         -- links their profile and is what the page actually displays. Typing
         -- over the text here must not silently unlink somebody, so a linked
         -- opponent keeps their name: this edits what is written on the
         -- booking, not who is on it.
         opponent_name = case
           when v_target.opponent_profile_id is null
             then left(btrim(coalesce(p_opponent_name, '')), 120)
           else v_target.opponent_name
         end,
         notes = left(btrim(coalesce(p_notes, '')), 500)
   where id = p_booking;
end;
$$;

revoke all on function public.edit_booking_details(bigint, text, text, text)
  from public, anon;
grant execute on function public.edit_booking_details(bigint, text, text, text)
  to authenticated;
