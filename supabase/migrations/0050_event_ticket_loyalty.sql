-- 0050 · Loyalty points towards event tickets
--
-- The client's words: "member should be able to use loyalty points towards
-- payment for an event, if they are a member of that club, like we do for
-- table bookings and merchandise, if they are not a member of that club, they
-- cannot use loyalty points."
--
-- Legacy has done this since the beginning: checkout_event_tickets calls
-- _apply_loyalty_redemption with the subtotal after the tier discount
-- (club_store.py:2701), the same helper table bookings and merchandise use.
--
-- Three things, in the order they matter.
--
-- 1. Redemption at checkout, capped by the member's own tier. The membership
--    lookup is the client's rule: no approved row, no cap, no redemption.
--
-- 2. Earning. `award_loyalty` has carried an 'event-booking' category and a
--    bonusEventBookingPoints tier bonus since 0042, and both live clubs already
--    configure the milestone (Didcot pays 100 a ticket), but nothing ever
--    called it. Legacy has _record_event_booking_loyalty. Spending points on
--    events while never earning them there is half a feature.
--
-- 3. Refund and clawback on cancellation, mirroring 0043: points spent on an
--    event nobody attends come back, and the award is deducted at what was
--    actually given rather than at the bare milestone.
--
-- Every local is v_ prefixed. 0040 was written twice because a local named
-- after a column raised 42702 halfway through a definer function.

alter table public.club_event_bookings
  add column if not exists loyalty_points_spent integer not null default 0
    check (loyalty_points_spent >= 0),
  add column if not exists loyalty_discount_amount numeric(10,2) not null default 0
    check (loyalty_discount_amount >= 0);

-- ---------------------------------------------------------------------------
-- Checkout
-- ---------------------------------------------------------------------------

-- The old signature took the tier discount and the tier labels as arguments.
-- The service computed them honestly, but the function is granted to
-- `authenticated`, so anyone could call it over PostgREST naming their own
-- percentage. Now that this function also takes points off a total, everything
-- about the money is read from the database instead.
drop function if exists public.checkout_event_cart(bigint, text, text, text, smallint, text, text);

create or replace function public.checkout_event_cart(
  target_event bigint,
  buyer_name text,
  buyer_email text,
  booking_reference text,
  redeem integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := (select auth.uid());
  v_event      public.club_events%rowtype;
  v_booking    bigint;
  v_line       record;
  v_running    numeric(10,2) := 0;
  v_pct        smallint := 0;
  v_tier_key   text;
  v_tier_label text := '';
  v_discount   numeric(10,2) := 0;
  v_payable    numeric(10,2) := 0;
  v_wanted     integer := greatest(0, coalesce(redeem, 0));
  v_cap_pct    smallint := 0;
  v_point_val  numeric(10,4);
  v_balance    integer := 0;
  v_used       integer := 0;
  v_off        numeric(10,2) := 0;
begin
  if v_actor is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;

  select * into v_event from public.club_events where id = target_event;
  if v_event.id is null then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'check_violation';
  end if;
  if coalesce(v_event.end_date, v_event.start_date) < public.london_today() then
    raise exception 'EVENT_FINISHED' using errcode = 'check_violation';
  end if;

  -- The buyer's tier, and the discount it carries on event tickets. Read here
  -- rather than trusted from the caller.
  select m.tier_key,
         coalesce(t.label, ''),
         coalesce(least(100, greatest(0,
           (t.benefits ->> 'eventDiscountPercent')::smallint)), 0)
    into v_tier_key, v_tier_label, v_pct
    from public.club_memberships m
    left join public.club_membership_tiers t
      on t.club_id = m.club_id and t.tier_key = m.tier_key
   where m.club_id = v_event.club_id
     and m.profile_id = v_actor
     and m.status = 'approved'
   limit 1;

  v_pct        := coalesce(v_pct, 0);
  v_tier_label := coalesce(v_tier_label, '');

  insert into public.club_event_bookings
    (club_id, event_id, profile_id, full_name, email, reference,
     tier_discount_percent, membership_tier_key, membership_tier_label)
  values
    (v_event.club_id, target_event, v_actor, btrim(buyer_name),
     lower(btrim(buyer_email)), booking_reference, v_pct, v_tier_key, v_tier_label)
  returning id into v_booking;

  for v_line in
    select c.ticket_type_id, c.quantity, t.label, t.price
      from public.club_event_cart_items c
      join public.club_event_ticket_types t on t.id = c.ticket_type_id
     where c.profile_id = v_actor and c.event_id = target_event
     order by t.position
  loop
    -- Price is read from the ticket type, never from the client.
    insert into public.club_event_booking_items
      (booking_id, ticket_type_id, label, price, unit_amount, quantity)
    values
      (v_booking, v_line.ticket_type_id, v_line.label, coalesce(v_line.price, ''),
       coalesce(public.money_amount(v_line.price), 0), v_line.quantity);

    v_running := v_running + coalesce(public.money_amount(v_line.price), 0) * v_line.quantity;
  end loop;

  if not exists (select 1 from public.club_event_booking_items where booking_id = v_booking) then
    raise exception 'CART_EMPTY' using errcode = 'check_violation';
  end if;

  v_discount := round(v_running * v_pct / 100.0, 2);
  v_payable  := greatest(v_running - v_discount, 0);

  if v_wanted > 0 then
    -- The client's rule, enforced by the join: a member who is not approved at
    -- this club has no tier here, so no cap, so nothing to redeem with.
    select coalesce(least(100, greatest(0,
             (t.benefits ->> 'loyaltyRedemptionCapPercent')::smallint)), 0)
      into v_cap_pct
      from public.club_memberships m
      join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = v_event.club_id
       and m.profile_id = v_actor
       and m.status = 'approved'
     limit 1;

    select s.point_value into v_point_val
      from public.club_loyalty_settings s
     where s.club_id = v_event.club_id and s.enabled;

    if v_point_val is null or v_point_val <= 0 or coalesce(v_cap_pct, 0) <= 0 then
      raise exception 'NO_REDEMPTION' using errcode = 'check_violation';
    end if;

    select coalesce(sum(l.available_delta), 0) into v_balance
      from public.club_loyalty_transactions l
     where l.club_id = v_event.club_id and l.profile_id = v_actor;

    if v_wanted > v_balance then
      raise exception 'NOT_ENOUGH_POINTS' using errcode = 'check_violation';
    end if;

    -- A cart a tier has already made free has nothing left to take points off,
    -- and saying so beats silently spending none.
    v_used := least(v_wanted, floor(round(v_payable * v_cap_pct / 100.0, 2) / v_point_val)::integer);
    if v_used <= 0 then
      raise exception 'OVER_REDEMPTION_CAP' using errcode = 'check_violation';
    end if;
    v_off := round(v_used * v_point_val, 2);
  end if;

  update public.club_event_bookings
     set subtotal                = v_running,
         tier_discount_amount    = v_discount,
         loyalty_points_spent    = v_used,
         loyalty_discount_amount = v_off,
         total                   = greatest(v_payable - v_off, 0)
   where id = v_booking;

  delete from public.club_event_cart_items
   where profile_id = v_actor and event_id = target_event;

  return v_booking;
end;
$$;

revoke all on function public.checkout_event_cart(bigint, text, text, text, integer)
  from public, anon;
grant execute on function public.checkout_event_cart(bigint, text, text, text, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Earning, refund and clawback
-- ---------------------------------------------------------------------------

/**
 * The ledger side of an event booking.
 *
 * Same shape as club_bookings_award_loyalty (0043), deliberately: three ways of
 * writing the same ledger would be three ways of getting it wrong.
 *
 * Fires on the booking row rather than inside checkout so that a booking made
 * any other way still lands in the ledger, and so cancellation is caught by the
 * same function that awarded it.
 */
create or replace function public.club_event_bookings_award_loyalty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base    integer;
  v_key     text := 'event-booking:' || new.id;
  v_awarded integer;
begin
  -- A guest booking has nobody to credit. Legacy skips these the same way.
  if new.profile_id is null then
    return new;
  end if;

  -- Points spent are recorded whether or not the club awards anything for a
  -- ticket: taking them is a separate fact from earning them.
  --
  -- Caught on the update as well as the insert, because checkout cannot know
  -- the total until the lines are in, so it inserts the booking and prices it
  -- a statement later. An INSERT-only test saw loyalty_points_spent at its
  -- default 0, wrote no `spent` row, and quietly gave the discount away free.
  if new.status = 'reserved'
     and coalesce(new.loyalty_points_spent, 0) > 0
     and (tg_op = 'INSERT' or coalesce(old.loyalty_points_spent, 0) = 0) then
    insert into public.club_loyalty_transactions
      (club_id, profile_id, kind, category, description,
       available_delta, lifetime_delta, money_amount, source_key)
    values
      (new.club_id, new.profile_id, 'spent', 'event-booking',
       'Points off event tickets',
       -new.loyalty_points_spent, 0, new.loyalty_discount_amount,
       v_key || '::redeemed')
    on conflict (club_id, source_key) do nothing;
  end if;

  select coalesce((s.milestones ->> 'eventBooking')::integer, 0)
    into v_base from public.club_loyalty_settings s
   where s.club_id = new.club_id and s.enabled;

  if tg_op = 'INSERT' and new.status = 'reserved' and coalesce(v_base, 0) > 0 then
    -- award_loyalty adds the tier's bonusEventBookingPoints and applies the
    -- earn multiplier; the milestone is only the base.
    perform public.award_loyalty(
      new.club_id, new.profile_id, 'event-booking',
      'Event tickets booked', v_base, v_key);
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status = 'reserved' then
    -- Deduct what was actually given, read back from the row rather than the
    -- milestone recomputed: since 0042 an award is (base + bonus) x multiplier,
    -- and clawing back the bare base mints points on a book/cancel loop.
    select available_delta into v_awarded
      from public.club_loyalty_transactions
     where club_id = new.club_id and source_key = v_key;

    if coalesce(v_awarded, 0) > 0 then
      insert into public.club_loyalty_transactions
        (club_id, profile_id, kind, category, description,
         available_delta, lifetime_delta, source_key)
      values
        (new.club_id, new.profile_id, 'cancelled', 'event-booking',
         'Event booking cancelled', -v_awarded, -v_awarded, v_key || '::cancelled')
      on conflict (club_id, source_key) do nothing;
    end if;

    -- Points spent on an event nobody attends come back. Available only: they
    -- were never added to lifetime when they were spent.
    if coalesce(old.loyalty_points_spent, 0) > 0 then
      insert into public.club_loyalty_transactions
        (club_id, profile_id, kind, category, description,
         available_delta, lifetime_delta, money_amount, source_key)
      values
        (new.club_id, new.profile_id, 'refunded', 'event-booking',
         'Points returned from a cancelled event booking',
         old.loyalty_points_spent, 0, old.loyalty_discount_amount,
         v_key || '::refunded')
      on conflict (club_id, source_key) do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists club_event_bookings_loyalty on public.club_event_bookings;
create trigger club_event_bookings_loyalty
  after insert or update on public.club_event_bookings
  for each row execute function public.club_event_bookings_award_loyalty();
