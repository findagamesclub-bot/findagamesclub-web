-- 0205 · what a club writes down about money, in the three places it could not.
--
-- The security assertion is 4: a table booking's payment columns are reachable
-- only through a definer function, because `club_bookings` carries three
-- permissive UPDATE policies and PostgreSQL ORs them, so a column grant would
-- have let a member mark their own table paid.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Read as postgres. A refused write touches zero rows and raises nothing from
-- a policy, so reading back through the caller's own session cannot tell a
-- refusal from a success that changed nothing.
create or replace function pg_temp.money(p_id bigint)
returns table (payment_status text, payment_method text, payment_note text,
               paid_at timestamptz, total_price numeric)
language sql security definer as $fn$
  select payment_status, payment_method, payment_note, paid_at, total_price
    from public.club_bookings where id = p_id $fn$;

-- A second table, in somebody else's name, priced at nothing: a tier that
-- waives the fee is a real thing a club sells, and the whole point of the
-- `free` group is that it is not the `topay` group.
--
-- The Thursday after, not the same one. `club_booking_participants_one_per_date`
-- allows one table per person per day and the seed already has the owner down
-- as the opponent on that night, which is also why this is a club-wide list
-- rather than a second night card.
create or replace function pg_temp.seed_free() returns bigint
language plpgsql security definer as $fn$
declare v_id bigint;
begin
  insert into public.club_bookings
    (club_id, club_session_id, session_date, booked_by, opponent_name,
     game_title, table_index, status)
  select b.club_id, b.club_session_id, b.session_date + 7,
         'e0000000-0000-0000-0000-000000000001'::uuid, 'Walk in',
         'Blood Bowl', 2, 'booked'
    from public.club_bookings b order by b.id limit 1
  returning id into v_id;

  update public.club_bookings set total_price = 0, base_price = 0 where id = v_id;
  return v_id;
end $fn$;

-- An event and one place on it, so the door list has a note to carry.
create or replace function pg_temp.seed_event() returns bigint
language plpgsql security definer as $fn$
declare v_event bigint; v_booking bigint;
begin
  insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select id, '2099-01-01-payment-test', 'Payment Test Open',
         current_date + 30, 'published'
    from public.clubs where slug = 'army-club'
  returning id into v_event;

  insert into public.club_event_bookings
    (club_id, event_id, profile_id, full_name, email, reference, status, total)
  select c.id, v_event, 'e0000000-0000-0000-0000-000000000003',
         'Member Eight', 'member8@example.com', 'FAGC-PAYTEST', 'reserved', 20
    from public.clubs c where c.slug = 'army-club'
  returning id into v_booking;

  update public.club_event_bookings
     set payment_status = 'paid_on_the_door', payment_method = 'Cash',
         payment_note = 'Short a fiver, settling next week.'
   where id = v_booking;

  return v_event;
end $fn$;

-- A featured slot to settle.
create or replace function pg_temp.seed_slot() returns bigint
language plpgsql security definer as $fn$
declare v_id bigint;
begin
  insert into public.featured_listings (club_id, starts_on, ends_on, price_pence, note)
  select id, public.london_today(), public.london_today() + 6, 2000, 'Agreed on the phone.'
    from public.clubs where slug = 'army-club'
  returning id into v_id;
  return v_id;
end $fn$;

create temp table fx as select
  pg_temp.seed_free()  as free_booking,
  pg_temp.seed_event() as event_id,
  pg_temp.seed_slot()  as slot_id;
grant select on fx to authenticated;

set local role authenticated;

do $$
declare
  w record; f record; v_bk bigint; r record; v_err text; n bigint;
begin
  select * into w from who;
  select * into f from fx;
  select id into v_bk from bk;

  -- 1 · The club records the money, and the stamp is the function's to write.
  perform pg_temp.be(w.owner);
  perform public.club_set_booking_payment(v_bk, 'paid_on_the_door', 'Cash',
    '  Handed over at the door.  ');
  select * into r from pg_temp.money(v_bk);
  if r.payment_status <> 'paid_on_the_door' then
    raise exception 'FAIL 1: the club could not mark a table paid, got %', r.payment_status;
  end if;
  if r.paid_at is null then
    raise exception 'FAIL 1b: paid_at was not stamped';
  end if;

  -- 2 · The note is kept, and trimmed. The client's whole point: a note that
  --     is saved and never read back is a note nobody wrote.
  if r.payment_note <> 'Handed over at the door.' then
    raise exception 'FAIL 2: the note came back as "%"', r.payment_note;
  end if;

  -- 3 · Back to unpaid clears the stamp, so a row marked by mistake does not
  --     keep a date saying otherwise.
  perform public.club_set_booking_payment(v_bk, 'unpaid', '', '');
  select * into r from pg_temp.money(v_bk);
  if r.paid_at is not null then
    raise exception 'FAIL 3: unpaid kept its paid_at';
  end if;
  perform public.club_set_booking_payment(v_bk, 'paid_in_advance', 'Bank transfer', 'Paid up.');

  -- 4 · A member cannot say their own table is paid. This is the assertion a
  --     column grant would have failed, because club_bookings_cancel's USING
  --     admits the booker and the policies are OR'd.
  perform pg_temp.be(w.member);
  begin
    perform public.club_set_booking_payment(v_bk, 'paid_on_the_door', 'Cash', 'I paid.');
    raise exception 'FAIL 4: the member marked their own table paid';
  exception when insufficient_privilege then null;
  end;

  -- 5 · And neither can somebody with nothing to do with the club.
  perform pg_temp.be(w.stranger);
  begin
    perform public.club_set_booking_payment(v_bk, 'unpaid', '', '');
    raise exception 'FAIL 5: a stranger moved the money on a booking';
  exception when insufficient_privilege then null;
  end;

  -- 6 · A status nobody offers is refused rather than stored.
  perform pg_temp.be(w.owner);
  begin
    perform public.club_set_booking_payment(v_bk, 'sort of paid', '', '');
    raise exception 'FAIL 6: an unknown payment status was accepted';
  exception when check_violation then null;
  end;

  -- 7 · The five groups. A free table is in `free` and NOT in `topay`: the
  --     club must not chase somebody for money their tier already covered.
  select count(*) into n from public.club_table_bookings((select id from c), 'free');
  if n <> 1 then
    raise exception 'FAIL 7: free holds % rows, expected the one priced at nothing', n;
  end if;
  select count(*) into n from public.club_table_bookings((select id from c), 'topay');
  if n <> 0 then
    raise exception 'FAIL 7b: topay holds % rows, and the only unpaid one is free', n;
  end if;
  select count(*) into n from public.club_table_bookings((select id from c), 'paid');
  if n <> 1 then
    raise exception 'FAIL 7c: paid holds % rows', n;
  end if;

  -- 8 · The counts say the same thing the list does, which is what lets a tab
  --     reading "To pay 3" be trusted.
  select topay into n from public.club_table_booking_counts((select id from c));
  if n <> 0 then
    raise exception 'FAIL 8: the counts say topay %, the list says 0', n;
  end if;
  select free into n from public.club_table_booking_counts((select id from c));
  if n <> 1 then
    raise exception 'FAIL 8b: the counts say free %', n;
  end if;

  -- 9 · The counts narrow with the search, or "To pay 3" beside a search for
  --     one person means three of somebody else's.
  select all_rows into n from public.club_table_booking_counts((select id from c), 'Blood Bowl');
  if n <> 1 then
    raise exception 'FAIL 9: a search for one game counted % rows', n;
  end if;

  -- 10 · And the list is the club's, not everybody's.
  perform pg_temp.be(w.stranger);
  begin
    perform public.club_table_bookings((select id from c));
    raise exception 'FAIL 10: a stranger read the club''s table bookings';
  exception when insufficient_privilege then null;
  end;

  -- 11 · The door list carries the note the payment dialog has been writing
  --      since 0092 and nothing has ever read.
  perform pg_temp.be(w.owner);
  select payment_note into v_err from public.club_event_door_list(f.event_id) limit 1;
  if v_err is distinct from 'Short a fiver, settling next week.' then
    raise exception 'FAIL 11: the door list said "%" for the payment note', v_err;
  end if;

  -- 12 · An admin settles a featured slot.
  perform pg_temp.be(w.admin);
  perform public.record_featured_payment(f.slot_id, true, 'Bank transfer', 'Invoice 14.');
  if not exists (select 1 from public.featured_listings
                  where id = f.slot_id and paid_at is not null
                    and paid_by = w.admin and payment_method = 'Bank transfer') then
    raise exception 'FAIL 12: the featured slot was not recorded as paid';
  end if;

  -- 13 · Unsetting clears the lot, so a slot marked by mistake keeps nothing.
  perform public.record_featured_payment(f.slot_id, false);
  if exists (select 1 from public.featured_listings
              where id = f.slot_id
                and (paid_at is not null or payment_method <> '' or payment_note <> ''
                     or paid_by is not null)) then
    raise exception 'FAIL 13: unsetting a featured payment left something behind';
  end if;
  perform public.record_featured_payment(f.slot_id, true, 'Bank transfer', 'Invoice 14.');

  -- 14 · The club cannot settle its own featured slot. Featuring is sold by
  --      us, so whether the money arrived is our word (0161).
  perform pg_temp.be(w.owner);
  begin
    perform public.record_featured_payment(f.slot_id, true, 'Cash', 'Paid, honest.');
    raise exception 'FAIL 14: a club owner recorded their own featured payment';
  exception when insufficient_privilege then null;
  end;

  -- 15 · And the ledger stops calling every slot unsettled. 0191 hardcoded
  --      false, which was honest only while nothing could say otherwise.
  perform pg_temp.be(w.admin);
  select received into v_err from public.admin_revenue_lines() where kind = 'featured' limit 1;
  if v_err <> 'true' then
    raise exception 'FAIL 15: the ledger says received=% for a slot an admin settled', v_err;
  end if;
  select method into v_err from public.admin_revenue_lines() where kind = 'featured' limit 1;
  if v_err <> 'Bank transfer' then
    raise exception 'FAIL 15b: the ledger lost the method, got "%"', v_err;
  end if;

  -- 15c · The club reads its own slot's standing, and a stranger reads none.
  --       The slot row is world-readable; whether it has been settled is not.
  perform pg_temp.be(w.owner);
  select count(*) into n from public.featured_payment_standing(array[f.slot_id]);
  if n <> 1 then
    raise exception 'FAIL 15c: the club could not read its own slot''s standing';
  end if;
  perform pg_temp.be(w.stranger);
  select count(*) into n from public.featured_payment_standing(array[f.slot_id]);
  if n <> 0 then
    raise exception 'FAIL 15d: a stranger read whether a club had paid';
  end if;
  perform pg_temp.be(w.admin);

  -- 16 · 0203's fallback survived the rewrite. A fee taken for a listing that
  --      has not become a club yet still names the listing, and rebuilding
  --      this function from 0202 instead of 0203 is how that goes missing.
  --
  --      A canary over the source text rather than a behaviour test, and said
  --      out loud because it is the weaker thing: proving it properly needs a
  --      submission, a subscription and a payment, and what is being guarded
  --      against is retyping a function from an older copy of itself. The
  --      first version of this read `from pg_get_functiondef(...) d where d
  --      like ...`, which passed just as happily with the fallback removed.
  if position('sub.club_name' in
              pg_get_functiondef('public.admin_revenue_lines(date, date)'::regprocedure)) = 0 then
    raise exception 'FAIL 16: the ledger lost 0203''s submission-name fallback';
  end if;
end $$;

rollback;

\echo '0205 marking a payment: all pass'
