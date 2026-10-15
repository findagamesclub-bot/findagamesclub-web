-- 0191 · how the site itself is doing. scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- Every date here is measured from `london_today()`, never `current_date`.
-- The harness runs in Asia/Karachi, so for five hours out of every
-- twenty-four the two are different days and a test built on the wrong one
-- fails on its own arithmetic. stage13-join-date paid for that once.
create temp table w as select
  public.london_today() as today,
  (public.london_today() - 200)::date as old_day,
  -- Inside the window BEFORE a 90-day one, which runs from today-181 to
  -- today-91. Picked deliberately: a date outside both windows would have
  -- made FAIL 9 pass for the wrong reason.
  (public.london_today() - 120)::date as before_day,
  (public.london_today() - 20)::date as recent_day,
  -- Five days ago, used with a window that ends ten days ago. The gap between
  -- the window's end and the end of its last calendar month is what an
  -- unclipped bucket reaches into, and this row sits in it whatever today's
  -- date happens to be.
  (public.london_today() - 5)::date as just_outside;

-- A club listed long ago and imported YESTERDAY. `created_at` alone would draw
-- a spike in this month and call it the best the site ever had; the legacy
-- date is what says how old it really is. Same key 0188 sorts on.
insert into public.clubs (slug, name, city, status, created_at, legacy_created_at)
  select 'imported-old', 'Imported Old', 'Hull', 'active',
         now() - interval '1 day',
         (w.old_day + 1)::timestamptz from w;

-- And one that really did arrive recently.
insert into public.clubs (slug, name, city, status, created_at)
  select 'brand-new', 'Brand New', 'Leeds', 'active',
         (w.recent_day)::timestamptz from w;

insert into public.club_events (club_id, legacy_id, title, start_date, status, created_at)
  select c.id, 'added-recently', 'Added Recently', w.today + 30, 'published',
         (w.recent_day)::timestamptz from c, w;

-- The two revenue streams, each on its own date and each its own figure. A fee
-- is money received and a slot is money booked; adding them silently would be
-- the page inventing a receipt.
insert into public.listing_subscriptions
  (club_id, owner_id, plan_interval, status, price_pence)
  select id, 'e0000000-0000-0000-0000-000000000001', 'monthly', 'active', 1500 from c;
insert into public.listing_payments
  (subscription_id, club_id, kind, amount_pence, paid_at, method)
  select s.id, s.club_id, 'subscription', 1500, (w.recent_day)::timestamptz, 'bank_transfer'
    from public.listing_subscriptions s, w;
insert into public.featured_listings (club_id, starts_on, ends_on, price_pence)
  select c.id, w.recent_day, w.recent_day + 7, 2000 from c, w;

-- Outside the window on purpose: the clipping is what makes the columns add up
-- to the figures above them, and nothing proves it like a row that must not
-- be counted.
insert into public.featured_listings (club_id, starts_on, ends_on, price_pence)
  select c.id, w.before_day, w.before_day + 7, 9900 from c, w;
insert into public.featured_listings (club_id, starts_on, ends_on, price_pence)
  select c.id, w.just_outside, w.just_outside + 7, 7700 from c, w;

do $$
declare
  v_who record; v_w record;
  v_from date; v_to date;
  j jsonb; n integer; v_sum bigint; v_months integer;
begin
  select * into v_who from who;
  select * into v_w from w;
  -- A 90-day window, which is the page's own default.
  v_from := (v_w.today - 90)::date;
  v_to := v_w.today;

  -- 1 · A member reaches neither. The gate is in the function, not on the
  --     page: an RPC is a public endpoint and the admin layout says nothing
  --     about who may post to it.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_who.member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform * from public.admin_growth_months(v_from, v_to);
    reset role;
    raise exception 'FAIL 1: a member read the growth months';
  exception when insufficient_privilege then reset role;
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_who.member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_growth_summary(v_from, v_to);
    reset role;
    raise exception 'FAIL 2: a member read the growth summary';
  exception when insufficient_privilege then reset role;
  end;

  -- 3 · The slice is reachable from nowhere but the summary. It carries no
  --     gate of its own, so a grant on it would be a hole.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_who.member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_growth_slice(v_from, v_to);
    reset role;
    raise exception 'FAIL 3: the slice is callable by anybody';
  exception when insufficient_privilege then reset role;
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_who.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.admin_growth_summary(v_from, v_to);
  select count(*) into v_months from public.admin_growth_months(v_from, v_to);
  reset role;

  -- 4 · The imported club is dated by when it STARTED, not by when the import
  --     ran. It landed in the database yesterday and must not be in this
  --     window at all.
  if (j -> 'window' ->> 'clubsListed')::int <> 2 then
    raise exception 'FAIL 4: % clubs listed in the window, expected 2 (the seed''s and Brand New)',
      j -> 'window' ->> 'clubsListed';
  end if;

  -- 5 · The two streams are two figures, each on its own date.
  if (j -> 'window' ->> 'listingPence')::bigint <> 1500 then
    raise exception 'FAIL 5: listing fees read %', j -> 'window' ->> 'listingPence';
  end if;
  if (j -> 'window' ->> 'featuredPence')::bigint <> 9700 then
    raise exception 'FAIL 6: featured reads % rather than 2000 + 7700 (the 9900 one is in the window before)',
      j -> 'window' ->> 'featuredPence';
  end if;

  -- 6 · The window before is the same length and ends the day this one
  --     begins. A comparison whose halves are different lengths is worse than
  --     none.
  if (j ->> 'beforeTo')::date <> v_from - 1 then
    raise exception 'FAIL 7: the window before ends % rather than the day before this one',
      j ->> 'beforeTo';
  end if;
  if ((j ->> 'beforeTo')::date - (j ->> 'beforeFrom')::date) <> (v_to - v_from) then
    raise exception 'FAIL 8: the two windows are different lengths (% against %)',
      (j ->> 'beforeTo')::date - (j ->> 'beforeFrom')::date, v_to - v_from;
  end if;
  -- And the 9900 slot really is in it, which is what makes FAIL 6 mean
  -- something: the row exists, it is simply not in this window.
  if (j -> 'before' ->> 'featuredPence')::bigint <> 9900 then
    raise exception 'FAIL 9: the earlier slot is not in the earlier window either (%)',
      j -> 'before' ->> 'featuredPence';
  end if;

  -- 7 · The columns add up to the figures above them. 0186 shipped a version
  --     where they did not, and the client found it by adding them up.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_who.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select sum(featured_pence) into v_sum from public.admin_growth_months(v_from, v_to);
  reset role;
  if v_sum <> (j -> 'window' ->> 'featuredPence')::bigint then
    raise exception 'FAIL 10: the months total % and the summary says %',
      v_sum, j -> 'window' ->> 'featuredPence';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_who.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select sum(clubs_listed) into v_sum from public.admin_growth_months(v_from, v_to);
  reset role;
  if v_sum <> (j -> 'window' ->> 'clubsListed')::bigint then
    raise exception 'FAIL 11: the months list % clubs and the summary says %',
      v_sum, j -> 'window' ->> 'clubsListed';
  end if;

  -- 7b · And they still add up when the window ENDS mid-month, which is the
  --      half the test above cannot see: an unclipped last bucket runs to the
  --      end of its calendar month and reaches past the window into dates
  --      nobody asked about.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_who.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select sum(featured_pence) into v_sum
    from public.admin_growth_months(v_from, (v_w.today - 10)::date);
  j := public.admin_growth_summary(v_from, (v_w.today - 10)::date);
  reset role;
  if v_sum <> (j -> 'window' ->> 'featuredPence')::bigint then
    raise exception 'FAIL 10b: a window ending mid-month totals % and says %',
      v_sum, j -> 'window' ->> 'featuredPence';
  end if;
  -- And the 7700 slot is genuinely outside it, which is what makes that mean
  -- something: the row exists five days ago and the window stopped ten days
  -- ago.
  if (j -> 'window' ->> 'featuredPence')::bigint <> 2000 then
    raise exception 'FAIL 10c: the mid-month window picked up % rather than 2000',
      j -> 'window' ->> 'featuredPence';
  end if;

  -- Back to the full window for the rest.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_who.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.admin_growth_summary(v_from, v_to);
  reset role;

  -- 8 · A 90-day window touches three or four calendar months and every one of
  --     them is drawn, empty or not: the empty months are what a growth chart
  --     is about.
  if v_months < 3 or v_months > 5 then
    raise exception 'FAIL 12: a 90-day window drew % month columns', v_months;
  end if;

  -- 9 · Where the site stands today, which no window can answer: a run of
  --     months says how fast it is filling, not how full it is.
  if (j -> 'now' ->> 'clubs')::int < 3 then
    raise exception 'FAIL 13: the site holds % clubs', j -> 'now' ->> 'clubs';
  end if;
  if (j -> 'now' ->> 'accounts')::int < 4 then
    raise exception 'FAIL 14: the site holds % accounts', j -> 'now' ->> 'accounts';
  end if;

  -- 10 · An event put up inside the window is counted on the day it was PUT
  --      UP, not the day it runs. The one above starts in 30 days.
  if (j -> 'window' ->> 'eventsAdded')::int <> 1 then
    raise exception 'FAIL 15: % events added, expected 1', j -> 'window' ->> 'eventsAdded';
  end if;
end $$;

rollback;
\echo '0191 how the site is doing: all pass'
