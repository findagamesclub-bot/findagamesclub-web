-- 0186 · every revenue stream, and one window.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- Money in every stream, so a report missing one cannot pass by accident.
-- Dated inside a 90 day window and spread across two calendar months, which is
-- what makes the clipping testable.
insert into public.club_booking_settings (club_id, table_booking_price, price_currency)
  select id, 10.00, 'GBP' from c;

-- A table booking on the next Thursday, counted on the NIGHT.
update public.club_bookings set total_price = 7.00, base_price = 10.00
 where id = (select id from bk);

insert into public.club_membership_payments
  (club_id, membership_id, profile_id, price, created_at)
  select c.id, m.id, m.profile_id, 'GBP 25.00', now() - interval '3 days'
    from c, public.club_memberships m
   where m.club_id = c.id and m.profile_id = 'e0000000-0000-0000-0000-000000000003';

insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select id, 'money-186', 'Money Open', current_date + 10, 'published' from c;
insert into public.club_event_bookings
  (club_id, event_id, profile_id, full_name, email, reference, subtotal, total, created_at)
  select c.id, e.id, 'e0000000-0000-0000-0000-000000000003',
         'Member Eight', 'member8@example.com', 'FAGC-MONEY1', 30.00, 30.00,
         now() - interval '2 days'
    from c, public.club_events e where e.legacy_id = 'money-186';

insert into public.club_merchandise_orders
  (club_id, profile_id, subtotal, total, status, created_at)
  select id, 'e0000000-0000-0000-0000-000000000003', 12.00, 12.00, 'paid',
         now() - interval '1 day' from c;

-- Coaching, which is the stream both reports were missing. On a slot inside
-- the window, because coaching counts on the night the way a table does.
-- A tier that takes 10% off coaching, so the gross and the net differ and the
-- report is tested on two numbers rather than one. The trigger prices the
-- booking itself (0157), so what is seeded on the row is not what is stored.
insert into public.club_membership_tiers (club_id, tier_key, label, benefits)
  select id, 'basic', 'Basic', '{"coachingDiscountPercent": 10}'::jsonb from c;

-- Booked on a future slot and then backdated, because the guard refuses a
-- booking on a session that has already happened (0159) and that guard is
-- worth keeping. The same shape stage10-links uses for the same reason.
insert into public.club_coaching_slots
  (club_id, title, slot_date, start_time, price, capacity, status)
  select id, 'List clinic', public.london_today() + 7, '19:00', 'GBP 20.00', 4, 'open' from c;
-- And with the member's own claims set, because the guard asks
-- `is_club_member`, which reads auth.uid() from the request GUC and finds
-- nobody when the suite writes as postgres.
select set_config('request.jwt.claims',
  json_build_object('sub', 'e0000000-0000-0000-0000-000000000003',
                    'role', 'authenticated')::text, true);
insert into public.club_coaching_bookings
  (slot_id, profile_id, status, base_price, total_price)
  select s.id, 'e0000000-0000-0000-0000-000000000003', 'booked', 20.00, 18.00
    from public.club_coaching_slots s where s.title = 'List clinic';
-- Back to the owner for the reads below: `analytics_allowed` asks who is
-- looking, so these have to run as somebody who runs the club rather than as
-- nobody. stage6 covers the refusal from the other side.
select set_config('request.jwt.claims',
  json_build_object('sub', 'e0000000-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text, true);
update public.club_coaching_slots set slot_date = public.london_today() - 5
 where title = 'List clinic';

do $$
declare
  v_club bigint;
  v_from date := public.london_today() - 90;
  v_to   date := public.london_today();
  v_money jsonb; v_months jsonb;
  v_page numeric; v_file numeric; v_coaching numeric;
  v_first date; v_last date;
begin
  select id into v_club from c;

  v_money  := public.club_analytics_money(v_club, v_from, v_to);
  v_months := public.club_analytics_months(v_club, v_from, v_to);

  -- =====================================================================
  -- 1 · Coaching is a revenue stream. It was priced by 0157 and neither
  --     report had ever heard of it.
  -- =====================================================================
  if v_money -> 'coaching' is null then
    raise exception 'FAIL 1: the money report has no coaching stream at all';
  end if;
  v_coaching := (v_money -> 'coaching' ->> 'net')::numeric;
  if v_coaching <> 18.00 then
    raise exception 'FAIL 1: coaching read % rather than 18.00', v_coaching;
  end if;
  if (v_money -> 'coaching' ->> 'gross')::numeric <> 20.00 then
    raise exception 'FAIL 1: coaching gross is not the price before the discount';
  end if;

  -- =====================================================================
  -- 2 · The month buckets sum to the money card, which is the property the
  --     client was checking when the file and the page disagreed. The two
  --     used to measure different spans: a rolling 90 days against calendar
  --     buckets counted back from today.
  -- =====================================================================
  v_page := (v_money -> 'membership' ->> 'net')::numeric
          + (v_money -> 'tables'     ->> 'net')::numeric
          + (v_money -> 'tickets'    ->> 'net')::numeric
          + (v_money -> 'shop'       ->> 'net')::numeric
          + (v_money -> 'coaching'   ->> 'net')::numeric;

  select coalesce(sum((m->>'membership_in')::numeric + (m->>'tables_in')::numeric
                    + (m->>'tickets_in')::numeric + (m->>'shop_in')::numeric
                    + (m->>'coaching_in')::numeric), 0)
    into v_file from jsonb_array_elements(v_months) m;

  if v_page <> v_file then
    raise exception 'FAIL 2: the page says % and the months say %', v_page, v_file;
  end if;
  if v_page = 0 then
    raise exception 'FAIL 2: both are zero, so the sums agree about nothing';
  end if;

  -- =====================================================================
  -- 3 · The buckets are clipped to the window rather than running to the
  --     edges of their own months. Without the clip the first bucket reaches
  --     back before `p_from` and the sum above stops holding.
  -- =====================================================================
  select min((m->>'month_start')::date), max((m->>'month_start')::date)
    into v_first, v_last from jsonb_array_elements(v_months) m;

  if v_first <> date_trunc('month', v_from)::date then
    raise exception 'FAIL 3: the first bucket starts at % not %',
      v_first, date_trunc('month', v_from)::date;
  end if;
  if v_last <> date_trunc('month', v_to)::date then
    raise exception 'FAIL 3: the last bucket starts at % not %',
      v_last, date_trunc('month', v_to)::date;
  end if;

  -- A payment made before the window must not be picked up by the first
  -- bucket reaching back to the 1st of its own month.
  insert into public.club_membership_payments
    (club_id, membership_id, profile_id, price, created_at)
    select v_club, m.id, m.profile_id, 'GBP 999.00', (v_from - 1)::timestamptz
      from public.club_memberships m
     where m.club_id = v_club and m.profile_id = 'e0000000-0000-0000-0000-000000000003';

  v_months := public.club_analytics_months(v_club, v_from, v_to);
  select coalesce(sum((m->>'membership_in')::numeric), 0)
    into v_file from jsonb_array_elements(v_months) m;
  if v_file <> 25.00 then
    raise exception 'FAIL 3: a payment outside the window reached a bucket, got %', v_file;
  end if;

  -- =====================================================================
  -- 4 · The window is one window. A single month asks for a single bucket,
  --     which is what lets the chart and the money card be read together.
  -- =====================================================================
  v_months := public.club_analytics_months(
    v_club, date_trunc('month', public.london_today())::date, public.london_today());
  if jsonb_array_length(v_months) <> 1 then
    raise exception 'FAIL 4: this month came back as % buckets',
      jsonb_array_length(v_months);
  end if;

  -- =====================================================================
  -- 5 · The old signature is gone, not sitting beside the new one. A caller
  --     that kept passing a month count would otherwise go on quietly
  --     measuring something else, which is the whole of the client's report.
  -- =====================================================================
  if to_regprocedure('public.club_analytics_months(bigint, integer)') is not null then
    raise exception 'FAIL 5: the month-count version is still callable';
  end if;

  raise notice 'stage13-every-stream: all pass';
end $$;

rollback;
\echo 'stage13-every-stream: all pass'
