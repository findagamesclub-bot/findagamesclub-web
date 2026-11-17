-- 0237 · an edited note is news too.
--
-- Section 1 is the break test and it is the client's own report: mark a
-- booking refunded with a note, go back and change the note, and the screen
-- goes on showing the old words. 0233 watched the status and nothing else.
--
-- Section 5 is the other one: a note typed against a row that owes nothing
-- back must not write a refund line, or clearing a stale method would log
-- "No refund due" at a club that never discussed a refund.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- The ledger is revoked from `authenticated` outright, so every read of it
-- here is as postgres. Three suites have been caught by reading a fixture
-- through a session that RLS was hiding it from.
create or replace function pg_temp.lines(p_scope text, p_entity bigint, p_kind text)
returns table (state text, method text, note text)
language sql security definer as $fn$
  select e.state, e.method, e.note
    from public.club_money_events e
   where e.scope = p_scope and e.entity_id = p_entity and e.kind = p_kind
   order by e.id $fn$;

create or replace function pg_temp.newest_note(p_scope text, p_entity bigint, p_kind text)
returns text language sql security definer as $fn$
  select e.note from public.club_money_events e
   where e.scope = p_scope and e.entity_id = p_entity and e.kind = p_kind
   order by e.id desc limit 1 $fn$;

create or replace function pg_temp.scribble(p_booking bigint) returns void
language plpgsql security definer as $fn$ begin
  -- Straight at the column, because `club_set_booking_refund` blanks the
  -- method and the note on a `not_due` row and so can never produce the state
  -- this is about. A later writer, or a hand-rolled fix in a console, can.
  update public.club_bookings
     set refund_note = 'typed against a row that owes nothing'
   where id = p_booking;
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

create or replace function pg_temp.order_row(p_order bigint)
returns public.club_merchandise_orders language sql security definer as $fn$
  select * from public.club_merchandise_orders where id = p_order $fn$;

create temp table fx as select pg_temp.seed_order() as ord;
grant select on fx to authenticated;

set local role authenticated;

do $$
declare
  w record; fx_row record; v_club bigint; v_bk bigint; n bigint; v_said text;
  v_ord public.club_merchandise_orders%rowtype;
begin
  select * into w from who;
  select * into fx_row from fx;
  select id into v_club from c;
  select id into v_bk from bk;

  perform pg_temp.be(w.owner);

  -- ====================================================================== 1
  -- BREAK TEST. The client's own report: mark it refunded with a note, then
  -- change the note. The log has to say the new words.
  -- ====================================================================== 1
  perform public.club_set_booking_payment(v_bk, 'booker', 'paid_in_advance', 'PayPal', '');
  perform public.club_set_booking_refund(
    v_bk, 'booker', 'refunded', 'PayPal', 'Refunded back via paypal as player was sick');
  perform public.club_set_booking_refund(
    v_bk, 'booker', 'refunded', 'PayPal', 'Refunded by bank transfer instead, v2');

  if pg_temp.newest_note('booking', v_bk, 'refund')
     <> 'Refunded by bank transfer instead, v2' then
    raise exception
      'FAIL 1: the log still shows "%" after the note was edited',
      pg_temp.newest_note('booking', v_bk, 'refund');
  end if;
  raise notice 'PASS 1: break test — an edited refund note reaches the log';

  -- ====================================================================== 2
  -- And the one before it is still there. This is a history, so a correction
  -- adds a line rather than quietly replacing one.
  -- ====================================================================== 2
  select count(*) into n from pg_temp.lines('booking', v_bk, 'refund');
  if n <> 2 then
    raise exception 'FAIL 2: the refund has % lines, expected 2', n;
  end if;
  raise notice 'PASS 2: the words that were there before are still there';

  -- ====================================================================== 3
  -- The payment half too, which is the same trigger and the same fault.
  -- ====================================================================== 3
  perform public.club_set_booking_payment(
    v_bk, 'booker', 'paid_in_advance', 'PayPal', 'Paid via Paypal on 16th Oct');
  if pg_temp.newest_note('booking', v_bk, 'payment')
     <> 'Paid via Paypal on 16th Oct' then
    raise exception 'FAIL 3: an edited payment note did not reach the log';
  end if;
  raise notice 'PASS 3: a payment note reaches the log the same way';

  -- ====================================================================== 4
  -- An order can say how the money went back, and the member reads it. The
  -- club's own working log stays the club's, which is what 0020 built it for.
  -- ====================================================================== 4
  perform public.club_set_order_refund(
    fx_row.ord, 'refunded', 'Cash', 'Refunded in person on games night');

  v_ord := pg_temp.order_row(fx_row.ord);
  if v_ord.status <> 'refunded' or v_ord.refunded_at is null
     or v_ord.refund_method <> 'Cash'
     or v_ord.refund_note <> 'Refunded in person on games night' then
    raise exception 'FAIL 4: the order refund did not keep when, how or why';
  end if;

  perform pg_temp.be(w.member);
  select count(*) into n
    from public.club_money_history('order', array[fx_row.ord])
   where kind = 'refund' and note = 'Refunded in person on games night';
  if n <> 1 then
    raise exception 'FAIL 4b: the member cannot read the refund note on their order';
  end if;
  raise notice 'PASS 4: an order refund carries when, how and why, and the member reads it';

  -- ====================================================================== 5
  -- Taking the refund back takes its words with it, which is 0224's rule and
  -- now has to survive a trigger that watches the words rather than only the
  -- status. Checked before section 6 writes a note of its own onto this row.
  -- ====================================================================== 5
  perform pg_temp.be(w.owner);
  perform public.club_set_booking_refund(v_bk, 'booker', 'not_due', '', '');

  select count(*) into n from public.club_bookings
   where id = v_bk and (refund_method <> '' or refund_note <> '');
  if n <> 0 then
    raise exception 'FAIL 5: a refund taken back still says how and why';
  end if;
  raise notice 'PASS 5: a refund taken back leaves no words behind';

  -- ====================================================================== 6
  -- BREAK TEST. A note typed against a row that owes nothing back writes no
  -- refund line. Without the condition it logs "No refund due" at a club that
  -- never discussed a refund.
  --
  -- Written straight at the column, because the setter blanks a `not_due`
  -- row's words and cannot reach this state. That is the point: the guard is
  -- for the writer that is not the setter.
  -- ====================================================================== 6
  select count(*) into n from pg_temp.lines('booking', v_bk, 'refund');
  perform pg_temp.scribble(v_bk);

  if (select count(*) from pg_temp.lines('booking', v_bk, 'refund')) <> n then
    raise exception
      'FAIL 6: a note on a row owing nothing back wrote a refund line';
  end if;
  raise notice 'PASS 6: break test — nothing owed back writes nothing';

  -- ====================================================================== 7
  -- An order refund is the club's, in its own words, and only in the two
  -- states that mean anything.
  -- ====================================================================== 7
  v_said := '';
  begin
    perform public.club_set_order_refund(fx_row.ord, 'nonsense', '', '');
    raise exception 'FAIL 7: an unknown refund state was accepted';
  exception when check_violation then v_said := 'refused';
  end;
  if v_said <> 'refused' then
    raise exception 'FAIL 7: the order refund guard did not refuse';
  end if;

  perform pg_temp.be(w.member);
  v_said := '';
  begin
    perform public.club_set_order_refund(fx_row.ord, 'refunded', 'Cash', 'mine now');
    raise exception 'FAIL 7b: a member refunded their own order';
  exception when insufficient_privilege then v_said := 'refused';
  end;
  if v_said <> 'refused' then
    raise exception 'FAIL 7b: the order refund guard did not refuse a member';
  end if;
  raise notice 'PASS 7: an order refund is the club''s, and only in its own words';

  raise notice '--- all 7 passed ---';
end $$;
