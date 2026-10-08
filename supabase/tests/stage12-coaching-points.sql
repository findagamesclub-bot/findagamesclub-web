-- 0157 · Points towards coaching, and the discount a tier advertises.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- A tier that takes 10% off coaching and lets points cover half a bill.
insert into public.club_membership_tiers
  (club_id, tier_key, label, price, price_duration, is_basic, position, benefits)
  select id, 'basic', 'Basic', '10', 'month', true, 0,
         '{"coachingDiscountPercent": 10, "loyaltyRedemptionCapPercent": 50}'::jsonb
    from c;

insert into public.club_loyalty_settings (club_id, enabled, point_value)
  select id, true, 0.05 from c;

-- 400 points in the bank, worth £20 at 0.05 each.
insert into public.club_loyalty_transactions
  (club_id, profile_id, kind, category, description,
   available_delta, lifetime_delta, source_key)
  select id, 'e0000000-0000-0000-0000-000000000003', 'earned', 'membership-approved',
         'Joined', 400, 400, 'test::joined' from c;

-- A £10 session, priced the way a club actually types it.
insert into public.club_coaching_slots
  (club_id, title, slot_date, start_time, price, coaching_type, capacity, status)
  select id, 'List clinic', public.london_today() + 7, '19:00', 'GBP 10',
         'one-to-one', 5, 'open' from c;

create temp table slot as
  select id from public.club_coaching_slots where title = 'List clinic';
grant select on slot to authenticated;

-- ===========================================================================
-- 1. Free text becomes a number, and anything unreadable is nothing to pay
-- ===========================================================================

do $$
begin
  if public.price_from_text('GBP 10') <> 10.00 then
    raise exception 'GBP 10 read as %', public.price_from_text('GBP 10');
  end if;
  if public.price_from_text('£12.50') <> 12.50 then
    raise exception 'a pound sign broke it: %', public.price_from_text('£12.50');
  end if;
  -- "Free", a blank and a null are all nothing to pay, which is the honest
  -- reading: a club that has not named a price is not charging here.
  if public.price_from_text('Free') <> 0 then raise exception 'Free is not 0'; end if;
  if public.price_from_text('') <> 0 then raise exception 'blank is not 0'; end if;
  if public.price_from_text(null) <> 0 then raise exception 'null is not 0'; end if;
end $$;

-- ===========================================================================
-- 2. The tier discount a club advertises is finally applied
-- ===========================================================================

do $$
declare v_row public.club_coaching_bookings%rowtype;
begin
  perform pg_temp.be('e0000000-0000-0000-0000-000000000003');
  insert into public.club_coaching_bookings (slot_id)
    select id from slot returning * into v_row;

  if v_row.base_price <> 10.00 then
    raise exception 'base price came back as %', v_row.base_price;
  end if;
  -- 10% off coaching, which until now was on every tier page and applied
  -- nowhere in the app.
  if v_row.tier_discount_percent <> 10 then
    raise exception 'the coaching discount was %', v_row.tier_discount_percent;
  end if;
  if v_row.tier_discount_amount <> 1.00 then
    raise exception 'the discount amount was %', v_row.tier_discount_amount;
  end if;
  if v_row.total_price <> 9.00 then
    raise exception 'total came back as %, expected 9.00', v_row.total_price;
  end if;
  if v_row.loyalty_points_spent <> 0 then
    raise exception 'points were spent without being asked for';
  end if;

  delete from public.club_coaching_bookings where id = v_row.id;
end $$;

-- ===========================================================================
-- 3. Points come off, capped by the tier, and the ledger records the spend
-- ===========================================================================

do $$
declare v_row public.club_coaching_bookings%rowtype; v_spent integer;
begin
  perform pg_temp.be('e0000000-0000-0000-0000-000000000003');

  -- £9 payable, cap 50% = £4.50, at 0.05 a point that is 90 points. Asking for
  -- 200 is trimmed rather than refused: the member gets what they are allowed.
  insert into public.club_coaching_bookings (slot_id, loyalty_points_spent)
    select id, 200 from slot returning * into v_row;

  if v_row.loyalty_points_spent <> 90 then
    raise exception 'spent % points, expected the 90 the cap allows',
      v_row.loyalty_points_spent;
  end if;
  if v_row.loyalty_discount_amount <> 4.50 then
    raise exception 'points took off %, expected 4.50', v_row.loyalty_discount_amount;
  end if;
  if v_row.total_price <> 4.50 then
    raise exception 'total came back as %, expected 4.50', v_row.total_price;
  end if;

  select coalesce(sum(available_delta), 0) into v_spent
    from public.club_loyalty_transactions
   where category = 'coaching-booking' and kind = 'spent';
  if v_spent <> -90 then
    raise exception 'the ledger recorded % rather than -90', v_spent;
  end if;

  -- Lifetime is untouched. Spending must never demote anybody, which is the
  -- whole reason the ledger carries two deltas.
  if exists (select 1 from public.club_loyalty_transactions
              where category = 'coaching-booking' and lifetime_delta <> 0) then
    raise exception 'spending coaching points moved a lifetime total';
  end if;

  -- ---------------------------------------------------------------- refund
  update public.club_coaching_bookings set status = 'cancelled' where id = v_row.id;

  select coalesce(sum(available_delta), 0) into v_spent
    from public.club_loyalty_transactions where category = 'coaching-booking';
  if v_spent <> 0 then
    raise exception 'cancelling left % points out of pocket', -v_spent;
  end if;

  -- Idempotent: a second cancel writes nothing, because of the source key.
  update public.club_coaching_bookings set status = 'cancelled' where id = v_row.id;
  select count(*) into v_spent from public.club_loyalty_transactions
   where category = 'coaching-booking';
  if v_spent <> 2 then
    raise exception 'the ledger holds % coaching rows, expected 2', v_spent;
  end if;

  delete from public.club_coaching_bookings where id = v_row.id;
  delete from public.club_loyalty_transactions where category = 'coaching-booking';
end $$;

-- ===========================================================================
-- 4. The refusals, each by name
-- ===========================================================================

do $$
declare v_code text;
begin
  perform pg_temp.be('e0000000-0000-0000-0000-000000000003');

  begin
    insert into public.club_coaching_bookings (slot_id, loyalty_points_spent)
      select id, 5000 from slot;
    raise exception 'spending more points than are held was allowed';
  exception when check_violation then
    get stacked diagnostics v_code = message_text;
    if v_code <> 'NOT_ENOUGH_POINTS' then raise exception 'got %', v_code; end if;
  end;

  -- A free session has nothing to take points off, and says so.
  update public.club_coaching_slots set price = 'Free' where id = (select id from slot);
  begin
    insert into public.club_coaching_bookings (slot_id, loyalty_points_spent)
      select id, 10 from slot;
    raise exception 'points were taken off a free session';
  exception when check_violation then
    get stacked diagnostics v_code = message_text;
    if v_code <> 'NOTHING_TO_PAY' then raise exception 'got %', v_code; end if;
  end;
  update public.club_coaching_slots set price = 'GBP 10' where id = (select id from slot);

  -- A club that does not take points off anything refuses by name rather than
  -- quietly charging full price.
  update public.club_membership_tiers
     set benefits = benefits || '{"loyaltyRedemptionCapPercent": 0}'::jsonb
   where tier_key = 'basic';
  begin
    insert into public.club_coaching_bookings (slot_id, loyalty_points_spent)
      select id, 10 from slot;
    raise exception 'points were taken with the cap at zero';
  exception when check_violation then
    get stacked diagnostics v_code = message_text;
    if v_code <> 'NO_REDEMPTION' then raise exception 'got %', v_code; end if;
  end;
  update public.club_membership_tiers
     set benefits = benefits || '{"loyaltyRedemptionCapPercent": 50}'::jsonb
   where tier_key = 'basic';
end $$;

-- ===========================================================================
-- 5. The money is the trigger's, not the member's
-- ===========================================================================

do $$
declare v_bad text;
begin
  select string_agg(column_name, ', ') into v_bad
    from information_schema.role_column_grants
   where table_name = 'club_coaching_bookings'
     and grantee = 'authenticated'
     and privilege_type = 'INSERT'
     and column_name in ('base_price', 'tier_discount_percent', 'tier_discount_amount',
                         'loyalty_discount_amount', 'total_price', 'price_currency');
  if v_bad is not null then
    raise exception 'a member can name the money: %', v_bad;
  end if;

  -- And the whole-table grant is not quietly standing behind the column list.
  if exists (select 1 from information_schema.role_table_grants
              where table_name = 'club_coaching_bookings'
                and grantee = 'authenticated' and privilege_type = 'INSERT') then
    raise exception 'authenticated holds a whole-table INSERT';
  end if;
end $$;

rollback;

\echo 'stage12-coaching-points: all pass'
