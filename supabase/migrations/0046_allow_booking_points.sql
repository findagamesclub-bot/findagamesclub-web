-- 0046 · Let a booking actually carry the points it was priced with
--
-- 0043 added the trigger that prices a redemption and the column grant that
-- lets a member ask for one, and missed the third gate. Stage 3's insert policy
-- still says:
--
--     and loyalty_points_spent = 0
--
-- which was right when redemption was out of scope. WITH CHECK is evaluated
-- after BEFORE triggers, so the trigger would price the booking correctly and
-- RLS would then throw the whole row out with a 42501. From the member's side
-- that was "Could not book that table. Try again.", and trying again did the
-- same thing.
--
-- Relaxed to "not negative" rather than removed. It stays a number the member
-- may name, and club_bookings_price() is the only thing that decides what it
-- is worth: it checks the balance, applies the tier's cap, and writes
-- loyalty_discount_amount and total_price itself. Nothing the browser sends
-- reaches the money.

drop policy if exists club_bookings_insert on public.club_bookings;

create policy club_bookings_insert
  on public.club_bookings for insert to authenticated
  with check (
    booked_by = (select auth.uid())
    and public.is_club_member(club_id)
    and status = 'booked'
    and source = 'member'
    and accepted_by is null
    and accepted_at is null
    and cancelled_at is null
    and coalesce(loyalty_points_spent, 0) >= 0
    and session_date >= public.london_today()
  );
