-- 0222 · a seat appears on the payments list once it was charged for
--
-- 0221 split a table between the people on it and deliberately backfilled
-- nothing: a booking already made was agreed at the price it was agreed at.
-- That is still right, and it had a consequence on screen nobody had looked
-- at. `club_booking_sides` produced a second row for every booking that names
-- an opponent, including the hundreds made before the split, and every one of
-- those reads "Nothing to pay" — because nothing ever was.
--
-- Didcot's list went from 28 rows to 55, of which 27 were placeholders for
-- seats that were never charged. A list a club works down to collect money is
-- the wrong place to carry a row that can never be collected.
--
-- So the second seat appears once it HAS a share. `opponent_base_price > 0`
-- is that test, and it is the honest one in both directions:
--
--   - a booking from before 0221 has no second share, so it is one row, which
--     is exactly what was true about it;
--   - a booking made since has one whether or not the opponent's tier covers
--     it, because a waived half was still priced — it belongs in the Free tab
--     beside every other half a membership paid for, not hidden.
--
-- The booker's seat is never filtered. They are always charged something, even
-- if it is nothing, and a table with no row at all would be a table that
-- cannot be found.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-a-table-is-split.sql.

begin;

create or replace function public.club_booking_sides(p_club bigint)
returns table (
  booking_id     bigint,
  side           text,
  person_id      uuid,
  person_name    text,
  against_name   text,
  session_date   date,
  session_label  text,
  session_time   text,
  table_index    smallint,
  game_title     text,
  status         text,
  payment_status text,
  payment_method text,
  payment_note   text,
  paid_at        timestamptz,
  base_price     numeric(10,2),
  tier_label     text,
  tier_percent   smallint,
  tier_amount    numeric(10,2),
  points_spent   integer,
  points_amount  numeric(10,2),
  total_price    numeric(10,2),
  currency       text,
  booked_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, 'booker', b.booked_by,
         coalesce(nullif(btrim(p.full_name), ''), 'A member'),
         coalesce(nullif(btrim(o.full_name), ''), nullif(btrim(a.full_name), ''),
                  nullif(btrim(b.opponent_name), ''), ''),
         b.session_date, b.session_label, b.session_time, b.table_index,
         b.game_title, b.status,
         b.payment_status, b.payment_method, b.payment_note, b.paid_at,
         b.base_price, b.membership_tier_label, b.tier_discount_percent,
         b.tier_discount_amount, b.loyalty_points_spent, b.loyalty_discount_amount,
         b.total_price, b.price_currency, b.created_at
    from public.club_bookings b
    left join public.profiles p on p.id = b.booked_by
    left join public.profiles o on o.id = b.opponent_profile_id
    left join public.profiles a on a.id = b.accepted_by
   where b.club_id = p_club

  union all

  -- A guest has no account and still owes their half, so the name falls back
  -- through the two member seats to whatever was typed.
  select b.id, 'opponent', coalesce(b.opponent_profile_id, b.accepted_by),
         coalesce(nullif(btrim(o.full_name), ''), nullif(btrim(a.full_name), ''),
                  nullif(btrim(b.opponent_name), ''), 'A guest'),
         coalesce(nullif(btrim(p.full_name), ''), 'A member'),
         b.session_date, b.session_label, b.session_time, b.table_index,
         b.game_title, b.status,
         b.opponent_payment_status, b.opponent_payment_method,
         b.opponent_payment_note, b.opponent_paid_at,
         b.opponent_base_price, b.opponent_tier_label, b.opponent_tier_discount_percent,
         b.opponent_tier_discount_amount,
         -- Points are the booker's and are spent against the booker's half.
         0, 0::numeric(10,2),
         b.opponent_total_price, b.price_currency, b.created_at
    from public.club_bookings b
    left join public.profiles p on p.id = b.booked_by
    left join public.profiles o on o.id = b.opponent_profile_id
    left join public.profiles a on a.id = b.accepted_by
   where b.club_id = p_club
     and (coalesce(b.opponent_profile_id, b.accepted_by) is not null
          or btrim(coalesce(b.opponent_name, '')) <> '')
     -- The seat was charged a share. See the header: a booking from before
     -- 0221 has none, and carrying a row that can never be collected is the
     -- thing this migration takes off the list.
     and b.opponent_base_price > 0
$$;

revoke all on function public.club_booking_sides(bigint) from public, anon, authenticated;

commit;
