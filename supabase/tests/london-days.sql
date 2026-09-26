-- 0123 · a club day is a London day, whatever the session thinks.
--
-- This one deliberately does not run in UTC. The bug it pins was invisible in
-- UTC for eleven months of the year and showed up the moment the harness ran
-- in the machine's own zone: the window came from `london_today()` and the rows
-- were bucketed by the session's date, so a ticket bought inside the window
-- was counted outside it.
--
--   scripts/pg-harness.sh psql -f supabase/tests/london-days.sql

\i supabase/tests/stage7-seed.sql

-- ------------------------------------------------------- london_day itself

do $$
declare v date;
begin
  -- 23:30 UTC on 30 September is already 1 October in London, because BST is
  -- UTC+1. This is the hour the analytics were getting wrong.
  assert public.london_day('2026-09-30 23:30:00+00'::timestamptz) = date '2026-10-01',
    'BST midnight is the next London day, got '
    || public.london_day('2026-09-30 23:30:00+00'::timestamptz);

  -- And in winter, when London is UTC, the two agree.
  assert public.london_day('2026-01-15 23:30:00+00'::timestamptz) = date '2026-01-15',
    'GMT should match UTC';

  -- The boundary itself.
  assert public.london_day('2026-06-30 22:59:59+00'::timestamptz) = date '2026-06-30';
  assert public.london_day('2026-06-30 23:00:00+00'::timestamptz) = date '2026-07-01';
  raise notice 'PASS london_day: BST rolls over an hour before UTC does';
end $$;

-- ----------------------------------------------- and the functions use it

set local timezone = 'Asia/Karachi';

do $$
declare v_club bigint; j jsonb; v_from date; v_to date; n int;
begin
  select id into v_club from public.clubs where slug = 'badge-club';

  -- A ticket bought right now, whatever "now" means to this session.
  insert into public.club_events (club_id, legacy_id, title, start_date, status)
  values (v_club, 'tz-test', 'Timezone test', public.london_today() + 5, 'published');
  insert into public.club_event_bookings
    (club_id, event_id, profile_id, status, total, full_name, email, reference)
  select v_club, id, 'd0000000-0000-0000-0000-000000000003', 'reserved', 10,
         'Member Seven', 'm@e.com', 'TZ1'
    from public.club_events where legacy_id = 'tz-test';

  perform set_config('request.jwt.claims',
    '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  v_from := public.london_today() - 90;
  v_to := public.london_today();
  j := public.club_analytics_summary(v_club, v_from, v_to);

  -- The whole point. A booking made now is inside a window that ends today,
  -- and it was not when the cast read the session's own timezone.
  assert (j->>'eventTickets')::int = 1,
    'a ticket bought now fell outside a window ending today, in timezone '
    || current_setting('timezone') || '. Got ' || (j->>'eventTickets');
  raise notice 'PASS window: a ticket bought now counts, in % too',
    current_setting('timezone');

  -- The month buckets have to agree with it.
  select count(*) into n from jsonb_array_elements(
    public.club_analytics_months(v_club, 3)) m
   where (m->>'tickets')::int > 0;
  assert n = 1, 'the ticket is in no month bucket, or in two. Buckets holding it: ' || n;
  raise notice 'PASS months: and it lands in exactly one month';
end $$;
rollback;
