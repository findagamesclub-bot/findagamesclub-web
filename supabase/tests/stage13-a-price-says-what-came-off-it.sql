-- 0239 · a price says what came off it.
--
-- Section 2 is the break test and it is the one that matters: the reader must
-- get their OWN seat's money. `my_booking_payments` has answered with the
-- booker's row since 0213, which predates 0221 splitting a table, so widening
-- it to carry the breakdown would have put the booker's money on the
-- opponent's card.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Both seats priced, with deliberately different figures so one cannot be
-- mistaken for the other. Written as postgres: 0014's trigger prices a
-- booking on insert and this is about what the reader is handed afterwards.
create or replace function pg_temp.price_both(p_booking bigint) returns void
language plpgsql security definer as $fn$ begin
  update public.club_bookings
     set base_price = 5.00,
         membership_tier_label = 'Premium Membership',
         tier_discount_percent = 10,
         tier_discount_amount  = 0.50,
         loyalty_points_spent  = 45,
         loyalty_discount_amount = 0.45,
         total_price = 4.05,
         price_currency = 'GBP',
         payment_status = 'unpaid',
         opponent_base_price = 2.50,
         opponent_tier_label = 'Life Member',
         opponent_tier_discount_percent = 20,
         opponent_tier_discount_amount  = 0.50,
         opponent_total_price = 2.00,
         opponent_payment_status = 'paid_on_the_door'
   where id = p_booking;
end $fn$;

-- What a booking taken before 0221 looks like: the whole table on the
-- booker's columns and an opponent sitting on a seat nobody ever priced.
create or replace function pg_temp.price_like_pre_0221(p_booking bigint) returns void
language plpgsql security definer as $fn$ begin
  update public.club_bookings
     set base_price = 5.00,
         membership_tier_label = 'Premium Membership',
         tier_discount_percent = 10,
         tier_discount_amount  = 0.50,
         loyalty_points_spent  = 45,
         loyalty_discount_amount = 0.45,
         total_price = 4.05,
         payment_status = 'unpaid',
         opponent_base_price = 0,
         opponent_tier_label = '',
         opponent_tier_discount_percent = 0,
         opponent_tier_discount_amount  = 0,
         opponent_total_price = 0,
         opponent_payment_status = 'unpaid'
   where id = p_booking;
end $fn$;

-- A second seat a tier has waived to nothing. Definer, because as the
-- member this update is an RLS no-op and the section would pass whatever the
-- discriminator was.
create or replace function pg_temp.waive_opponent(p_booking bigint) returns void
language plpgsql security definer as $fn$ begin
  update public.club_bookings
     set opponent_base_price = 2.50,
         opponent_tier_label = 'Life Member',
         opponent_tier_discount_percent = 100,
         opponent_tier_discount_amount  = 2.50,
         opponent_total_price = 0
   where id = p_booking;
end $fn$;

set local role authenticated;

do $$
declare
  w record; v_bk bigint; r record;
begin
  select * into w from who;
  select id into v_bk from bk;
  perform pg_temp.price_both(v_bk);

  -- ====================================================================== 1
  -- The booker reads their own share and everything that came off it.
  -- ====================================================================== 1
  perform pg_temp.be(w.member);
  select * into r from public.my_booking_payments(array[v_bk]);

  if r.side <> 'booker' then
    raise exception '1 FAIL: the booker was handed the % seat', r.side;
  end if;
  if r.base_price <> 5.00 or r.total_price <> 4.05 then
    raise exception '1 FAIL: booker priced % down to %', r.base_price, r.total_price;
  end if;
  if r.tier_label <> 'Premium Membership' or r.tier_percent <> 10
     or r.tier_amount <> 0.50 then
    raise exception '1 FAIL: the booker''s tier read % % %',
      r.tier_label, r.tier_percent, r.tier_amount;
  end if;
  if r.points_spent <> 45 or r.points_amount <> 0.45 then
    raise exception '1 FAIL: the booker''s points read % worth %',
      r.points_spent, r.points_amount;
  end if;
  if r.payment_status <> 'unpaid' then
    raise exception '1 FAIL: the booker''s status read %', r.payment_status;
  end if;

  -- ====================================================================== 2
  -- BREAK TEST. The opponent reads the OTHER seat. Answer with the booker's
  -- columns, as this did before 0239, and every figure here is wrong: they
  -- are told they owe £4.05 on a £5.00 table they were never charged for.
  -- ====================================================================== 2
  perform pg_temp.be(w.owner);
  select * into r from public.my_booking_payments(array[v_bk]);

  if r.side <> 'opponent' then
    raise exception '2 FAIL: the opponent was handed the % seat', r.side;
  end if;
  if r.base_price <> 2.50 or r.total_price <> 2.00 then
    raise exception '2 FAIL: opponent priced % down to %, which is the booker''s',
      r.base_price, r.total_price;
  end if;
  if r.tier_label <> 'Life Member' or r.tier_percent <> 20 then
    raise exception '2 FAIL: the opponent''s tier read % %', r.tier_label, r.tier_percent;
  end if;
  if r.payment_status <> 'paid_on_the_door' then
    raise exception '2 FAIL: the opponent''s status read %', r.payment_status;
  end if;

  -- ====================================================================== 3
  -- Points belong to whoever made the booking, so the other seat has none.
  -- Zero rather than null: a null would draw an empty line on the card.
  -- ====================================================================== 3
  if r.points_spent is distinct from 0 or r.points_amount is distinct from 0::numeric then
    raise exception '3 FAIL: the opponent was credited % points worth %',
      r.points_spent, r.points_amount;
  end if;

  -- ====================================================================== 4
  -- The two sides add back to the table. A split that does not is 0221's
  -- whole point undone, and the member is the one who notices.
  -- ====================================================================== 4
  perform pg_temp.be(w.member);
  select * into r from public.my_booking_payments(array[v_bk]);
  declare v_other numeric;
  begin
    perform pg_temp.be(w.owner);
    select total_price into v_other from public.my_booking_payments(array[v_bk]);
    if r.total_price + v_other <> 6.05 then
      raise exception '4 FAIL: the two seats add to %, not 6.05', r.total_price + v_other;
    end if;
  end;

  -- ====================================================================== 5
  -- A booking nobody asked about is not returned.
  -- ====================================================================== 5
  if exists (select 1 from public.my_booking_payments(array[]::bigint[])) then
    raise exception '5 FAIL: an empty ask came back with rows';
  end if;

  -- ====================================================================== 6
  -- BREAK TEST, and it is the one the live data found. 0221 did not backfill,
  -- so a booking taken before it keeps the WHOLE table on the booker's
  -- columns and leaves the second seat at zero with somebody on it. Choosing
  -- the seat on `opponent_profile_id` alone hands that reader a seat nobody
  -- priced and calls it settled: a member who read "Unpaid £4.05" on a
  -- September table reads nothing at all, which is money vanishing off a
  -- screen rather than a fix.
  -- ====================================================================== 6
  perform pg_temp.price_like_pre_0221(v_bk);

  perform pg_temp.be(w.owner);
  select * into r from public.my_booking_payments(array[v_bk]);

  if r.total_price <> 4.05 then
    raise exception '6 FAIL: the opponent on a pre-0221 table reads %, not the table''s 4.05',
      r.total_price;
  end if;
  if r.base_price <> 5.00 or r.tier_amount <> 0.50 or r.points_amount <> 0.45 then
    raise exception '6 FAIL: the pre-0221 breakdown read % % %',
      r.base_price, r.tier_amount, r.points_amount;
  end if;
  if r.payment_status <> 'unpaid' then
    raise exception '6 FAIL: the pre-0221 status read %', r.payment_status;
  end if;

  -- ====================================================================== 7
  -- A seat priced at zero BY A TIER is still that reader's seat. The
  -- discriminator has to be the share before the discount, or a membership
  -- that waives the fee would read as a seat nobody priced.
  -- ====================================================================== 7
  perform pg_temp.price_both(v_bk);
  perform pg_temp.waive_opponent(v_bk);

  perform pg_temp.be(w.owner);
  select * into r from public.my_booking_payments(array[v_bk]);
  if r.side <> 'opponent' then
    raise exception '7 FAIL: a seat waived to zero was handed to the %', r.side;
  end if;
  if r.total_price <> 0 or r.tier_amount <> 2.50 then
    raise exception '7 FAIL: the waived seat read total % off %',
      r.total_price, r.tier_amount;
  end if;

  raise notice 'stage13 0239 and 0240 · all 7 passed';
end $$;
