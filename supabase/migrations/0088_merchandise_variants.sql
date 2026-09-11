-- 0088 · Merchandise in sizes
--
-- The client asked for sizes. A shirt is one item with one price and several
-- sizes, each with its own stock, and legacy has no concept of it: one item,
-- one number.
--
-- Stock moves down a level. `club_merchandise_variants` holds it, and the
-- item's own `stock` becomes the sum of its variants, maintained by a trigger
-- so every existing reader keeps working without knowing anything changed. The
-- shop card, the order list, the owner inbox and the emails all still read
-- `items.stock` and still get the right number.
--
-- Every item that exists today gets one variant with an empty label, carrying
-- the stock it already had. An empty label means "no sizes", so a club that
-- sells one of something never sees the idea at all.
--
-- The checkout locks and decrements the variant rather than the item. That is
-- the whole point of the change: two people buying the last medium at the same
-- moment have to contend for the same row, and locking the item would let both
-- through.

-- -------------------------------------------------------------------- table

create table if not exists public.club_merchandise_variants (
  id       bigint generated always as identity primary key,
  item_id  bigint not null references public.club_merchandise_items (id) on delete cascade,
  -- '' is the item itself, unsized. Anything else is a size or a colourway.
  label    text    not null default '',
  sku      text    not null default '',
  stock    integer not null default 0 check (stock >= 0),
  active   boolean not null default true,
  position smallint not null default 0,
  constraint club_merchandise_variants_one_label unique (item_id, label)
);

create index if not exists club_merchandise_variants_item_idx
  on public.club_merchandise_variants (item_id, position);

alter table public.club_merchandise_variants enable row level security;

revoke insert, update, delete on public.club_merchandise_variants from authenticated, anon;

-- Read by anybody who can see the shop, which is the club's own page.
drop policy if exists club_merchandise_variants_read on public.club_merchandise_variants;
create policy club_merchandise_variants_read on public.club_merchandise_variants
  for select to anon, authenticated using (true);

drop policy if exists club_merchandise_variants_write on public.club_merchandise_variants;
create policy club_merchandise_variants_write on public.club_merchandise_variants
  for all to authenticated
  using (exists (
    select 1 from public.club_merchandise_items i
     where i.id = item_id and public.club_can(i.club_id, 'shop.manage')))
  with check (exists (
    select 1 from public.club_merchandise_items i
     where i.id = item_id and public.club_can(i.club_id, 'shop.manage')));

grant select on public.club_merchandise_variants to anon, authenticated;
grant insert (item_id, label, sku, stock, active, position),
      update (label, sku, stock, active, position)
  on public.club_merchandise_variants to authenticated;
grant delete on public.club_merchandise_variants to authenticated;

-- ----------------------------------------------------------------- backfill

insert into public.club_merchandise_variants (item_id, label, sku, stock, active, position)
select i.id, '', '', greatest(coalesce(i.stock, 0), 0), true, 0
  from public.club_merchandise_items i
 where not exists (
   select 1 from public.club_merchandise_variants v where v.item_id = i.id)
on conflict (item_id, label) do nothing;

-- ------------------------------------------------------- the item's own total

/**
 * Keep `items.stock` equal to the sum of its variants.
 *
 * Every reader in the app still asks the item how many are left, and none of
 * them should have to learn about sizes to get an answer.
 */
create or replace function public.club_merchandise_sync_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target bigint := coalesce(new.item_id, old.item_id);
begin
  update public.club_merchandise_items i
     set stock = coalesce((
       select sum(v.stock) from public.club_merchandise_variants v
        where v.item_id = target and v.active), 0)
   where i.id = target;
  return null;
end;
$$;

drop trigger if exists club_merchandise_variants_stock on public.club_merchandise_variants;
create trigger club_merchandise_variants_stock
  after insert or update or delete on public.club_merchandise_variants
  for each row execute function public.club_merchandise_sync_stock();

/**
 * Every item has at least one variant, from the moment it exists.
 *
 * The backfill above only fixes the items that were already here. Without this
 * an item added tomorrow would have no variant, and a bag naming it would
 * resolve to nothing and refuse to sell it. The default carries whatever stock
 * the item was created with, so a club that never touches sizes cannot tell
 * the difference.
 */
create or replace function public.club_merchandise_default_variant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.club_merchandise_variants (item_id, label, sku, stock, active, position)
  values (new.id, '', '', greatest(coalesce(new.stock, 0), 0), true, 0)
  on conflict (item_id, label) do nothing;
  return null;
end;
$$;

drop trigger if exists club_merchandise_items_default_variant on public.club_merchandise_items;
create trigger club_merchandise_items_default_variant
  after insert on public.club_merchandise_items
  for each row execute function public.club_merchandise_default_variant();

-- ------------------------------------------------------------- order lines

alter table public.club_merchandise_order_items
  add column if not exists variant_id bigint
    references public.club_merchandise_variants (id) on delete set null,
  add column if not exists variant_label text not null default '';

-- --------------------------------------------------------------- the bag

/**
 * A bag line now names a size as well as an item.
 *
 * When it does not, and the item has exactly one size, that one is meant: every
 * item that existed before this migration has exactly one, so nothing that
 * worked yesterday needs changing. An item with several sizes and no size named
 * resolves to nothing, and the checkout refuses it rather than guessing.
 *
 * Dropped rather than replaced because the returned row gains a column, and
 * `stable` rather than `immutable` because it now reads a table.
 */
drop function if exists public.merch_bag_lines(jsonb);

create function public.merch_bag_lines(lines jsonb)
returns table(item_id bigint, variant_id bigint, quantity integer)
language sql
stable
as $$
  with asked as (
    select (entry->>'itemId')::bigint as want_item,
           nullif(btrim(coalesce(entry->>'variantId', '')), '')::bigint as want_variant,
           -- Deduped, because a hand-built request can name the same size
           -- twice, and clamped, because it can ask for a thousand of them.
           max(greatest(1, least(20, coalesce((entry->>'quantity')::int, 1))))::int as want_quantity
      from jsonb_array_elements(coalesce(lines, '[]'::jsonb)) as entry
     where (entry->>'itemId') ~ '^[0-9]+$'
     group by 1, 2
  )
  select a.want_item,
         coalesce(
           (select v.id from public.club_merchandise_variants v
             where v.id = a.want_variant and v.item_id = a.want_item and v.active),
           -- The only one, if there is exactly one. `having` with no group by
           -- makes the whole subquery return nothing when there are two, so an
           -- item with sizes and no size named comes back null.
           (select max(v.id) from public.club_merchandise_variants v
             where v.item_id = a.want_item and v.active
             having count(*) = 1)
         ),
         a.want_quantity
    from asked a;
$$;

-- ------------------------------------------------------------------ checkout

CREATE OR REPLACE FUNCTION public.place_merchandise_cart_order(lines jsonb, note text DEFAULT ''::text, redeem integer DEFAULT 0)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- A line whose size did not resolve: either it named one this item does not
  -- have, or it named none for an item that has several. Its own error, because
  -- "choose a size" and "that size has sold out" are different problems and the
  -- person reading them can only fix one of them.
  if exists (select 1 from public.merch_bag_lines(lines) b where b.variant_id is null) then
    raise exception 'VARIANT_REQUIRED';
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
    select i.id, i.name, i.price, i.active, i.minimum_tier_key, b.quantity,
           v.id as variant_id, v.label as variant_label,
           v.stock as variant_stock, v.active as variant_active
      from public.club_merchandise_items i
      join public.merch_bag_lines(lines) b on b.item_id = i.id
      -- Inner, not outer: `for update` cannot lock the nullable side of an
      -- outer join, and the unresolved case is caught before the loop instead.
      join public.club_merchandise_variants v on v.id = b.variant_id
     where i.club_id = v_target_club
     order by i.id
     -- The variant is what gets decremented, so the variant is what is locked.
     -- Locking the item would let two people take the last medium at once.
     for update of i, v
  loop
    if not v_item.active then
      raise exception 'ITEM_NOT_FOUND';
    end if;
    if not v_item.variant_active then
      raise exception 'SOLD_OUT';
    end if;
    if v_item.variant_stock <= 0 then
      raise exception 'SOLD_OUT';
    end if;
    if v_item.variant_stock < v_item.quantity then
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
    order_id, item_id, name, price, quantity, unit_amount, discount_amount, line_total,
    variant_id, variant_label
  )
  with priced as (
    select i.id as line_item,
           i.name as line_name,
           i.price as line_price,
           b.quantity as line_quantity,
           public.merch_price_amount(i.price) as line_unit,
           round(public.merch_price_amount(i.price) * v_discount_percent / 100.0, 2) as line_off,
           b.variant_id as line_variant,
           v.label as line_variant_label
      from public.club_merchandise_items i
      join public.merch_bag_lines(lines) b on b.item_id = i.id
      left join public.club_merchandise_variants v on v.id = b.variant_id
  )
  select v_new_order, line_item, line_name, line_price, line_quantity,
         line_unit, line_off,
         round(greatest(line_unit - line_off, 0) * line_quantity, 2),
         line_variant, line_variant_label
    from priced;

  -- The variant carries the stock now; the item's own figure is the sum of its
  -- variants and is maintained by a trigger, so it must not be written here.
  update public.club_merchandise_variants v
     set stock = greatest(v.stock - b.quantity, 0)
    from public.merch_bag_lines(lines) b
   where v.id = b.variant_id;

  -- The ledger, through the same two source keys the single-item function has
  -- always used, so one club never ends up with two naming schemes for the
  -- same event. Spending moves the balance and never the lifetime total:
  -- paying with points must not cost somebody their rank.
  if v_points_used > 0 then
    insert into public.club_loyalty_transactions
      (club_id, profile_id, kind, category, description,
       available_delta, lifetime_delta, money_amount, source_key)
    values
      (v_target_club, v_buyer, 'spent', 'merchandise-order',
       'Points off a club shop order', -v_points_used, 0, v_points_value_off,
       'merch:' || v_new_order || '::redeemed')
    on conflict (club_id, source_key) do nothing;
  end if;

  select coalesce((s.milestones ->> 'merchandisePurchase')::integer, 0) into v_earn_points
    from public.club_loyalty_settings s
   where s.club_id = v_target_club and s.enabled;

  -- Through award_loyalty rather than a direct insert, so the one place that
  -- decides what an award is worth stays the one place. Merchandise gets no
  -- tier multiplier there, which is legacy's rule, not an oversight.
  if coalesce(v_earn_points, 0) > 0 then
    perform public.award_loyalty(
      v_target_club, v_buyer, 'merchandise-order',
      'Placed a merchandise order', v_earn_points,
      'merch:' || v_new_order,
      greatest(v_payable - v_points_value_off, 0));
  end if;

  return v_new_order;
end;
$function$;
