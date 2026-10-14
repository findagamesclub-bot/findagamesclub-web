-- 0187 · who is on which tier, and what sells.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- Two tiers with the club's own labels, and a member on each.
insert into public.club_membership_tiers (club_id, tier_key, label)
  select id, 'basic', 'Basic Membership' from c;
insert into public.club_membership_tiers (club_id, tier_key, label)
  select id, 'gold', 'Gold Membership' from c;
update public.club_memberships set tier_key = 'gold'
  where profile_id = 'e0000000-0000-0000-0000-000000000001';

-- One member joined long ago, one inside the window, so "joined" is a real
-- subset of "members" rather than the same number twice.
update public.club_memberships set joined_at = public.london_today() - 400
  where profile_id = 'e0000000-0000-0000-0000-000000000003';
update public.club_memberships set joined_at = public.london_today() - 5
  where profile_id = 'e0000000-0000-0000-0000-000000000001';

-- Points for one of them and none for the other, which is what puts somebody
-- on the bottom rung rather than off the ladder.
insert into public.club_loyalty_transactions
  (club_id, profile_id, kind, category, description,
   available_delta, lifetime_delta, source_key)
  select id, 'e0000000-0000-0000-0000-000000000003', 'earned', 'membership-approved',
         'Joined', 600, 600, 'test::ladder' from c;

-- Something sold, and a coaching session that ran.
insert into public.club_merchandise_orders
  (club_id, profile_id, subtotal, total, status, created_at)
  select id, 'e0000000-0000-0000-0000-000000000003', 24.00, 24.00, 'paid',
         now() - interval '2 days' from c;
insert into public.club_merchandise_order_items
  (order_id, name, quantity, unit_amount, line_total)
  select o.id, 'Club T Shirt', 3, 8.00, 24.00
    from public.club_merchandise_orders o order by o.id desc limit 1;

-- A cancelled order, which must not reach the ranking.
insert into public.club_merchandise_orders
  (club_id, profile_id, subtotal, total, status, created_at)
  select id, 'e0000000-0000-0000-0000-000000000003', 99.00, 99.00, 'cancelled',
         now() - interval '2 days' from c;
insert into public.club_merchandise_order_items
  (order_id, name, quantity, unit_amount, line_total)
  select o.id, 'Never Sold', 20, 4.95, 99.00
    from public.club_merchandise_orders o order by o.id desc limit 1;

insert into public.club_coaching_slots
  (club_id, title, slot_date, start_time, price, capacity, status)
  select id, 'List clinic', public.london_today() + 7, '19:00', 'GBP 20.00', 4, 'open' from c;
select set_config('request.jwt.claims',
  json_build_object('sub', 'e0000000-0000-0000-0000-000000000003',
                    'role', 'authenticated')::text, true);
insert into public.club_coaching_bookings (slot_id, profile_id, status)
  select s.id, 'e0000000-0000-0000-0000-000000000003', 'booked'
    from public.club_coaching_slots s where s.title = 'List clinic';
select set_config('request.jwt.claims',
  json_build_object('sub', 'e0000000-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text, true);
update public.club_coaching_slots set slot_date = public.london_today() - 3
 where title = 'List clinic';

do $$
declare
  v_club bigint;
  v_from date := public.london_today() - 90;
  v_to   date := public.london_today();
  j jsonb; n int; v_label text;
begin
  select id into v_club from c;

  -- =====================================================================
  -- 1 · The tier split, with the club's own labels on it.
  -- =====================================================================
  j := public.club_analytics_memberships(v_club, v_from, v_to);

  select count(*) into n from jsonb_array_elements(j->'byTier');
  if n <> 2 then
    raise exception 'FAIL 1: expected two tiers, got %', n;
  end if;

  select t->>'label' into v_label from jsonb_array_elements(j->'byTier') t
   where t->>'tier' = 'gold';
  if v_label is distinct from 'Gold Membership' then
    raise exception 'FAIL 1: the tier is named % rather than by the club''s label',
      coalesce(v_label, 'nothing');
  end if;

  -- =====================================================================
  -- 2 · The window means JOINED, not ON. Every window on the page ends
  --     today, so a count that followed it would be the same five times
  --     over and the picker would be doing nothing.
  -- =====================================================================
  if (j->>'total')::int <> 2 then
    raise exception 'FAIL 2: the roster is % rather than 2', (j->>'total')::int;
  end if;
  if (j->>'joined')::int <> 1 then
    raise exception 'FAIL 2: % joined inside the window, expected 1', (j->>'joined')::int;
  end if;

  select (t->>'joined')::int into n from jsonb_array_elements(j->'byTier') t
   where t->>'tier' = 'basic';
  if n <> 0 then
    raise exception 'FAIL 2: the member who joined 400 days ago counted as new';
  end if;

  -- =====================================================================
  -- 3 · One lifetime total per member, zero included. The ladder itself is
  --     TypeScript's: a second copy here would disagree with a member's own
  --     page the first time a club edited its rungs.
  -- =====================================================================
  select count(*) into n from jsonb_array_elements(j->'lifetime');
  if n <> 2 then
    raise exception 'FAIL 3: % lifetime totals for 2 members', n;
  end if;
  if not (j->'lifetime' @> '[0]'::jsonb) then
    raise exception 'FAIL 3: a member with no points is missing from the ladder';
  end if;
  if not (j->'lifetime' @> '[600]'::jsonb) then
    raise exception 'FAIL 3: the member with 600 points is not on it';
  end if;

  -- =====================================================================
  -- 4 · What sold, and what did not. A cancelled order is out, which is the
  --     rule every other report here follows.
  -- =====================================================================
  j := public.club_analytics_sales(v_club, v_from, v_to);

  select count(*) into n from jsonb_array_elements(j->'items');
  if n <> 1 then
    raise exception 'FAIL 4: % items in the ranking, expected 1', n;
  end if;
  if (j->'items'->0->>'label') <> 'Club T Shirt' then
    raise exception 'FAIL 4: the ranking leads with %', j->'items'->0->>'label';
  end if;
  if (j->'items'->0->>'sold')::int <> 3 then
    raise exception 'FAIL 4: sold reads %', j->'items'->0->>'sold';
  end if;
  if (j->>'itemsSold')::int <> 3 then
    raise exception 'FAIL 4: a cancelled order reached the total';
  end if;

  -- =====================================================================
  -- 5 · Coaching counts on the night it ran, matching the money report,
  --     rather than on the day somebody booked it.
  -- =====================================================================
  if (j->>'placesTaken')::int <> 1 then
    raise exception 'FAIL 5: % places taken, expected 1', (j->>'placesTaken')::int;
  end if;
  if (j->'sessions'->0->>'label') <> 'List clinic' then
    raise exception 'FAIL 5: the session ranking leads with %',
      j->'sessions'->0->>'label';
  end if;

  -- A window that ends before the session must not see it.
  j := public.club_analytics_sales(v_club, v_from, public.london_today() - 10);
  if (j->>'placesTaken')::int <> 0 then
    raise exception 'FAIL 5: a session outside the window was counted';
  end if;

  -- =====================================================================
  -- 6 · A club sees runs, never pounds. One key, held by the site, and a
  --     club owner is not the one being billed.
  -- =====================================================================
  j := public.club_ai_usage(v_club);
  if j ? 'spentPence' or j ? 'costPence' or j ? 'pence' then
    raise exception 'FAIL 6: the club read hands back money';
  end if;
  if (j->>'runs')::int <> 0 then
    raise exception 'FAIL 6: runs reads % on a club that has run nothing',
      j->>'runs';
  end if;

  -- =====================================================================
  -- 7 · The no-argument version is gone, not sitting beside the new one.
  -- =====================================================================
  if to_regprocedure('public.club_analytics_memberships(bigint)') is not null then
    raise exception 'FAIL 7: the windowless memberships read is still callable';
  end if;

  raise notice 'stage13-tiers-and-sales: all pass';
end $$;

rollback;
\echo 'stage13-tiers-and-sales: all pass'
