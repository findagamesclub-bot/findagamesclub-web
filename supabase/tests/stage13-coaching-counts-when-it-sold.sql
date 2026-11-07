-- 0219 · a coaching place counts in the window it was SOLD in, not the one
-- the session runs in.
--
-- The client's own case, item p: a place booked today for a session next month
-- read as nothing at all on "this month". The break test at the end is the one
-- that matters, because the old behaviour passes everything else: it asserts
-- the figure is the one the client could not get, and it goes red the moment
-- the clock moves back to `slot_date`.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Backdating is postgres's job: `booked_at` has a default and no grant, and a
-- test that could set it as the member would be testing a hole.
create or replace function pg_temp.booked_on(p_booking bigint, p_day date)
returns void language sql security definer as $fn$
  update public.club_coaching_bookings
     set booked_at = p_day::timestamptz + interval '12 hours'
   where id = p_booking $fn$;

insert into public.club_coaching_settings (club_id, enabled)
  select id, true from c;

-- A session well into next month, which is the shape of Didcot's own data:
-- the only thing anybody can book runs after every window on the page ends.
insert into public.club_coaching_slots
  (club_id, title, slot_date, start_time, price, coaching_type, capacity, status)
  select id, 'List clinic', (date_trunc('month', public.london_today()) + interval '45 days')::date,
         '19:00', 'GBP 30', 'one-to-one', 5, 'open' from c;

create temp table slot as
  select id from public.club_coaching_slots where title = 'List clinic';
grant select on slot to authenticated;

do $$
declare
  v_club    bigint;
  v_booking bigint;
  v_from    date := date_trunc('month', public.london_today())::date;
  v_to      date := public.london_today();
  v_money   jsonb;
  v_sales   jsonb;
  v_months  jsonb;
begin
  select id into v_club from c;

  -- The member books it today, which is the whole of the client's report.
  set local role authenticated;
  perform pg_temp.be((select member from who));
  insert into public.club_coaching_bookings (slot_id)
    select id from slot returning id into v_booking;
  reset role;

  -- ====================================================================== 1
  -- The money report sees it inside this month.
  -- ====================================================================== 1
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  v_money := public.club_analytics_money(v_club, v_from, v_to);
  reset role;

  if (v_money -> 'coaching' ->> 'gross')::numeric <= 0 then
    raise exception 'FAIL 1: a place booked today is worth % in this month''s money',
      v_money -> 'coaching' ->> 'gross';
  end if;
  raise notice 'PASS 1: the money report counts a place in the month it was booked';

  -- ====================================================================== 2
  -- And so does the ranking, which is the panel the client screenshotted.
  -- ====================================================================== 2
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  v_sales := public.club_analytics_sales(v_club, v_from, v_to);
  reset role;

  if (v_sales ->> 'placesTaken')::int <> 1 then
    raise exception 'FAIL 2: Shop and coaching says % places, expected 1',
      v_sales ->> 'placesTaken';
  end if;
  if jsonb_array_length(v_sales -> 'sessions') <> 1 then
    raise exception 'FAIL 2: the ranking carries % rows, expected 1',
      jsonb_array_length(v_sales -> 'sessions');
  end if;
  raise notice 'PASS 2: the Shop and coaching ranking counts it too';

  -- ====================================================================== 3
  -- The two agree, which is the property item 6 was about: a figure in the
  -- panel that cannot be traced to the one above it is a figure nobody can
  -- file.
  -- ====================================================================== 3
  if (v_sales -> 'sessions' -> 0 ->> 'revenue')::numeric
     <> (v_money -> 'coaching' ->> 'net')::numeric then
    raise exception 'FAIL 3: the ranking says % and the money card says %',
      v_sales -> 'sessions' -> 0 ->> 'revenue', v_money -> 'coaching' ->> 'net';
  end if;
  raise notice 'PASS 3: the ranking and the money card quote the same figure';

  -- ====================================================================== 4
  -- The months behind the CSV sum to the card, over the same window.
  -- ====================================================================== 4
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  v_months := public.club_analytics_months(v_club, v_from, v_to);
  reset role;

  if (select coalesce(sum((m ->> 'coaching_in')::numeric), 0)
        from jsonb_array_elements(v_months) m)
     <> (v_money -> 'coaching' ->> 'net')::numeric then
    raise exception 'FAIL 4: the months add up to % and the card says %',
      (select coalesce(sum((m ->> 'coaching_in')::numeric), 0)
         from jsonb_array_elements(v_months) m),
      v_money -> 'coaching' ->> 'net';
  end if;
  raise notice 'PASS 4: the months sum to the money card for the same window';

  -- ====================================================================== 5
  -- A place sold LAST month is not in this one. The clock moved; it did not
  -- stop being a clock.
  -- ====================================================================== 5
  perform pg_temp.booked_on(v_booking, (v_from - 5));

  set local role authenticated;
  perform pg_temp.be((select owner from who));
  v_sales := public.club_analytics_sales(v_club, v_from, v_to);
  v_money := public.club_analytics_money(v_club, v_from, v_to);
  reset role;

  if (v_sales ->> 'placesTaken')::int <> 0
     or (v_money -> 'coaching' ->> 'gross')::numeric <> 0 then
    raise exception 'FAIL 5: a place sold before the window is still inside it';
  end if;
  raise notice 'PASS 5: a place sold before the window stays out of it';

  -- ====================================================================== 6
  -- BREAK TEST. Everything above passes under the old rule as well, because
  -- the old rule simply answers about a different month. This is the one
  -- assertion that fails if the clock goes back to `slot_date`: the window is
  -- the month the place was sold in, and the session is deliberately 45 days
  -- past the start of it.
  -- ====================================================================== 6
  perform pg_temp.booked_on(v_booking, public.london_today());

  set local role authenticated;
  perform pg_temp.be((select owner from who));
  v_sales := public.club_analytics_sales(v_club, v_from, v_to);
  reset role;

  if (v_sales ->> 'placesTaken')::int <> 1 then
    raise exception
      'FAIL 6: the session runs on %, outside the window % to %, and the place '
      'sold inside it was counted as % — the clock is on the night again',
      (select (slot_date)::text from public.club_coaching_slots
        where id = (select id from slot)),
      v_from, v_to, v_sales ->> 'placesTaken';
  end if;
  raise notice 'PASS 6: break test — the night is outside the window and the sale is in it';

  -- ====================================================================== 7
  -- A cancelled place is in neither, whichever clock is running.
  -- ====================================================================== 7
  set local role authenticated;
  perform pg_temp.be((select member from who));
  update public.club_coaching_bookings set status = 'cancelled' where id = v_booking;

  perform pg_temp.be((select owner from who));
  v_sales := public.club_analytics_sales(v_club, v_from, v_to);
  v_money := public.club_analytics_money(v_club, v_from, v_to);
  reset role;

  if (v_sales ->> 'placesTaken')::int <> 0
     or (v_money -> 'coaching' ->> 'gross')::numeric <> 0 then
    raise exception 'FAIL 7: a cancelled place is still being counted';
  end if;
  raise notice 'PASS 7: a cancelled place counts nowhere';

  raise notice 'ALL PASS · 0219 coaching counts on the day it sold';
end $$;

rollback;
