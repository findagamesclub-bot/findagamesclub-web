-- 0229 · money going back, on a table and on an order.
--
-- Section 2 is the break test: a refund taken back has to take its date, its
-- method and its note with it, or a row reads "Refunded by bank transfer"
-- under a status saying the money is still owed. 0224 broke on exactly that
-- for an event place and the rule is the same here.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Read as postgres, because a refund column is not readable by the person
-- under test and a fixture hidden by RLS reads the same as one that is wrong.
-- Three suites have now been caught by that.
create or replace function pg_temp.row_of(p_booking bigint)
returns public.club_bookings language sql security definer as $fn$
  select * from public.club_bookings where id = p_booking $fn$;

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

-- The order is a fixture, so it goes in as postgres: a member cannot insert
-- one directly and what is under test is the status it can hold, not who may
-- write it.
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

create temp table reftbl as select pg_temp.seed_table() as id;
grant select on reftbl to authenticated;

set local role authenticated;

do $$
declare
  w record; v_club bigint; v_bk bigint; v_row public.club_bookings%rowtype;
  n bigint; v_order bigint; v_said text;
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_bk from reftbl;

  -- ====================================================================== 1
  -- The club takes the money for one half, then gives it back. The date is
  -- the function's to write, never the form's.
  -- ====================================================================== 1
  perform pg_temp.be(w.owner);
  perform public.club_set_booking_payment(v_bk, 'booker', 'paid_on_the_door', 'Cash', '');
  perform public.club_set_booking_refund(
    v_bk, 'booker', 'refunded', 'Bank transfer', '  Sent 13 Nov, ref R-01.  ');

  v_row := pg_temp.row_of(v_bk);
  if v_row.refund_status <> 'refunded' then
    raise exception 'FAIL 1: the refund did not take, status is %', v_row.refund_status;
  end if;
  if v_row.refunded_at is null then
    raise exception 'FAIL 1b: a refund was recorded with no date on it';
  end if;
  if v_row.refund_method <> 'Bank transfer'
     or v_row.refund_note <> 'Sent 13 Nov, ref R-01.' then
    raise exception 'FAIL 1c: how it went back was not kept (% / %)',
      v_row.refund_method, v_row.refund_note;
  end if;
  -- And how it came IN is still there, which is the whole reason this is not
  -- folded into payment_status.
  if v_row.payment_status <> 'paid_on_the_door' or v_row.payment_method <> 'Cash' then
    raise exception 'FAIL 1d: the refund overwrote how the money arrived (% / %)',
      v_row.payment_status, v_row.payment_method;
  end if;
  raise notice 'PASS 1: a refund carries when, how and what was written, and keeps the payment';

  -- ====================================================================== 2
  -- BREAK TEST. Taking it back takes all three with it.
  -- ====================================================================== 2
  perform public.club_set_booking_refund(v_bk, 'booker', 'not_due', '', '');
  v_row := pg_temp.row_of(v_bk);
  if v_row.refunded_at is not null
     or v_row.refund_method <> '' or v_row.refund_note <> '' then
    raise exception
      'FAIL 2: a refund taken back still says it went out on % by % (%)',
      v_row.refunded_at, v_row.refund_method, v_row.refund_note;
  end if;
  raise notice 'PASS 2: break test — taking a refund back clears when and how';

  -- ====================================================================== 3
  -- Nothing was taken on the other half, so nothing can go back on it.
  -- ====================================================================== 3
  v_said := '';
  begin
    perform public.club_set_booking_refund(v_bk, 'opponent', 'refunded', 'Cash', '');
    raise exception 'FAIL 3: an unpaid half was refunded';
  exception when check_violation then v_said := 'refused';
  end;
  if v_said <> 'refused' then
    raise exception 'FAIL 3: the guard did not refuse an unpaid half';
  end if;
  raise notice 'PASS 3: a half nobody paid cannot be refunded';

  -- ====================================================================== 4
  -- The two halves are independent, which is what 0221 split them for.
  -- ====================================================================== 4
  perform public.club_set_booking_payment(v_bk, 'opponent', 'paid_in_advance', 'Card', '');
  perform public.club_set_booking_refund(v_bk, 'opponent', 'refunded', 'Card', 'Gone back.');
  v_row := pg_temp.row_of(v_bk);
  if v_row.opponent_refund_status <> 'refunded' then
    raise exception 'FAIL 4: the opponent''s half did not refund';
  end if;
  if v_row.refund_status <> 'not_due' then
    raise exception
      'FAIL 4b: refunding one half moved the other to %', v_row.refund_status;
  end if;
  raise notice 'PASS 4: each half of a table refunds on its own';

  -- ====================================================================== 5
  -- Calling the table off with money on it leaves a refund DUE rather than
  -- nothing. The club is holding money it no longer has a table for.
  -- ====================================================================== 5
  perform public.club_set_booking_refund(v_bk, 'opponent', 'not_due', '', '');
  perform public.club_set_booking_payment(v_bk, 'booker', 'paid_on_the_door', 'Cash', '');
  update public.club_bookings set status = 'cancelled' where id = v_bk;

  v_row := pg_temp.row_of(v_bk);
  if v_row.refund_status <> 'due' then
    raise exception
      'FAIL 5: a paid table was called off and nothing is owed back (%)',
      v_row.refund_status;
  end if;
  raise notice 'PASS 5: calling off a paid table leaves a refund due';

  -- ====================================================================== 6
  -- And the club can settle it afterwards, which the payment setter refuses
  -- on a cancelled row and this one deliberately allows.
  -- ====================================================================== 6
  perform public.club_set_booking_refund(v_bk, 'booker', 'refunded', 'Cash', 'Handed back.');
  v_row := pg_temp.row_of(v_bk);
  if v_row.refund_status <> 'refunded' or v_row.refunded_at is null then
    raise exception 'FAIL 6: a cancelled table could not be refunded';
  end if;
  raise notice 'PASS 6: a called-off table is exactly where a refund happens';

  -- ====================================================================== 7
  -- The list carries it back, or the club records something it cannot see.
  -- ====================================================================== 7
  select count(*) into n
    from public.club_table_bookings(v_club, 'all', '', '', null, 'newest', 1, 100) t
   where t.booking_id = v_bk and t.side = 'booker'
     and t.refund_status = 'refunded' and t.refund_method = 'Cash';
  if n <> 1 then
    raise exception 'FAIL 7: the money list does not carry the refund back';
  end if;
  raise notice 'PASS 7: the money list carries the refund';

  -- ====================================================================== 8
  -- Nobody else moves it. A member on the booking is the tempting case: they
  -- are allowed to cancel their own table, so the policies are OR''d and a
  -- column grant is what would have let this through.
  -- ====================================================================== 8
  perform pg_temp.be(w.member);
  v_said := '';
  begin
    perform public.club_set_booking_refund(v_bk, 'booker', 'not_due', '', '');
    raise exception 'FAIL 8: a member moved the refund on their own table';
  exception when insufficient_privilege then v_said := 'refused';
  end;
  if v_said <> 'refused' then
    raise exception 'FAIL 8: the guard did not refuse a member';
  end if;

  begin
    update public.club_bookings set refund_status = 'not_due' where id = v_bk;
    -- A zero-row update is the quiet answer RLS gives, so prove the row is
    -- untouched rather than trusting that no error came back.
    null;
  exception when others then null;
  end;
  v_row := pg_temp.row_of(v_bk);
  if v_row.refund_status <> 'refunded' then
    raise exception 'FAIL 8b: a member wrote the refund column directly';
  end if;
  raise notice 'PASS 8: neither the function nor the column is a member''s to move';

  -- ====================================================================== 9
  -- And a merchandise order can be refunded, which is the other half of the
  -- client''s item. One status there, because the status IS the payment.
  -- ====================================================================== 9
  v_order := pg_temp.seed_order();
  perform pg_temp.set_order(v_order, 'refunded');
  if pg_temp.order_status(v_order) <> 'refunded' then
    raise exception 'FAIL 9: a merchandise order could not be marked refunded, it reads %',
      pg_temp.order_status(v_order);
  end if;

  v_said := '';
  begin
    perform pg_temp.set_order(v_order, 'sort of');
    raise exception 'FAIL 9: a status nobody offers was accepted';
  exception when check_violation then v_said := 'refused';
  end;
  if v_said <> 'refused' then
    raise exception 'FAIL 9: the order status constraint is not holding';
  end if;
  raise notice 'PASS 9: an order refunds, and an invented status still does not';

  raise notice 'ALL PASS · 0229 money going back';
end $$;

rollback;
