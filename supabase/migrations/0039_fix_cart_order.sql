-- 0039 · place_merchandise_cart_order, without the scratch table
--
-- 0038 collected the bag into a temporary table and cleared it with a bare
-- `delete from bag_lines`. Two things wrong with that:
--
--   * Supabase runs PostgREST sessions with pg_safeupdate, which refuses any
--     DELETE that has no WHERE clause. Every order failed with SQLSTATE 21000.
--   * A temporary table created inside plpgsql leaves cached plans pointing at
--     an OID that `on commit drop` has already taken away, so the second call
--     in a session fails even once the DELETE is fixed.
--
-- The bag is a list of at most twenty lines. It does not need a table.

create or replace function public.merch_bag_lines(lines jsonb)
returns table (item_id bigint, quantity int)
language sql
immutable
as $$
  select (entry->>'itemId')::bigint,
         -- Deduped, because a hand-built request can name the same item twice,
         -- and clamped, because it can ask for a thousand of them.
         max(greatest(1, least(20, coalesce((entry->>'quantity')::int, 1))))::int
    from jsonb_array_elements(coalesce(lines, '[]'::jsonb)) as entry
   where (entry->>'itemId') ~ '^[0-9]+$'
   group by (entry->>'itemId')::bigint;
$$;

create or replace function public.place_merchandise_cart_order(
  lines jsonb,
  note text default '',
  redeem integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  buyer uuid := auth.uid();
  club_count int;
  target_club bigint;
  tier_key_held text;
  tier_label_held text;
  tier_position_held int;
  tier_benefits jsonb;
  discount_percent int;
  cap_percent int;
  point_value numeric;
  balance int;
  earn_points int;
  item record;
  unit_amount numeric;
  unit_discount numeric;
  subtotal_amount numeric := 0;
  discount_total numeric := 0;
  payable numeric := 0;
  points_used int := 0;
  points_value_off numeric := 0;
  new_order bigint;
begin
  if buyer is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  if not exists (select 1 from public.merch_bag_lines(lines)) then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  -- One club per order. Two clubs' kit in one bag would need two owners to
  -- fulfil it and two payments to settle it.
  select count(distinct i.club_id), min(i.club_id)
    into club_count, target_club
    from public.club_merchandise_items i
    join public.merch_bag_lines(lines) b on b.item_id = i.id;

  if coalesce(club_count, 0) <> 1 then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.club_memberships m
     where m.club_id = target_club and m.profile_id = buyer and m.status = 'approved'
  ) then
    raise exception 'MEMBERS_ONLY';
  end if;

  select t.tier_key, t.tier_label, t.tier_position, t.benefits
    into tier_key_held, tier_label_held, tier_position_held, tier_benefits
    from public.member_tier(target_club, buyer) t;

  if coalesce((tier_benefits->>'merchandiseAccess')::boolean, false) is not true then
    raise exception 'NO_MERCH_ACCESS';
  end if;

  discount_percent := least(100, greatest(0,
    coalesce((tier_benefits->>'merchandiseDiscountPercent')::int, 0)));
  cap_percent := least(100, greatest(0,
    coalesce((tier_benefits->>'loyaltyRedemptionCapPercent')::int, 0)));

  -- Locked in id order. Two people buying the last two jumpers take the rows in
  -- the same sequence, so one waits rather than both succeeding.
  for item in
    select i.id, i.name, i.price, i.stock, i.active, i.minimum_tier_key, b.quantity
      from public.club_merchandise_items i
      join public.merch_bag_lines(lines) b on b.item_id = i.id
     where i.club_id = target_club
     order by i.id
     for update of i
  loop
    if not item.active then
      raise exception 'ITEM_NOT_FOUND';
    end if;
    if item.stock <= 0 then
      raise exception 'SOLD_OUT';
    end if;
    if item.stock < item.quantity then
      raise exception 'NOT_ENOUGH_STOCK';
    end if;

    if item.minimum_tier_key is not null and item.minimum_tier_key <> '' then
      if coalesce(tier_position_held, -1) < coalesce((
        select mt.position from public.club_membership_tiers mt
         where mt.club_id = target_club and mt.tier_key = item.minimum_tier_key
      ), 0) then
        raise exception 'TIER_TOO_LOW';
      end if;
    end if;

    -- Pennies per unit before multiplying, matching legacy and the bag in the
    -- browser. Discounting the line total instead is a penny out on some
    -- quantities, and then the price shown is not the price charged.
    unit_amount := public.merch_price_amount(item.price);
    unit_discount := round(unit_amount * discount_percent / 100.0, 2);

    subtotal_amount := subtotal_amount + unit_amount * item.quantity;
    discount_total := discount_total + unit_discount * item.quantity;
    payable := payable + greatest(unit_amount - unit_discount, 0) * item.quantity;
  end loop;

  subtotal_amount := round(subtotal_amount, 2);
  discount_total := round(discount_total, 2);
  payable := round(payable, 2);

  -- Loyalty, if the club has made points spendable at all.
  if coalesce(redeem, 0) > 0 then
    select s.point_value into point_value
      from public.club_loyalty_settings s
     where s.club_id = target_club and s.enabled;

    if point_value is null or point_value <= 0 or cap_percent <= 0 then
      raise exception 'NO_REDEMPTION';
    end if;

    select coalesce(sum(l.available_delta), 0) into balance
      from public.club_loyalty_transactions l
     where l.club_id = target_club and l.profile_id = buyer;

    if redeem > balance then
      raise exception 'NOT_ENOUGH_POINTS';
    end if;

    points_used := least(redeem, floor(round(payable * cap_percent / 100.0, 2) / point_value)::int);
    if points_used <= 0 then
      raise exception 'OVER_REDEMPTION_CAP';
    end if;
    points_value_off := round(points_used * point_value, 2);
  end if;

  insert into public.club_merchandise_orders (
    club_id, profile_id, status, notes,
    membership_tier_key, membership_tier_label,
    subtotal, tier_discount_percent, tier_discount_amount,
    loyalty_points_spent, loyalty_discount, total, status_updated_at
  ) values (
    target_club, buyer, 'placed', left(coalesce(note, ''), 2000),
    tier_key_held, tier_label_held,
    subtotal_amount, discount_percent, discount_total,
    points_used, points_value_off, greatest(payable - points_value_off, 0), now()
  )
  returning id into new_order;

  insert into public.club_merchandise_order_items (
    order_id, item_id, name, price, quantity, unit_amount, discount_amount, line_total
  )
  with priced as (
    select i.id, i.name, i.price, b.quantity,
           public.merch_price_amount(i.price) as unit_amount,
           round(public.merch_price_amount(i.price) * discount_percent / 100.0, 2) as unit_discount
      from public.club_merchandise_items i
      join public.merch_bag_lines(lines) b on b.item_id = i.id
  )
  select new_order, id, name, price, quantity,
         unit_amount, unit_discount,
         round(greatest(unit_amount - unit_discount, 0) * quantity, 2)
    from priced;

  update public.club_merchandise_items i
     set stock = greatest(i.stock - b.quantity, 0)
    from public.merch_bag_lines(lines) b
   where i.id = b.item_id;

  -- The ledger. Two counters, never one: spending points lowers what is
  -- available and leaves lifetime alone, so paying with points cannot demote
  -- somebody's loyalty tier.
  if points_used > 0 then
    insert into public.club_loyalty_transactions (
      club_id, profile_id, kind, category, description,
      available_delta, lifetime_delta, money_amount, source_key
    ) values (
      target_club, buyer, 'spent', 'merchandise-order',
      'Redeemed loyalty points against merchandise',
      -points_used, 0, points_value_off, 'merch-order:' || new_order || '::spent'
    )
    on conflict do nothing;
  end if;

  select coalesce((s.milestones->>'merchandisePurchase')::int, 0) into earn_points
    from public.club_loyalty_settings s
   where s.club_id = target_club and s.enabled;

  if coalesce(earn_points, 0) > 0 then
    insert into public.club_loyalty_transactions (
      club_id, profile_id, kind, category, description,
      available_delta, lifetime_delta, source_key
    ) values (
      target_club, buyer, 'earned', 'merchandise-order',
      'Placed a merchandise order',
      earn_points, earn_points, 'merch-order:' || new_order || '::earned'
    )
    on conflict do nothing;
  end if;

  return new_order;
end;
$$;

revoke all on function public.merch_bag_lines(jsonb) from public, anon;
grant execute on function public.merch_bag_lines(jsonb) to authenticated;

revoke all on function public.place_merchandise_cart_order(jsonb, text, integer) from public, anon;
grant execute on function public.place_merchandise_cart_order(jsonb, text, integer) to authenticated;
