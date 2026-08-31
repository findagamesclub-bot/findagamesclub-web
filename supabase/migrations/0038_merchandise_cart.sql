-- 0038 · Ordering more than one thing at a time
--
-- The shop could only ever order a single item: place_merchandise_order takes
-- one id and one quantity, so buying a shirt and a jumper meant two orders and
-- the club chasing two payments. The order tables were always multi-line
-- (club_merchandise_order_items exists and is priced per line), so this adds
-- the function that fills them properly.
--
-- Every number is worked out here, never sent by the browser. The anon key is
-- public, so anyone can reach PostgREST with their own token: a discount the
-- browser can name is a discount the browser can choose.

-- "£15" and "GBP 15" and "15" all mean fifteen pounds. "Pay what you can"
-- means nothing numeric, and must come out as zero rather than an error.
-- Same rule as amountOf() in utils/cart-pricing.ts.
create or replace function public.merch_price_amount(raw text)
returns numeric
language sql
immutable
as $$
  select coalesce(nullif(regexp_replace(coalesce(raw, ''), '[^0-9.]', '', 'g'), '')::numeric, 0);
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
  club_count int;
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

  -- The bag, cleaned up. Quantities are clamped here as well as in the browser
  -- because this function is the only thing standing between the table and a
  -- hand-written request.
  create temporary table if not exists bag_lines (
    item_id bigint primary key,
    quantity int not null
  ) on commit drop;
  delete from bag_lines;

  insert into bag_lines (item_id, quantity)
  select (entry->>'itemId')::bigint,
         greatest(1, least(20, coalesce((entry->>'quantity')::int, 1)))
    from jsonb_array_elements(coalesce(lines, '[]'::jsonb)) as entry
   where (entry->>'itemId') ~ '^[0-9]+$'
  on conflict (item_id) do update set quantity = excluded.quantity;

  if not exists (select 1 from bag_lines) then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  -- One club per order. Two clubs' kit in one bag would need two owners to
  -- fulfil it and two payments to settle it.
  select count(distinct i.club_id), min(i.club_id)
    into club_count, target_club
    from public.club_merchandise_items i
    join bag_lines b on b.item_id = i.id;

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
      join bag_lines b on b.item_id = i.id
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
    loyalty_points_spent, loyalty_discount, total
  ) values (
    target_club, buyer, 'placed', left(coalesce(note, ''), 2000),
    tier_key_held, tier_label_held,
    subtotal_amount, discount_percent, discount_total,
    points_used, points_value_off, greatest(payable - points_value_off, 0)
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
      join bag_lines b on b.item_id = i.id
  )
  select new_order, id, name, price, quantity,
         unit_amount, unit_discount,
         round(greatest(unit_amount - unit_discount, 0) * quantity, 2)
    from priced;

  update public.club_merchandise_items i
     set stock = greatest(i.stock - b.quantity, 0)
    from bag_lines b
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

revoke all on function public.place_merchandise_cart_order(jsonb, text, integer) from public, anon;
grant execute on function public.place_merchandise_cart_order(jsonb, text, integer) to authenticated;
