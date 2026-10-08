/**
 * Loyalty points towards coaching, and the coaching discount a tier already
 * advertises.
 *
 * The client's words: "A member should be able to use loyalty points as payment
 * for either table bookings, coaching, events or merchandise. This does not
 * look to be in place for all of these." Table bookings have taken points since
 * 0043, event tickets since 0050 and merchandise since 0038. Coaching is the
 * one that never did, and the reason is a layer underneath: **a coaching
 * booking carries no money at all.** It has a `payment_status` and nothing to
 * apply it to.
 *
 * So this is two things, in the order they have to happen:
 *
 * 1. **A coaching booking is priced.** The slot's price has always been free
 *    text ("GBP 10"), so `price_from_text` reads it once, in SQL, and the
 *    booking freezes what it was worth on the day. A price that moves later
 *    must not re-price a session somebody has already booked.
 *
 * 2. **`coachingDiscountPercent` finally does something.** It is in
 *    `tier-benefits.ts`, it is on the tier comparison every club shows its
 *    members, and nothing in the app has ever applied it. A club could sell
 *    "10% off coaching" and charge full price. `coaching_discount_percent`
 *    mirrors `booking_discount_percent` (0014) exactly.
 *
 * Then points, in the shape 0043 set: the member may name
 * `loyalty_points_spent` and nothing else about the money. The trigger reads
 * the balance, applies the tier's redemption cap and writes every figure
 * itself, so nothing the browser sends reaches the price. The ledger is an
 * AFTER trigger with a `source_key`, so booking twice cannot spend twice, and
 * cancelling gives the points back.
 *
 * **No award for booking coaching.** The four milestones legacy has are
 * joining, a table, an event and merchandise (`MILESTONE_FIELDS`); coaching is
 * not one of them, so this spends points and never mints them.
 *
 * Trigger names decide the order BEFORE triggers run, and `capacity` sorts
 * before `price`, so a booking is known to be legal before it is priced. That
 * is the same ordering trick 0043 relies on.
 *
 * Checked on a throwaway Postgres built from every migration with
 * supabase/tests/stage12-coaching-points.sql.
 */

-- ---------------------------------------------------------------- the price

/**
 * A money figure out of whatever a club typed.
 *
 * Slot prices are free text and the data has "GBP 10", "£10", "10" and "Free"
 * in it. Anything that is not a number is nothing to pay, which is the honest
 * reading of "Free" and of a blank: a club that has not said a price is not
 * charging through this app.
 *
 * Immutable and tiny on purpose: it is called once per booking and it must
 * give the same answer every time, because the booking freezes what it says.
 */
create or replace function public.price_from_text(p_raw text)
returns numeric(10,2)
language sql
immutable
as $$
  select coalesce(
    nullif(regexp_replace(coalesce(p_raw, ''), '[^0-9.]', '', 'g'), '')::numeric(10,2),
    0)::numeric(10,2);
$$;

comment on function public.price_from_text(text) is
  'Reads a free-text price like "GBP 10" into a number. Anything unparseable is 0.';

/**
 * What this member's tier takes off coaching.
 *
 * `booking_discount_percent` (0014) for the other half of the club. Written out
 * rather than parameterised on the benefit key, because the booking one also
 * folds in `waiveGameBookingFee` and coaching has no equivalent; one function
 * with a branch for that would read worse than two that each say one thing.
 */
create or replace function public.coaching_discount_percent(
  target_club bigint, target_profile uuid)
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select least(100, greatest(0,
             coalesce((t.benefits ->> 'coachingDiscountPercent')::numeric, 0)))
      from public.club_memberships m
      join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = target_club
       and m.profile_id = target_profile
       and m.status = 'approved'
       and m.tier_key is not null
     limit 1
  ), 0)::smallint;
$$;

revoke all on function public.coaching_discount_percent(bigint, uuid) from public, anon;
grant execute on function public.coaching_discount_percent(bigint, uuid) to authenticated;

-- ------------------------------------------------------------- the columns

alter table public.club_coaching_bookings
  add column if not exists base_price              numeric(10,2) not null default 0,
  add column if not exists price_currency          text          not null default 'GBP',
  add column if not exists tier_discount_percent   smallint      not null default 0,
  add column if not exists tier_discount_amount    numeric(10,2) not null default 0,
  add column if not exists loyalty_points_spent    integer       not null default 0,
  add column if not exists loyalty_discount_amount numeric(10,2) not null default 0,
  add column if not exists total_price             numeric(10,2) not null default 0;

alter table public.club_coaching_bookings
  drop constraint if exists club_coaching_bookings_points_not_negative;
alter table public.club_coaching_bookings
  add constraint club_coaching_bookings_points_not_negative
  check (loyalty_points_spent >= 0);

-- The one money column a member may name. Everything else is written by the
-- trigger and stays ungranted, which is the rule 0043 set for a table booking.
grant insert (loyalty_points_spent) on public.club_coaching_bookings to authenticated;

-- -------------------------------------------------------------- the pricing

create or replace function public.club_coaching_bookings_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot      public.club_coaching_slots%rowtype;
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
  -- A cancelled row being written for any other reason keeps its figures.
  if new.status <> 'booked' then
    return new;
  end if;

  select * into v_slot from public.club_coaching_slots where id = new.slot_id;
  if v_slot.id is null then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'check_violation';
  end if;

  v_base := public.price_from_text(v_slot.price);
  v_pct  := public.coaching_discount_percent(v_slot.club_id, new.profile_id);

  new.base_price            := v_base;
  new.price_currency        := 'GBP';
  new.tier_discount_percent := v_pct;
  new.tier_discount_amount  := round(v_base * v_pct / 100.0, 2);
  v_payable                 := greatest(v_base - new.tier_discount_amount, 0);

  if v_wanted > 0 then
    -- A free session, or one the member's tier has already made free, has
    -- nothing to take points off. Said rather than silently spending none.
    if v_payable <= 0 then
      raise exception 'NOTHING_TO_PAY' using errcode = 'check_violation';
    end if;

    select coalesce(least(100, greatest(0,
             (t.benefits ->> 'loyaltyRedemptionCapPercent')::smallint)), 0)
      into v_cap_pct
      from public.club_memberships m
      join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = v_slot.club_id and m.profile_id = new.profile_id
       and m.status = 'approved'
     limit 1;

    select s.point_value into v_point_val
      from public.club_loyalty_settings s
     where s.club_id = v_slot.club_id and s.enabled;

    if v_point_val is null or v_point_val <= 0 or coalesce(v_cap_pct, 0) <= 0 then
      raise exception 'NO_REDEMPTION' using errcode = 'check_violation';
    end if;

    select coalesce(sum(l.available_delta), 0) into v_balance
      from public.club_loyalty_transactions l
     where l.club_id = v_slot.club_id and l.profile_id = new.profile_id;

    if v_wanted > v_balance then
      raise exception 'NOT_ENOUGH_POINTS' using errcode = 'check_violation';
    end if;

    v_used := least(v_wanted,
                    floor(round(v_payable * v_cap_pct / 100.0, 2) / v_point_val)::integer);
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

revoke all on function public.club_coaching_bookings_price() from public, anon, authenticated;

drop trigger if exists club_coaching_bookings_price on public.club_coaching_bookings;
create trigger club_coaching_bookings_price
  before insert on public.club_coaching_bookings
  for each row execute function public.club_coaching_bookings_price();

-- --------------------------------------------------------------- the ledger

/**
 * Spending on the way in, and the refund on the way out.
 *
 * `source_key` is unique per club, so this is idempotent: a retry writes one
 * row. Points come back on a cancellation against `available` only, because
 * they were never added to `lifetime` when they were spent. Spending must
 * never demote anybody, which is why the ledger carries two deltas at all.
 */
create or replace function public.club_coaching_bookings_loyalty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club bigint;
  v_key  text := 'coaching:' || new.id;
begin
  select club_id into v_club from public.club_coaching_slots where id = new.slot_id;
  if v_club is null then
    return new;
  end if;

  if tg_op = 'INSERT' and new.status = 'booked'
     and coalesce(new.loyalty_points_spent, 0) > 0 then
    insert into public.club_loyalty_transactions
      (club_id, profile_id, kind, category, description,
       available_delta, lifetime_delta, money_amount, source_key)
    values
      (v_club, new.profile_id, 'spent', 'coaching-booking',
       'Points off a coaching session',
       -new.loyalty_points_spent, 0, new.loyalty_discount_amount,
       v_key || '::redeemed')
    on conflict (club_id, source_key) do nothing;
  end if;

  if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status = 'booked'
     and coalesce(old.loyalty_points_spent, 0) > 0 then
    insert into public.club_loyalty_transactions
      (club_id, profile_id, kind, category, description,
       available_delta, lifetime_delta, money_amount, source_key)
    values
      (v_club, new.profile_id, 'refunded', 'coaching-booking',
       'Points returned from a cancelled coaching session',
       old.loyalty_points_spent, 0, old.loyalty_discount_amount,
       v_key || '::refunded')
    on conflict (club_id, source_key) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.club_coaching_bookings_loyalty() from public, anon, authenticated;

drop trigger if exists club_coaching_bookings_loyalty on public.club_coaching_bookings;
create trigger club_coaching_bookings_loyalty
  after insert or update on public.club_coaching_bookings
  for each row execute function public.club_coaching_bookings_loyalty();
