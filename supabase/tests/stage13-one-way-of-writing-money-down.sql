-- 0233 · one way of writing money down, everywhere.
--
-- Two break tests, both about a log saying something that is not true:
--   section 4  a refund must not leave the renewal marked "corrected", or the
--              ledger says the club typed the original entry wrong.
--   section 8  a stranger must read nothing. The reader is SECURITY DEFINER,
--              so RLS is not what stops them and the guard has to be.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Read the ledger as postgres. It is revoked from `authenticated` entirely, so
-- a fixture read through a session reads empty whether it was written or not,
-- which is the trap three suites have already fallen into.
create or replace function pg_temp.backwards() returns bigint
language sql security definer as $fn$
  select count(*)
    from public.club_money_events r
    join public.club_money_events p
      on p.scope = r.scope and p.entity_id = r.entity_id and p.side = r.side
     and p.kind = 'payment'
   where r.kind = 'refund' and r.happened_at < p.happened_at $fn$;

create or replace function pg_temp.events(p_scope text, p_entity bigint)
returns table (kind text, state text, method text, note text,
               side text, at timestamptz, automatic boolean)
language sql security definer as $fn$
  select e.kind, e.state, e.method, e.note, e.side, e.happened_at, e.automatic
    from public.club_money_events e
   where e.scope = p_scope and e.entity_id = p_entity
   order by e.id $fn$;

create or replace function pg_temp.seed_membership_payment() returns bigint
language plpgsql security definer as $fn$
declare v_club bigint; v_mem bigint; v_id bigint;
begin
  select id into v_club from public.clubs where slug = 'army-club';
  select id into v_mem from public.club_memberships
   where club_id = v_club and profile_id = 'e0000000-0000-0000-0000-000000000003';
  insert into public.club_membership_payments
    (club_id, membership_id, profile_id, tier_key, tier_label,
     billing_option_label, price, price_duration, period_start_at,
     period_end_at, note, recorded_by)
  values (v_club, v_mem, 'e0000000-0000-0000-0000-000000000003', 'basic',
          'Basic', 'Yearly', '£30', 'year', current_date,
          current_date + 365, 'Cash at the door',
          'e0000000-0000-0000-0000-000000000001')
  returning id into v_id;
  return v_id;
end $fn$;

create or replace function pg_temp.seed_listing_payment() returns bigint
language plpgsql security definer as $fn$
declare v_club bigint; v_sub bigint; v_id bigint;
begin
  select id into v_club from public.clubs where slug = 'army-club';
  insert into public.listing_subscriptions
    (club_id, owner_id, plan_interval, price_pence, status)
  values (v_club, 'e0000000-0000-0000-0000-000000000001', 'monthly', 1500, 'active')
  returning id into v_sub;
  insert into public.listing_payments
    (subscription_id, club_id, amount_pence, currency, kind, method,
     paid_at, reference, note, recorded_by)
  values (v_sub, v_club, 1500, 'GBP', 'subscription', 'bank_transfer',
          current_date, 'REF-1', 'First month',
          'e0000000-0000-0000-0000-000000000002')
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
  values (v_club, 'e0000000-0000-0000-0000-000000000003', 'placed', 12, 12)
  returning id into v_id;
  return v_id;
end $fn$;

create or replace function pg_temp.set_order(p_order bigint, p_status text)
returns void language plpgsql security definer as $fn$ begin
  update public.club_merchandise_orders set status = p_status where id = p_order;
end $fn$;

create or replace function pg_temp.seed_coaching() returns bigint
language plpgsql security definer as $fn$
declare v_club bigint; v_slot bigint; v_id bigint;
begin
  select id into v_club from public.clubs where slug = 'army-club';
  insert into public.club_coaching_slots
    (club_id, title, slot_date, start_time, end_time, capacity, price)
  values (v_club, 'Painting clinic', current_date + 14, '19:00', '21:00', 4, '£10')
  returning id into v_slot;
  -- The booking's own trigger asks whether auth.uid() is an approved member,
  -- so the fixture has to be somebody rather than nobody.
  perform set_config('request.jwt.claims',
    json_build_object('sub', 'e0000000-0000-0000-0000-000000000003',
                      'role', 'authenticated')::text, true);
  insert into public.club_coaching_bookings
    (slot_id, profile_id, status, payment_status)
  values (v_slot, 'e0000000-0000-0000-0000-000000000003', 'booked', 'unpaid')
  returning id into v_id;
  perform set_config('request.jwt.claims', '', true);
  return v_id;
end $fn$;

create temp table fx as select
  pg_temp.seed_membership_payment() as pay,
  pg_temp.seed_listing_payment()    as listing,
  pg_temp.seed_order()              as ord,
  pg_temp.seed_coaching()           as coaching;
grant select on fx to authenticated;

set local role authenticated;

do $$
declare
  w record; f record; v_club bigint; v_bk bigint; n bigint; v_said text;
  e record;
begin
  select * into w from who;
  select * into f from fx;
  select id into v_club from c;
  select id into v_bk from bk;

  -- ====================================================================== 1
  -- A table booking: the payment is a line in the log, carrying the date the
  -- money arrived rather than the date somebody wrote it down.
  -- ====================================================================== 1
  perform pg_temp.be(w.owner);
  perform public.club_set_booking_payment(v_bk, 'booker', 'paid_on_the_door', 'Cash', 'At the door');

  select count(*) into n from pg_temp.events('booking', v_bk)
   where kind = 'payment' and state = 'paid_on_the_door'
     and method = 'Cash' and side = 'booker';
  if n <> 1 then
    raise exception 'FAIL 1: a table payment wrote % lines, expected 1', n;
  end if;
  raise notice 'PASS 1: a table payment writes one line, with how and when';

  -- ====================================================================== 2
  -- And the refund is a second line rather than a replacement, which is the
  -- half an accounts record is for.
  -- ====================================================================== 2
  perform public.club_set_booking_refund(v_bk, 'booker', 'refunded', 'Bank transfer', 'Sent back');
  select count(*) into n from pg_temp.events('booking', v_bk) where side = 'booker';
  if n <> 2 then
    raise exception 'FAIL 2: the booker''s half has % lines, expected 2', n;
  end if;
  select count(*) into n from pg_temp.events('booking', v_bk)
   where kind = 'refund' and state = 'refunded' and method = 'Bank transfer';
  if n <> 1 then
    raise exception 'FAIL 2b: the refund is not in the log';
  end if;
  raise notice 'PASS 2: the refund joins the payment rather than replacing it';

  -- ====================================================================== 3
  -- A renewal. The row IS the payment, so the log begins at the insert; a
  -- history that began at the first correction would be a history of
  -- corrections.
  -- ====================================================================== 3
  select count(*) into n from pg_temp.events('membership', f.pay)
   where kind = 'payment' and state = 'recorded';
  if n <> 1 then
    raise exception 'FAIL 3: a recorded renewal wrote % lines, expected 1', n;
  end if;
  raise notice 'PASS 3: a renewal is logged the moment it is written down';

  -- ====================================================================== 4
  -- BREAK TEST. Refunding a renewal must not mark it corrected. The row is
  -- still exactly what the club wrote; the money went back afterwards.
  -- ====================================================================== 4
  perform public.club_set_membership_payment_refund(
    f.pay, 'refunded', 'Bank transfer', 'Left the club');

  select count(*) into n from pg_temp.events('membership', f.pay)
   where kind = 'status' and state = 'corrected';
  if n <> 0 then
    raise exception
      'FAIL 4: a refund marked the renewal corrected (% lines say so)', n;
  end if;
  select count(*) into n from pg_temp.events('membership', f.pay)
   where kind = 'refund' and state = 'refunded' and method = 'Bank transfer';
  if n <> 1 then
    raise exception 'FAIL 4b: the renewal refund is not in the log';
  end if;
  raise notice 'PASS 4: break test — a refund is not a correction';

  -- ====================================================================== 5
  -- And a real correction still is one. 0195''s mark survives.
  -- ====================================================================== 5
  update public.club_membership_payments
     set note = 'Cheque, not cash' where id = f.pay;
  select count(*) into n from pg_temp.events('membership', f.pay)
   where kind = 'status' and state = 'corrected';
  if n <> 1 then
    raise exception 'FAIL 5: correcting a renewal wrote % lines, expected 1', n;
  end if;
  raise notice 'PASS 5: a correction is still logged as one';

  -- ====================================================================== 6
  -- A shop order. The kind is read off the status: money reads as money, and
  -- "fulfilled" does not.
  -- ====================================================================== 6
  perform pg_temp.set_order(f.ord, 'paid');
  perform pg_temp.set_order(f.ord, 'fulfilled');
  perform pg_temp.set_order(f.ord, 'refunded');

  select count(*) into n from pg_temp.events('order', f.ord)
   where (kind = 'payment' and state = 'paid')
      or (kind = 'status'  and state = 'fulfilled')
      or (kind = 'refund'  and state = 'refunded');
  if n <> 3 then
    raise exception 'FAIL 6: the order log has % of the 3 expected lines', n;
  end if;
  raise notice 'PASS 6: an order logs money as money and the rest as a status';

  -- ====================================================================== 7
  -- Coaching could say money was owed back and never say it went. Now it can,
  -- and taking the refund back clears the date, the method and the note.
  -- ====================================================================== 7
  perform public.record_coaching_payment(f.coaching, true, 'Cash on the night');
  perform public.club_set_coaching_refund(f.coaching, 'refunded', 'Cash', 'Handed back');

  select count(*) into n from pg_temp.events('coaching', f.coaching)
   where kind = 'refund' and state = 'refunded' and method = 'Cash';
  if n <> 1 then
    raise exception 'FAIL 7: a coaching refund is not in the log';
  end if;

  perform public.club_set_coaching_refund(f.coaching, 'not_due', '', '');
  select count(*) into n from public.club_coaching_bookings
   where id = f.coaching
     and (refunded_at is not null or refund_method <> '' or refund_note <> '');
  if n <> 0 then
    raise exception
      'FAIL 7b: a coaching refund taken back still says when and how it went';
  end if;
  raise notice 'PASS 7: coaching records when and how, and lets go of both';

  -- ====================================================================== 8
  -- BREAK TEST. The reader is SECURITY DEFINER, so RLS is not what stops a
  -- stranger and the guard inside it has to be.
  -- ====================================================================== 8
  perform pg_temp.be(w.stranger);
  select count(*) into n from public.club_money_history('booking', array[v_bk]);
  if n <> 0 then
    raise exception 'FAIL 8: a stranger read % lines of a club''s money', n;
  end if;
  raise notice 'PASS 8: break test — a stranger reads nothing';

  -- ====================================================================== 9
  -- The member reads their own, which is the client''s "shown on the front
  -- end for both owner and member". The booking is theirs: they booked it.
  -- ====================================================================== 9
  perform pg_temp.be(w.member);
  select count(*) into n from public.club_money_history('booking', array[v_bk])
   where side = 'booker';
  if n <> 2 then
    raise exception
      'FAIL 9: the member reads % lines of their own booking, expected 2', n;
  end if;
  select count(*) into n from public.club_money_history('membership', array[f.pay]);
  if n < 1 then
    raise exception 'FAIL 9b: the member cannot read their own renewal history';
  end if;
  raise notice 'PASS 9: a member reads the money that is theirs';

  -- ===================================================================== 10
  -- BREAK TEST. The club's own typed notes stay the club's. The shop's log
  -- has been "members never see these" since 0020, and making the whole site
  -- consistent must not quietly open that up: every automatic line is about
  -- the member and goes to them, and a note somebody typed does not.
  -- ===================================================================== 10
  v_said := '';
  begin
    perform public.add_money_note('booking', v_bk, 'booker', 'I paid, honest');
    raise exception 'FAIL 10: a member wrote a line into the club''s money log';
  exception when insufficient_privilege then v_said := 'refused';
  end;
  if v_said <> 'refused' then
    raise exception 'FAIL 10: the note guard did not refuse a member';
  end if;

  perform pg_temp.be(w.owner);
  perform public.add_money_note('booking', v_bk, 'booker', '  Settled in person.  ');
  select count(*) into n from pg_temp.events('booking', v_bk)
   where kind = 'note' and note = 'Settled in person.' and automatic = false;
  if n <> 1 then
    raise exception 'FAIL 10b: the club''s own note did not land';
  end if;

  select count(*) into n from public.club_money_history('booking', array[v_bk])
   where kind = 'note';
  if n <> 1 then
    raise exception 'FAIL 10c: the club cannot read its own note';
  end if;

  perform pg_temp.be(w.member);
  select count(*) into n from public.club_money_history('booking', array[v_bk])
   where kind = 'note';
  if n <> 0 then
    raise exception
      'FAIL 10d: the member read % of the club''s own working notes', n;
  end if;
  -- And still reads the money, so the narrowing took nothing it should keep.
  select count(*) into n from public.club_money_history('booking', array[v_bk]);
  if n <> 2 then
    raise exception
      'FAIL 10e: narrowing notes cost the member their money history (% lines)', n;
  end if;
  raise notice 'PASS 10: break test — the club''s notes stay the club''s, the money does not';

  -- ===================================================================== 11
  -- A listing payment, which nothing could correct before. The admin can; a
  -- club owner cannot, because the row is our record of receiving their money.
  -- ===================================================================== 11
  select count(*) into n from pg_temp.events('listing', f.listing) where kind = 'payment';
  if n <> 1 then
    raise exception 'FAIL 11: a listing payment wrote % lines, expected 1', n;
  end if;

  v_said := '';
  begin
    perform public.admin_correct_listing_payment(
      f.listing, 9999, 'cash', current_date, 'X', 'nope');
    raise exception 'FAIL 11b: a club owner corrected our billing ledger';
  exception when insufficient_privilege then v_said := 'refused';
  end;
  if v_said <> 'refused' then
    raise exception 'FAIL 11b: the correction guard did not refuse an owner';
  end if;

  perform pg_temp.be(w.admin);
  perform public.admin_correct_listing_payment(
    f.listing, 1200, 'cheque', current_date, 'REF-2', 'Was £15, cheque was £12');
  select count(*) into n from pg_temp.events('listing', f.listing)
   where kind = 'status' and state = 'corrected';
  if n <> 1 then
    raise exception 'FAIL 11c: correcting a listing payment was not logged';
  end if;

  perform public.admin_set_listing_payment_refund(
    f.listing, 'refunded', 'Bank transfer', 'Club closed');
  select count(*) into n from pg_temp.events('listing', f.listing)
   where kind = 'refund' and state = 'refunded';
  if n <> 1 then
    raise exception 'FAIL 11d: refunding a listing payment was not logged';
  end if;
  raise notice 'PASS 11: an admin can correct and refund a listing payment, and both are logged';

  -- ===================================================================== 12
  -- The owner of the listing reads their own billing history, which is what
  -- `money_entity_owner` points at for a scope with no club team.
  -- ===================================================================== 12
  perform pg_temp.be(w.owner);
  select count(*) into n from public.club_money_history('listing', array[f.listing]);
  if n < 3 then
    raise exception
      'FAIL 12: the club reads % lines of its own billing, expected 3 or more', n;
  end if;
  raise notice 'PASS 12: a club reads its own billing history';

  -- ===================================================================== 13
  -- No log line says the money went back before it came in. 0235 found one
  -- that did, on a coaching place cancelled in August and paid for in
  -- November: the backfill had no refund date to use and reached for the
  -- cancellation. The payment is the floor, whatever else is unknown.
  -- ===================================================================== 13
  n := pg_temp.backwards();
  if n <> 0 then
    raise exception
      'FAIL 13: % refunds are logged before the payment they answer', n;
  end if;
  raise notice 'PASS 13: nothing went back before it came in';

  raise notice '--- all 13 passed ---';
end $$;
