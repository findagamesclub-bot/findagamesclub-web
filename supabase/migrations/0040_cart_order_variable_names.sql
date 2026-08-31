-- 0040 · Names that cannot be mistaken for columns
--
-- 0039 still failed, with 42702: "column reference unit_amount is ambiguous".
-- The local variables unit_amount and unit_discount have the same names as the
-- columns of the CTE that prices the order lines, and plpgsql cannot tell which
-- one the INSERT means.
--
-- Exactly the bug that migration 0029 fixed in notify_person, where parameters
-- called kind, title and body collided with the columns being inserted. Every
-- local in here now carries a v_ prefix, so the class is closed rather than the
-- instance.

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
  v_buyer uuid := auth.uid();
  v_club_count int;
  v_target_club bigint;
  v_tier_key_held text;
  v_tier_label_held text;
  v_tier_position_held int;
  v_tier_benefits jsonb;
  v_discount_percent int;
  v_cap_percent int;
  v_point_value numeric;
  v_balance int;
  v_earn_points int;
  v_item record;
  v_unit_amount numeric;
  v_unit_discount numeric;
  v_subtotal_amount numeric := 0;
  v_discount_total numeric := 0;
  v_payable numeric := 0;
  v_points_used int := 0;
  v_points_value_off numeric := 0;
  v_new_order bigint;
begin
  if v_buyer is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  if not exists (select 1 from public.merch_bag_lines(lines)) then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  -- One club per order. Two clubs' kit in one bag would need two owners to
  -- fulfil it and two payments to settle it.
  select count(distinct i.club_id), min(i.club_id)
    into v_club_count, v_target_club
    from public.club_merchandise_items i
    join public.merch_bag_lines(lines) b on b.item_id = i.id;

  if coalesce(v_club_count, 0) <> 1 then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.club_memberships m
     where m.club_id = v_target_club and m.profile_id = v_buyer and m.status = 'approved'
  ) then
    raise exception 'MEMBERS_ONLY';
  end if;

  select t.tier_key, t.tier_label, t.tier_position, t.benefits
    into v_tier_key_held, v_tier_label_held, v_tier_position_held, v_tier_benefits
    from public.member_tier(v_target_club, v_buyer) t;

  if coalesce((v_tier_benefits->>'merchandiseAccess')::boolean, false) is not true then
    raise exception 'NO_MERCH_ACCESS';
  end if;

  v_discount_percent := least(100, greatest(0,
    coalesce((v_tier_benefits->>'merchandiseDiscountPercent')::int, 0)));
  v_cap_percent := least(100, greatest(0,
    coalesce((v_tier_benefits->>'loyaltyRedemptionCapPercent')::int, 0)));

  -- Locked in id order. Two people buying the last two jumpers take the rows in
  -- the same sequence, so one waits rather than both succeeding.
  for v_item in
    select i.id, i.name, i.price, i.stock, i.active, i.minimum_tier_key, b.quantity
      from public.club_merchandise_items i
      join public.merch_bag_lines(lines) b on b.item_id = i.id
     where i.club_id = v_target_club
     order by i.id
     for update of i
  loop
    if not v_item.active then
      raise exception 'ITEM_NOT_FOUND';
    end if;
    if v_item.stock <= 0 then
      raise exception 'SOLD_OUT';
    end if;
    if v_item.stock < v_item.quantity then
      raise exception 'NOT_ENOUGH_STOCK';
    end if;

    if v_item.minimum_tier_key is not null and v_item.minimum_tier_key <> '' then
      if coalesce(v_tier_position_held, -1) < coalesce((
        select mt.position from public.club_membership_tiers mt
         where mt.club_id = v_target_club and mt.tier_key = v_item.minimum_tier_key
      ), 0) then
        raise exception 'TIER_TOO_LOW';
      end if;
    end if;

    -- Pennies per unit before multiplying, matching legacy and the bag in the
    -- browser. Discounting the line total instead is a penny out on some
    -- quantities, and then the price shown is not the price charged.
    v_unit_amount := public.merch_price_amount(v_item.price);
    v_unit_discount := round(v_unit_amount * v_discount_percent / 100.0, 2);

    v_subtotal_amount := v_subtotal_amount + v_unit_amount * v_item.quantity;
    v_discount_total := v_discount_total + v_unit_discount * v_item.quantity;
    v_payable := v_payable + greatest(v_unit_amount - v_unit_discount, 0) * v_item.quantity;
  end loop;

  v_subtotal_amount := round(v_subtotal_amount, 2);
  v_discount_total := round(v_discount_total, 2);
  v_payable := round(v_payable, 2);

  -- Loyalty, if the club has made points spendable at all.
  if coalesce(redeem, 0) > 0 then
    select s.point_value into v_point_value
      from public.club_loyalty_settings s
     where s.club_id = v_target_club and s.enabled;

    if v_point_value is null or v_point_value <= 0 or v_cap_percent <= 0 then
      raise exception 'NO_REDEMPTION';
    end if;

    select coalesce(sum(l.available_delta), 0) into v_balance
      from public.club_loyalty_transactions l
     where l.club_id = v_target_club and l.profile_id = v_buyer;

    if redeem > v_balance then
      raise exception 'NOT_ENOUGH_POINTS';
    end if;

    v_points_used := least(redeem, floor(round(v_payable * v_cap_percent / 100.0, 2) / v_point_value)::int);
    if v_points_used <= 0 then
      raise exception 'OVER_REDEMPTION_CAP';
    end if;
    v_points_value_off := round(v_points_used * v_point_value, 2);
  end if;

  insert into public.club_merchandise_orders (
    club_id, profile_id, status, notes,
    membership_tier_key, membership_tier_label,
    subtotal, tier_discount_percent, tier_discount_amount,
    loyalty_points_spent, loyalty_discount, total, status_updated_at
  ) values (
    v_target_club, v_buyer, 'placed', left(coalesce(note, ''), 2000),
    v_tier_key_held, v_tier_label_held,
    v_subtotal_amount, v_discount_percent, v_discount_total,
    v_points_used, v_points_value_off, greatest(v_payable - v_points_value_off, 0), now()
  )
  returning id into v_new_order;

  -- The CTE's own columns are named line_* rather than after the columns they
  -- land in. Reusing the destination names is what made 0039 ambiguous.
  insert into public.club_merchandise_order_items (
    order_id, item_id, name, price, quantity, unit_amount, discount_amount, line_total
  )
  with priced as (
    select i.id as line_item,
           i.name as line_name,
           i.price as line_price,
           b.quantity as line_quantity,
           public.merch_price_amount(i.price) as line_unit,
           round(public.merch_price_amount(i.price) * v_discount_percent / 100.0, 2) as line_off
      from public.club_merchandise_items i
      join public.merch_bag_lines(lines) b on b.item_id = i.id
  )
  select v_new_order, line_item, line_name, line_price, line_quantity,
         line_unit, line_off,
         round(greatest(line_unit - line_off, 0) * line_quantity, 2)
    from priced;

  update public.club_merchandise_items i
     set stock = greatest(i.stock - b.quantity, 0)
    from public.merch_bag_lines(lines) b
   where i.id = b.item_id;

  -- The ledger. Two counters, never one: spending points lowers what is
  -- available and leaves lifetime alone, so paying with points cannot demote
  -- somebody's loyalty tier.
  if v_points_used > 0 then
    insert into public.club_loyalty_transactions (
      club_id, profile_id, kind, category, description,
      available_delta, lifetime_delta, money_amount, source_key
    ) values (
      v_target_club, v_buyer, 'spent', 'merchandise-order',
      'Redeemed loyalty points against merchandise',
      -v_points_used, 0, v_points_value_off, 'merch-order:' || v_new_order || '::spent'
    )
    on conflict do nothing;
  end if;

  select coalesce((s.milestones->>'merchandisePurchase')::int, 0) into v_earn_points
    from public.club_loyalty_settings s
   where s.club_id = v_target_club and s.enabled;

  if coalesce(v_earn_points, 0) > 0 then
    insert into public.club_loyalty_transactions (
      club_id, profile_id, kind, category, description,
      available_delta, lifetime_delta, source_key
    ) values (
      v_target_club, v_buyer, 'earned', 'merchandise-order',
      'Placed a merchandise order',
      v_earn_points, v_earn_points, 'merch-order:' || v_new_order || '::earned'
    )
    on conflict do nothing;
  end if;

  return v_new_order;
end;
$$;

revoke all on function public.merch_bag_lines(jsonb) from public, anon;
grant execute on function public.merch_bag_lines(jsonb) to authenticated;

revoke all on function public.place_merchandise_cart_order(jsonb, text, integer) from public, anon;
grant execute on function public.place_merchandise_cart_order(jsonb, text, integer) to authenticated;
