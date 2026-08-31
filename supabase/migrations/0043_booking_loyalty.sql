-- 0043 · Loyalty points towards a table booking
--
-- Three things, all in the same corner of the ledger.
--
-- 1. Redemption. 0014 priced a booking properly, including the fee waiver, but
--    left `loyalty_points_spent := 0  -- redemption is out of Stage 3`. Legacy
--    has taken points off a booking since the beginning
--    (_apply_loyalty_redemption, club_store.py:18651).
--
-- 2. A refund when the booking is cancelled. Points spent on a game that never
--    happened have to come back, or cancelling quietly costs the member money.
--    Legacy writes a `refunded` row (_reverse_booking_loyalty).
--
-- 3. A clawback that matches the award. 0042 made an award worth
--    (base + tier bonus) x multiplier, but club_bookings_award_loyalty still
--    deducted the bare base on cancellation. A Didcot Premium member earned 20
--    and lost 5, so booking and cancelling repeatedly minted points.

-- The member may now ask to spend points. Everything else about the money is
-- still computed in the trigger and still ungranted.
grant insert (loyalty_points_spent) on public.club_bookings to authenticated;

create or replace function public.club_bookings_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base      numeric(10,2);
  v_pct       smallint;
  v_wanted    integer := greatest(0, coalesce(new.loyalty_points_spent, 0));
  v_cap_pct   smallint := 0;
  v_point_val numeric(10,4);
  v_balance   integer := 0;
  v_used      integer := 0;
  v_off       numeric(10,2) := 0;
  v_payable   numeric(10,2);
begin
  select coalesce(s.table_booking_price, 5.00), coalesce(s.price_currency, 'GBP')
    into v_base, new.price_currency
    from public.club_booking_settings s where s.club_id = new.club_id;
  v_base := coalesce(v_base, 5.00);
  new.price_currency := coalesce(new.price_currency, 'GBP');

  -- Already handles waiveGameBookingFee by returning 100, which is what the
  -- client means by "pay as you play does not apply to members".
  v_pct := public.booking_discount_percent(new.club_id, new.booked_by);

  new.base_price            := v_base;
  new.tier_discount_percent := v_pct;
  new.tier_discount_amount  := round(v_base * v_pct / 100.0, 2);
  v_payable                 := greatest(v_base - new.tier_discount_amount, 0);

  select m.tier_key, coalesce(t.label, '')
    into new.membership_tier_key, new.membership_tier_label
    from public.club_memberships m
    left join public.club_membership_tiers t
      on t.club_id = m.club_id and t.tier_key = m.tier_key
   where m.club_id = new.club_id and m.profile_id = new.booked_by and m.status = 'approved'
   limit 1;
  new.membership_tier_label := coalesce(new.membership_tier_label, '');

  if v_wanted > 0 then
    select coalesce(least(100, greatest(0,
             (t.benefits ->> 'loyaltyRedemptionCapPercent')::smallint)), 0)
      into v_cap_pct
      from public.club_memberships m
      join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = new.club_id and m.profile_id = new.booked_by
       and m.status = 'approved'
     limit 1;

    select s.point_value into v_point_val
      from public.club_loyalty_settings s
     where s.club_id = new.club_id and s.enabled;

    if v_point_val is null or v_point_val <= 0 or coalesce(v_cap_pct, 0) <= 0 then
      raise exception 'NO_REDEMPTION' using errcode = 'check_violation';
    end if;

    select coalesce(sum(l.available_delta), 0) into v_balance
      from public.club_loyalty_transactions l
     where l.club_id = new.club_id and l.profile_id = new.booked_by;

    if v_wanted > v_balance then
      raise exception 'NOT_ENOUGH_POINTS' using errcode = 'check_violation';
    end if;

    -- A booking a member's tier has already made free has nothing left to take
    -- points off, and saying so beats silently spending none.
    v_used := least(v_wanted, floor(round(v_payable * v_cap_pct / 100.0, 2) / v_point_val)::integer);
    if v_used <= 0 then
      raise exception 'OVER_REDEMPTION_CAP' using errcode = 'check_violation';
    end if;
    v_off := round(v_used * v_point_val, 2);
  end if;

  new.loyalty_points_spent    := v_used;
  new.loyalty_discount_amount := v_off;
  new.total_price             := greatest(v_payable - v_off, 0);

  return new;
end;
$$;

-- The guard keeps doing everything else; the pricing half moves out so the two
-- can be read separately.
create or replace function public.club_bookings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot public.club_sessions%rowtype;
  cap  integer;
begin
  select * into slot from public.club_sessions s where s.id = new.club_session_id;
  if slot.id is null or slot.club_id <> new.club_id then
    raise exception 'BOOKING_SESSION_NOT_FOUND' using errcode = 'check_violation';
  end if;

  if nullif(btrim(slot.day), '') is not null
     and lower(btrim(slot.day)) <> lower(btrim(to_char(new.session_date, 'Day'))) then
    raise exception 'BOOKING_SESSION_WRONG_DAY' using errcode = 'check_violation';
  end if;

  if new.session_date < public.london_today() then
    raise exception 'BOOKING_SESSION_PAST' using errcode = 'check_violation';
  end if;

  select coalesce(c.tables_available, 0) into cap from public.clubs c where c.id = new.club_id;
  if cap <= 0 then
    raise exception 'BOOKING_CLOSED' using errcode = 'check_violation';
  end if;

  if new.table_index < 0 then
    select min(g.i) into new.table_index
      from generate_series(0, cap - 1) as g(i)
     where not exists (
       select 1 from public.club_bookings b
        where b.club_session_id = new.club_session_id
          and b.session_date    = new.session_date
          and b.status          = 'booked'
          and b.table_index     = g.i);
  end if;
  if new.table_index is null or new.table_index >= cap then
    raise exception 'BOOKING_NO_TABLES' using errcode = 'check_violation';
  end if;

  new.session_day   := coalesce(nullif(new.session_day,   ''), slot.day);
  new.session_time  := coalesce(nullif(new.session_time,  ''), slot.time);
  new.session_label := coalesce(nullif(new.session_label, ''), slot.label);
  new.legacy_session_key := coalesce(new.legacy_session_key,
                                     new.session_date::text || '__' || slot.position::text);

  return new;
end;
$$;

drop trigger if exists club_bookings_price on public.club_bookings;
create trigger club_bookings_price
  before insert on public.club_bookings
  for each row execute function public.club_bookings_price();

-- --------------------------------------------------------------- the ledger

-- Trigger names decide the order BEFORE triggers run, and `guard` sorts before
-- `price`, so validation still happens first and pricing sees a booking that is
-- already known to be legal.

create or replace function public.club_bookings_award_loyalty()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_base    integer;
  v_key     text := 'booking:' || new.id;
  v_awarded integer;
begin
  -- Points spent are recorded whether or not the club awards anything for a
  -- booking: taking them is a separate fact from earning them.
  if tg_op = 'INSERT' and new.status = 'booked'
     and coalesce(new.loyalty_points_spent, 0) > 0 then
    insert into public.club_loyalty_transactions
      (club_id, profile_id, kind, category, description,
       available_delta, lifetime_delta, money_amount, source_key)
    values
      (new.club_id, new.booked_by, 'spent', 'game-booking',
       'Points off a table booking',
       -new.loyalty_points_spent, 0, new.loyalty_discount_amount,
       v_key || '::redeemed')
    on conflict (club_id, source_key) do nothing;
  end if;

  select coalesce((s.milestones ->> 'gameBooking')::integer, 0)
    into v_base from public.club_loyalty_settings s
   where s.club_id = new.club_id and s.enabled;

  if tg_op = 'INSERT' and new.status = 'booked' and coalesce(v_base, 0) > 0 then
    perform public.award_loyalty(
      new.club_id, new.booked_by, 'game-booking',
      'Table booked', v_base, v_key);
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status = 'booked' then
    -- Deduct what was actually given, read back from the row, not the base
    -- milestone recomputed. Since 0042 an award is (base + bonus) x multiplier,
    -- so a Premium member earned 20 and this used to claw back 5.
    select available_delta into v_awarded
      from public.club_loyalty_transactions
     where club_id = new.club_id and source_key = v_key;

    if coalesce(v_awarded, 0) > 0 then
      insert into public.club_loyalty_transactions
        (club_id, profile_id, kind, category, description,
         available_delta, lifetime_delta, source_key)
      values
        (new.club_id, new.booked_by, 'cancelled', 'game-booking',
         'Table booking cancelled', -v_awarded, -v_awarded, v_key || '::cancelled')
      on conflict (club_id, source_key) do nothing;
    end if;

    -- Points spent on a game that never happened come back. Available only:
    -- they were never added to lifetime when they were spent.
    if coalesce(old.loyalty_points_spent, 0) > 0 then
      insert into public.club_loyalty_transactions
        (club_id, profile_id, kind, category, description,
         available_delta, lifetime_delta, money_amount, source_key)
      values
        (new.club_id, new.booked_by, 'refunded', 'game-booking',
         'Points returned from a cancelled booking',
         old.loyalty_points_spent, 0, old.loyalty_discount_amount,
         v_key || '::refunded')
      on conflict (club_id, source_key) do nothing;
    end if;
  end if;

  return new;
end;
$function$;
