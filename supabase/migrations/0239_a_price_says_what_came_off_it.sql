-- 0239: a price says what came off it
--
-- The client, item 22: "please can we add the membership and loyalty discount
-- values next to the prices shown for members on table bookings".
--
-- The figures have been frozen on the booking since 0014 and every other
-- screen already draws them through `PriceBreakdown`: the shop's order card,
-- the ticket stub, the coaching card, the club's own table bookings board and
-- the member's `/account/bookings`. `/account/games` was missed, so a member
-- looking at the game they played saw "£4.05" and no way to learn that it was
-- £5.00 less 10% for Premium Membership less 45 points.
--
-- `my_booking_payments` is the member's own "what do I owe" read and the
-- natural place for it, because the card already calls it. Widening it rather
-- than selecting the columns straight means the member's side keeps being
-- decided in one place.
--
-- **And it was answering for the wrong person.** It has returned the booker's
-- `payment_status` to whoever asked since 0213, which predates 0221 splitting
-- a table between the two people on it. Nobody has seen that yet because the
-- only split tables on the site have guest opponents, who have no account to
-- look at. The moment a member is the opponent on a shared table they would
-- have read the booker's status, and with this change they would have read
-- the booker's money as well. So the side is chosen here, once.
--
-- The opponent has no loyalty columns to read: points are spent by the person
-- making the booking, so the other seat's points are zero rather than null.

drop function if exists public.my_booking_payments(bigint[]);

create or replace function public.my_booking_payments(p_bookings bigint[])
returns table (
  booking_id bigint,
  side text,
  payment_status text,
  paid_at timestamptz,
  base_price numeric,
  tier_label text,
  tier_percent integer,
  tier_amount numeric,
  points_spent integer,
  points_amount numeric,
  total_price numeric,
  currency text
)
language sql
stable
security invoker
set search_path = public
as $$
  -- Booker unless the reader is demonstrably the opponent. A club manager
  -- reading somebody else's booking is neither, and answering "booker" for
  -- them is what this has always done.
  select b.id,
         case when b.opponent_profile_id = auth.uid() then 'opponent' else 'booker' end,
         case when b.opponent_profile_id = auth.uid()
              then b.opponent_payment_status else b.payment_status end,
         case when b.opponent_profile_id = auth.uid()
              then b.opponent_paid_at else b.paid_at end,
         case when b.opponent_profile_id = auth.uid()
              then b.opponent_base_price else b.base_price end,
         case when b.opponent_profile_id = auth.uid()
              then b.opponent_tier_label else b.membership_tier_label end,
         case when b.opponent_profile_id = auth.uid()
              then b.opponent_tier_discount_percent else b.tier_discount_percent end,
         case when b.opponent_profile_id = auth.uid()
              then b.opponent_tier_discount_amount else b.tier_discount_amount end,
         case when b.opponent_profile_id = auth.uid() then 0 else b.loyalty_points_spent end,
         case when b.opponent_profile_id = auth.uid()
              then 0::numeric else b.loyalty_discount_amount end,
         case when b.opponent_profile_id = auth.uid()
              then b.opponent_total_price else b.total_price end,
         b.price_currency
    from public.club_bookings b
   where b.id = any(coalesce(p_bookings, '{}'::bigint[]));
$$;

revoke all on function public.my_booking_payments(bigint[]) from public, anon;
grant execute on function public.my_booking_payments(bigint[]) to authenticated;
