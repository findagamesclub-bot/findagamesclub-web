-- 0220 · the club writes a note beside a coaching payment, and nobody else can.
--
-- The assertions that matter are 2 and 3. The note is the kind of column that
-- gets granted to `authenticated` without thinking, and the booking's own
-- update policy admits the MEMBER for their own row, so a grant here is a
-- member writing "paid in full" against their own money.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Read as postgres, so a row the reader's own policy would hide is still
-- distinguishable from a row that was never written.
create or replace function pg_temp.note(p_booking bigint)
returns text language sql security definer as $fn$
  select payment_note from public.club_coaching_bookings where id = p_booking $fn$;

create or replace function pg_temp.paid(p_booking bigint)
returns text language sql security definer as $fn$
  select payment_status from public.club_coaching_bookings where id = p_booking $fn$;

insert into public.club_coaching_settings (club_id, enabled)
  select id, true from c;
insert into public.club_coaching_slots
  (club_id, title, slot_date, start_time, price, coaching_type, capacity, status)
  select id, 'List clinic', public.london_today() + 7, '19:00', 'GBP 30',
         'one-to-one', 5, 'open' from c;

create temp table slot as
  select id from public.club_coaching_slots where title = 'List clinic';
grant select on slot to authenticated;

do $$
declare
  v_booking bigint;
  v_err     text;
  v_long    text := repeat('x', 400);
begin
  set local role authenticated;
  perform pg_temp.be((select member from who));
  insert into public.club_coaching_bookings (slot_id)
    select id from slot returning id into v_booking;

  -- ====================================================================== 1
  -- The club records the payment and what it wants to remember about it.
  -- ====================================================================== 1
  perform pg_temp.be((select owner from who));
  perform public.record_coaching_payment(v_booking, true, 'Cash on the night, ref 4471.');
  reset role;

  if pg_temp.paid(v_booking) <> 'paid' then
    raise exception 'FAIL 1: the payment was not recorded';
  end if;
  if pg_temp.note(v_booking) <> 'Cash on the night, ref 4471.' then
    raise exception 'FAIL 1: the note came back as "%"', pg_temp.note(v_booking);
  end if;
  raise notice 'PASS 1: the club records a payment and a note together';

  -- ====================================================================== 2
  -- BREAK TEST. The member cannot write the note on their own booking, which
  -- is the reason this is a function and not a column grant. If the note is
  -- ever granted to `authenticated` this is what goes red.
  -- ====================================================================== 2
  set local role authenticated;
  perform pg_temp.be((select member from who));
  begin
    update public.club_coaching_bookings
       set payment_note = 'Paid in full, honest' where id = v_booking;
    reset role;
    if pg_temp.note(v_booking) = 'Paid in full, honest' then
      raise exception
        'FAIL 2: the member wrote their own payment note — payment_note is grantable again';
    end if;
    raise notice 'PASS 2: break test — the member''s write touched no row';
  exception
    when insufficient_privilege then
      reset role;
      raise notice 'PASS 2: break test — the member''s write was refused outright';
  end;

  -- ====================================================================== 3
  -- And the function is not a way round it either.
  -- ====================================================================== 3
  set local role authenticated;
  perform pg_temp.be((select member from who));
  begin
    perform public.record_coaching_payment(v_booking, true, 'I paid, trust me');
    reset role;
    raise exception 'FAIL 3: a member recorded their own payment';
  exception
    when insufficient_privilege then
      reset role;
      raise notice 'PASS 3: a member cannot record their own payment';
  end;

  set local role authenticated;
  perform pg_temp.be((select stranger from who));
  begin
    perform public.record_coaching_payment(v_booking, true, 'Nothing to do with me');
    reset role;
    raise exception 'FAIL 3: a stranger recorded somebody else''s payment';
  exception
    when insufficient_privilege then
      reset role;
      raise notice 'PASS 3: and neither can a stranger';
  end;

  -- ====================================================================== 4
  -- A null note leaves what is stored. The session card's quick tick-off on a
  -- club night has no note field, and must not empty what the bookings list
  -- wrote.
  -- ====================================================================== 4
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  perform public.record_coaching_payment(v_booking, true, null);
  reset role;

  if pg_temp.note(v_booking) <> 'Cash on the night, ref 4471.' then
    raise exception 'FAIL 4: a null note emptied the stored one ("%")', pg_temp.note(v_booking);
  end if;
  raise notice 'PASS 4: a null note leaves what the club wrote';

  -- ====================================================================== 5
  -- An empty string is a club clearing it on purpose, which is a different
  -- thing from not knowing about notes at all.
  -- ====================================================================== 5
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  perform public.record_coaching_payment(v_booking, true, '   ');
  reset role;

  if pg_temp.note(v_booking) <> '' then
    raise exception 'FAIL 5: clearing the note left "%"', pg_temp.note(v_booking);
  end if;
  raise notice 'PASS 5: the club can clear it, and whitespace is clearing it';

  -- ====================================================================== 6
  -- Un-marking takes the note with it. A note about a payment that is no
  -- longer recorded would be read by the member under TO PAY.
  -- ====================================================================== 6
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  perform public.record_coaching_payment(v_booking, true, 'Bank transfer, 2 Nov.');
  perform public.record_coaching_payment(v_booking, false, null);
  reset role;

  if pg_temp.paid(v_booking) <> 'unpaid' then
    raise exception 'FAIL 6: the payment was not taken back';
  end if;
  if pg_temp.note(v_booking) <> '' then
    raise exception 'FAIL 6: un-marking left "%" behind', pg_temp.note(v_booking);
  end if;
  raise notice 'PASS 6: un-marking clears the note, null or not';

  -- ====================================================================== 7
  -- Long notes are cut rather than refused: a club pasting a bank statement
  -- into the box should not lose the payment with it.
  -- ====================================================================== 7
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  perform public.record_coaching_payment(v_booking, true, v_long);
  reset role;

  if length(pg_temp.note(v_booking)) <> 300 then
    raise exception 'FAIL 7: a 400 character note was stored as %',
      length(pg_temp.note(v_booking));
  end if;
  raise notice 'PASS 7: a long note is cut to 300 and the payment still lands';

  -- ====================================================================== 8
  -- Both lists carry it back, which is the whole point: the club reads it on
  -- the bookings tab and the member reads it on their own card.
  -- ====================================================================== 8
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  perform public.record_coaching_payment(v_booking, true, 'Paid at the desk.');

  if (select payment_note from public.club_coaching_bookings_list((select id from c))
       where booking_id = v_booking) <> 'Paid at the desk.' then
    reset role;
    raise exception 'FAIL 8: the club''s own list does not return the note';
  end if;

  perform pg_temp.be((select member from who));
  if (select payment_note from public.my_coaching_bookings()
       where booking_id = v_booking) <> 'Paid at the desk.' then
    reset role;
    raise exception 'FAIL 8: the member cannot read the note on their own booking';
  end if;
  reset role;
  raise notice 'PASS 8: both lists carry the note back';

  -- ====================================================================== 9
  -- A place that was called off has no payment to record.
  -- ====================================================================== 9
  set local role authenticated;
  perform pg_temp.be((select member from who));
  update public.club_coaching_bookings set status = 'cancelled' where id = v_booking;

  perform pg_temp.be((select owner from who));
  begin
    perform public.record_coaching_payment(v_booking, true, 'Too late');
    reset role;
    raise exception 'FAIL 9: a payment was recorded against a cancelled place';
  exception
    when check_violation then
      reset role;
      raise notice 'PASS 9: a cancelled place refuses a payment';
  end;

  raise notice 'ALL PASS · 0220 the coaching payment note';
end $$;

rollback;
