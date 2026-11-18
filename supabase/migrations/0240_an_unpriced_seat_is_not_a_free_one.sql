-- 0240: an unpriced seat is not a free one
--
-- 0239 chose the reader's seat on `opponent_profile_id = auth.uid()` alone,
-- and that is wrong for every booking taken before 0221.
--
-- 0221 split a table between the two people on it and did not backfill. Its
-- own comments say so: `base_price` is "the BOOKER'S share of the table since
-- 0221, not the table's own price", and `opponent_base_price` is "the second
-- seat's share. Zero where nobody else is on the table." On a row written
-- before that migration the first still holds the WHOLE table and the second
-- is zero with somebody plainly sitting there.
--
-- So on the live data a member who was the opponent on a September table read
-- "Unpaid £4.05" this morning and would have read nothing at all this
-- afternoon: 0239 handed them an opponent seat that was never priced and
-- called it settled. That is money disappearing off a screen the client is
-- looking at, in the same release as a change they asked for.
--
-- A seat priced at zero with somebody on it is therefore an UNPRICED seat,
-- not a free one, and the row's own figures are what that booking means. The
-- discriminator is `opponent_base_price`, the share before any discount, and
-- not the total: a second seat whose tier waives the fee is priced at 2.50
-- down to 0.00 and is still a seat the reader owns.
--
-- `side` says whose money the row describes, which on a pre-0221 booking is
-- the table's and so the booker's.

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
  select b.id,
         case when mine.own then 'opponent' else 'booker' end,
         case when mine.own then b.opponent_payment_status else b.payment_status end,
         case when mine.own then b.opponent_paid_at else b.paid_at end,
         case when mine.own then b.opponent_base_price else b.base_price end,
         case when mine.own then b.opponent_tier_label else b.membership_tier_label end,
         case when mine.own
              then b.opponent_tier_discount_percent else b.tier_discount_percent end,
         case when mine.own
              then b.opponent_tier_discount_amount else b.tier_discount_amount end,
         case when mine.own then 0 else b.loyalty_points_spent end,
         case when mine.own then 0::numeric else b.loyalty_discount_amount end,
         case when mine.own then b.opponent_total_price else b.total_price end,
         b.price_currency
    from public.club_bookings b
    cross join lateral (
      select b.opponent_profile_id = auth.uid()
             and b.opponent_base_price > 0 as own
    ) mine
   where b.id = any(coalesce(p_bookings, '{}'::bigint[]));
$$;

revoke all on function public.my_booking_payments(bigint[]) from public, anon;
grant execute on function public.my_booking_payments(bigint[]) to authenticated;
