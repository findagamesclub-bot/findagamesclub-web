-- 0230 · refund due and refunded, as groups a club can ask for.
--
-- Section 3 is the break test: the two money-back groups must NOT inherit the
-- "and the table is still booked" clause the other three carry. A refund
-- lives on a table that was called off, so copying that clause leaves both
-- tabs empty for ever and the bug looks like no data rather than a wrong
-- filter.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.seed_table() returns bigint
language plpgsql security definer as $fn$
declare
  v_club bigint; v_session bigint; v_id bigint;
  v_thu date := current_date + (((4 - extract(isodow from current_date))::int + 6) % 7 + 1);
begin
  select id into v_club from public.clubs where slug = 'army-club';
  select id into v_session from public.club_sessions where club_id = v_club limit 1;
  insert into public.club_bookings
    (club_id, club_session_id, session_date, booked_by, opponent_profile_id,
     game_title, table_index, status)
  values (v_club, v_session, v_thu + 7, 'e0000000-0000-0000-0000-000000000003',
          'e0000000-0000-0000-0000-000000000001', 'Warhammer 40,000', 2, 'booked')
  returning id into v_id;
  return v_id;
end $fn$;

create or replace function pg_temp.seed_order() returns bigint
language plpgsql security definer as $fn$
declare v_club bigint; v_id bigint;
begin
  select id into v_club from public.clubs where slug = 'army-club';
  insert into public.club_merchandise_orders
    (club_id, profile_id, status, subtotal, total)
  values (v_club, 'e0000000-0000-0000-0000-000000000003', 'paid', 12, 12)
  returning id into v_id;
  return v_id;
end $fn$;

create or replace function pg_temp.set_order(p_order bigint, p_status text)
returns void language plpgsql security definer as $fn$ begin
  update public.club_merchandise_orders set status = p_status where id = p_order;
end $fn$;

create or replace function pg_temp.order_status(p_order bigint)
returns text language sql security definer as $fn$
  select status from public.club_merchandise_orders where id = p_order $fn$;

-- An event place paid for and then called off, so 0092 leaves a refund due.
-- Seeded as postgres: what is under test is the count, not who may insert.
create or replace function pg_temp.seed_owed() returns bigint
language plpgsql security definer as $fn$
declare v_club bigint; v_ev bigint; v_id bigint;
begin
  select id into v_club from public.clubs where slug = 'army-club';
  insert into public.club_events (club_id, legacy_id, title, start_date, status)
    values (v_club, 'refund-groups-ev', 'Refund Groups Open',
            public.london_today() + 30, 'published')
    returning id into v_ev;
  insert into public.club_event_bookings
    (event_id, club_id, profile_id, full_name, email, reference, status,
     subtotal, total, currency, payment_status)
  values (v_ev, v_club, 'e0000000-0000-0000-0000-000000000003', 'Member Eight',
          'm8@example.com', 'FAGC-RG01', 'reserved', 20, 20, 'GBP', 'paid_in_advance')
  returning id into v_id;
  update public.club_event_bookings
     set status = 'cancelled', cancel_reason = 'Testing the groups' where id = v_id;
  return v_id;
end $fn$;

create temp table grp as select pg_temp.seed_table() as id;
grant select on grp to authenticated;

set local role authenticated;

do $$
declare w record; v_club bigint; v_bk bigint; n bigint; r record;
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_bk from grp;
  perform pg_temp.be(w.owner);

  -- ====================================================================== 1
  -- Nothing is owed back yet, so both groups are empty and say so.
  -- ====================================================================== 1
  select count(*) into n from public.club_table_bookings(
    v_club, 'refunddue', '', '', null, 'newest', 1, 100);
  if n <> 0 then
    raise exception 'FAIL 1: % rows were owed a refund before anything was paid', n;
  end if;
  raise notice 'PASS 1: nothing paid, nothing owed back';

  -- ====================================================================== 2
  -- Pay a half and call the table off: 0229 leaves a refund due, and the tab
  -- is how a club finds it.
  -- ====================================================================== 2
  perform public.club_set_booking_payment(v_bk, 'booker', 'paid_on_the_door', 'Cash', '');
  update public.club_bookings set status = 'cancelled' where id = v_bk;

  select count(*) into n from public.club_table_bookings(
    v_club, 'refunddue', '', '', null, 'newest', 1, 100);
  if n <> 1 then
    raise exception 'FAIL 2: the Refund due tab holds % rows, expected the one', n;
  end if;
  select refunddue into n from public.club_table_booking_counts(v_club, '', '', null);
  if n <> 1 then
    raise exception 'FAIL 2b: the count says % for a tab the list says 1', n;
  end if;
  raise notice 'PASS 2: a called-off paid table turns up under Refund due';

  -- ====================================================================== 3
  -- BREAK TEST. The row is CANCELLED, which is the whole point. If these two
  -- groups ever pick up the `status = 'booked'` clause the other three carry,
  -- they go empty and stay empty.
  -- ====================================================================== 3
  select count(*) into n from public.club_table_bookings(
    v_club, 'cancelled', '', '', null, 'newest', 1, 100) t
   where t.booking_id = v_bk and t.side = 'booker';
  if n <> 1 then
    raise exception 'FAIL 3: the row under test is not cancelled, so this proves nothing';
  end if;
  select count(*) into n from public.club_table_bookings(
    v_club, 'refunddue', '', '', null, 'newest', 1, 100) t
   where t.booking_id = v_bk and t.side = 'booker';
  if n <> 1 then
    raise exception
      'FAIL 3: a cancelled row owed a refund is missing from Refund due — the '
      'group inherited the still-booked clause';
  end if;
  raise notice 'PASS 3: break test — a cancelled table still answers Refund due';

  -- ====================================================================== 4
  -- Settle it and it moves groups, in both the list and the counts.
  -- ====================================================================== 4
  perform public.club_set_booking_refund(v_bk, 'booker', 'refunded', 'Cash', 'Handed back.');

  select count(*) into n from public.club_table_bookings(
    v_club, 'refunddue', '', '', null, 'newest', 1, 100);
  if n <> 0 then
    raise exception 'FAIL 4: a settled refund is still owed, % rows', n;
  end if;
  select count(*) into n from public.club_table_bookings(
    v_club, 'refunded', '', '', null, 'newest', 1, 100);
  if n <> 1 then
    raise exception 'FAIL 4b: the Refunded tab holds % rows', n;
  end if;

  select * into r from public.club_table_booking_counts(v_club, '', '', null);
  if r.refunddue <> 0 or r.refunded <> 1 then
    raise exception 'FAIL 4c: the counts say due % and refunded %',
      r.refunddue, r.refunded;
  end if;
  raise notice 'PASS 4: settling one moves it from due to refunded, list and counts';

  -- ====================================================================== 5
  -- The groups narrow with the month and the night like every other tab, or
  -- a club filtering to one evening gets the whole club''s refunds.
  -- ====================================================================== 5
  select count(*) into n from public.club_table_bookings(
    v_club, 'refunded', '', to_char(public.london_today() - 400, 'YYYY-MM'),
    null, 'newest', 1, 100);
  if n <> 0 then
    raise exception 'FAIL 5: a month with no refunds returned % of them', n;
  end if;
  raise notice 'PASS 5: the groups narrow with the month like the rest';

  -- ====================================================================== 6
  -- And they are the club''s to read, not everybody''s.
  -- ====================================================================== 6
  perform pg_temp.be(w.stranger);
  begin
    perform public.club_table_bookings(v_club, 'refunded', '', '', null, 'newest', 1, 10);
    raise exception 'FAIL 6: a stranger read the club''s refunds';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 6: a stranger reads none of it';

  -- ====================================================================== 7
  -- And a merchandise order can hold both words, which is the other half of
  -- the client's item. Set by hand here rather than inferred: one status
  -- column cannot remember that a cancelled order was paid.
  -- ====================================================================== 7
  perform pg_temp.be(w.owner);
  declare v_order bigint; v_said text;
  begin
    v_order := pg_temp.seed_order();
    perform pg_temp.set_order(v_order, 'refund_due');
    if pg_temp.order_status(v_order) <> 'refund_due' then
      raise exception 'FAIL 7: an order could not be marked refund due';
    end if;
    perform pg_temp.set_order(v_order, 'refunded');
    if pg_temp.order_status(v_order) <> 'refunded' then
      raise exception 'FAIL 7b: an order could not move from due to refunded';
    end if;

    v_said := '';
    begin
      perform pg_temp.set_order(v_order, 'sort of');
      raise exception 'FAIL 7c: a status nobody offers was accepted';
    exception when check_violation then v_said := 'refused';
    end;
    if v_said <> 'refused' then
      raise exception 'FAIL 7c: the order status constraint is not holding';
    end if;
  end;
  raise notice 'PASS 7: an order holds both words, and still refuses an invented one';

  -- ====================================================================== 8
  -- And the EVENT bookings tab row gets numbers for its two new tabs (0231).
  -- The board drew them blank because the summary built five counts and the
  -- tab bar prints whatever it is handed, so `undefined` rendered as nothing
  -- at all. A missing key on a jsonb object is nobody's type error, which is
  -- why only opening the page found it and why it is pinned here.
  -- ====================================================================== 8
  declare
    v_counts jsonb;
  begin
    perform pg_temp.seed_owed();
    perform pg_temp.be(w.owner);
    v_counts := public.club_event_bookings_summary(v_club, 0) -> 'counts';

    if v_counts -> 'refunddue' is null or v_counts -> 'refunded' is null then
      raise exception
        'FAIL 8: the summary has no refunddue/refunded key, so the tab row '
        'draws a blank: %', v_counts;
    end if;
    if (v_counts ->> 'refunddue')::int < 1 then
      raise exception 'FAIL 8b: a cancelled paid place is not counted as owed: %',
        v_counts ->> 'refunddue';
    end if;
    raise notice 'PASS 8: the event tab row has numbers for both new tabs';
  end;

  raise notice 'ALL PASS · 0230 refund groups';
end $$;

rollback;
