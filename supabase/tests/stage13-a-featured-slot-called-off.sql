-- 0232 · a featured slot can be called off, and the money given back.
--
-- Section 3 is the break test and it is the one that matters: a cancelled
-- slot must come OFF the homepage. `featured_clubs` picks by date alone, so
-- without its new clause the club keeps leading the front page until the end
-- date and the cancellation is a note nobody acted on.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage7-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.row_of(p_slot bigint)
returns public.featured_listings language sql security definer as $fn$
  select * from public.featured_listings where id = p_slot $fn$;

-- A slot running today, so "is it on the homepage" is a real question.
create or replace function pg_temp.seed_slot() returns bigint
language plpgsql security definer as $fn$
declare v_club bigint; v_id bigint;
begin
  select id into v_club from public.clubs where slug = 'badge-club';
  insert into public.featured_listings
    (club_id, starts_on, ends_on, price_pence, note)
  values (v_club, public.london_today() - 1, public.london_today() + 6,
          2000, 'A week on the front page')
  returning id into v_id;
  return v_id;
end $fn$;

create temp table slot as select pg_temp.seed_slot() as id;
grant select on slot to authenticated;

set local role authenticated;

do $$
declare
  w record; v_slot bigint; v_row public.featured_listings%rowtype;
  n bigint; v_counts jsonb; v_said text;
begin
  select * into w from who;
  select id into v_slot from slot;
  perform pg_temp.be(w.admin);

  -- ====================================================================== 1
  -- It is on the homepage to begin with, or nothing below proves anything.
  -- ====================================================================== 1
  select count(*) into n from public.featured_clubs(6) f
   where f.club_id = (select club_id from pg_temp.row_of(v_slot)) and f.paid;
  if n <> 1 then
    raise exception 'FAIL 1: the slot is not on the homepage to start with';
  end if;
  raise notice 'PASS 1: a live slot leads the homepage';

  -- ====================================================================== 2
  -- The club pays, then changes its mind. The payment stays on the record
  -- and a refund is owed, which is the client''s whole scenario.
  -- ====================================================================== 2
  perform public.record_featured_payment(v_slot, true, 'Bank transfer', 'Paid 1 Nov.');
  perform public.cancel_featured_slot(v_slot, true, '  Changed their mind.  ');

  v_row := pg_temp.row_of(v_slot);
  if v_row.cancelled_at is null then
    raise exception 'FAIL 2: the slot was not called off';
  end if;
  if v_row.cancel_reason <> 'Changed their mind.' then
    raise exception 'FAIL 2b: the reason came back as "%"', v_row.cancel_reason;
  end if;
  if v_row.refund_status <> 'due' then
    raise exception 'FAIL 2c: a paid slot was called off and nothing is owed (%)',
      v_row.refund_status;
  end if;
  if v_row.paid_at is null or v_row.payment_method <> 'Bank transfer' then
    raise exception 'FAIL 2d: cancelling threw away how the money arrived';
  end if;
  raise notice 'PASS 2: calling off a paid slot keeps the payment and owes it back';

  -- ====================================================================== 3
  -- BREAK TEST. It is off the homepage from that moment, whatever its dates
  -- still say. This is the assertion the whole item rests on.
  -- ====================================================================== 3
  select count(*) into n from public.featured_clubs(6) f
   where f.club_id = (select club_id from pg_temp.row_of(v_slot)) and f.paid;
  if n <> 0 then
    raise exception
      'FAIL 3: a cancelled slot is still leading the homepage — featured_clubs '
      'is picking on dates alone';
  end if;
  raise notice 'PASS 3: break test — a cancelled slot comes off the homepage';

  -- ====================================================================== 4
  -- The admin settles it, and the refund carries when, how and the note.
  -- ====================================================================== 4
  perform public.set_featured_refund(v_slot, 'refunded', 'Bank transfer', 'Sent back.');
  v_row := pg_temp.row_of(v_slot);
  if v_row.refund_status <> 'refunded' or v_row.refunded_at is null
     or v_row.refund_method <> 'Bank transfer' then
    raise exception 'FAIL 4: the refund did not record (% / % / %)',
      v_row.refund_status, v_row.refunded_at, v_row.refund_method;
  end if;
  raise notice 'PASS 4: the refund carries when, how and what was written';

  -- ====================================================================== 5
  -- Taking it back clears all three, which is 0224's rule.
  -- ====================================================================== 5
  perform public.set_featured_refund(v_slot, 'due', '', '');
  v_row := pg_temp.row_of(v_slot);
  if v_row.refunded_at is not null
     or v_row.refund_method <> '' or v_row.refund_note <> '' then
    raise exception 'FAIL 5: a refund taken back still says it went out on % by %',
      v_row.refunded_at, v_row.refund_method;
  end if;
  raise notice 'PASS 5: taking a refund back clears when and how';

  -- ====================================================================== 6
  -- Putting the slot back puts it on the homepage and drops the reason.
  -- ====================================================================== 6
  perform public.cancel_featured_slot(v_slot, false, '');
  v_row := pg_temp.row_of(v_slot);
  if v_row.cancelled_at is not null or v_row.cancel_reason <> '' then
    raise exception 'FAIL 6: putting it back kept the cancellation (% / %)',
      v_row.cancelled_at, v_row.cancel_reason;
  end if;
  select count(*) into n from public.featured_clubs(6) f
   where f.club_id = v_row.club_id and f.paid;
  if n <> 1 then
    raise exception 'FAIL 6b: a slot put back is not on the homepage again';
  end if;
  raise notice 'PASS 6: putting it back restores it, reason and all';

  -- ====================================================================== 7
  -- A slot nobody paid for cannot be refunded.
  -- ====================================================================== 7
  perform public.record_featured_payment(v_slot, false, '', '');
  v_said := '';
  begin
    perform public.set_featured_refund(v_slot, 'refunded', 'Cash', '');
    raise exception 'FAIL 7: an unpaid slot was refunded';
  exception when check_violation then v_said := 'refused';
  end;
  if v_said <> 'refused' then
    raise exception 'FAIL 7: the guard did not refuse an unpaid slot';
  end if;
  raise notice 'PASS 7: nothing taken, nothing to give back';

  -- ====================================================================== 8
  -- The admin board can ask for the three new groups, and the counts agree.
  -- ====================================================================== 8
  perform public.record_featured_payment(v_slot, true, 'Cash', '');
  perform public.cancel_featured_slot(v_slot, true, 'Off again.');

  select count(*) into n from public.admin_featured_slots(
    'cancelled', '', '', '', null, 'newest', 1, 50);
  if n <> 1 then
    raise exception 'FAIL 8: the Cancelled group holds % slots', n;
  end if;
  select count(*) into n from public.admin_featured_slots(
    'refunddue', '', '', '', null, 'newest', 1, 50);
  if n <> 1 then
    raise exception 'FAIL 8b: the Refund due group holds % slots', n;
  end if;
  -- And a cancelled slot is in neither money group: nobody chases it and
  -- nobody counts it as taken.
  select count(*) into n from public.admin_featured_slots(
    'paid', '', '', '', null, 'newest', 1, 50);
  if n <> 0 then
    raise exception 'FAIL 8c: a cancelled slot is still counted as paid';
  end if;

  v_counts := public.admin_featured_counts('', '', '', null);
  if (v_counts ->> 'cancelled')::int <> 1
     or (v_counts ->> 'refunddue')::int <> 1
     or (v_counts ->> 'paid')::int <> 0 then
    raise exception 'FAIL 8d: the counts say %', v_counts;
  end if;
  raise notice 'PASS 8: the board can ask for cancelled, owed and refunded';

  -- ====================================================================== 9
  -- The live figure on the Slots tab stops counting it too, or the number an
  -- admin trusts to mean "somebody should look" counts a called-off booking.
  -- ====================================================================== 9
  if (public.admin_featured_facets('', '', '', null) ->> 'live')::int <> 0 then
    raise exception 'FAIL 9: the live figure still counts a cancelled slot';
  end if;
  raise notice 'PASS 9: and the live figure drops it as well';

  -- ===================================================================== 10
  -- None of it is anybody else's. Featuring is a placement we sell, so a
  -- club cannot call off its own slot or write off its own money.
  -- ===================================================================== 10
  perform pg_temp.be(w.owner);
  v_said := '';
  begin
    perform public.cancel_featured_slot(v_slot, false, '');
    raise exception 'FAIL 10: a club owner un-cancelled their own slot';
  exception when insufficient_privilege then v_said := 'refused';
  end;
  begin
    perform public.set_featured_refund(v_slot, 'refunded', 'Cash', '');
    raise exception 'FAIL 10: a club owner recorded their own refund';
  exception when insufficient_privilege then v_said := v_said || ' refused';
  end;
  if v_said <> 'refused refused' then
    raise exception 'FAIL 10: a guard let a club owner through';
  end if;
  raise notice 'PASS 10: only an admin calls one off or gives the money back';

  raise notice 'ALL PASS · 0232 a featured slot called off';
end $$;

rollback;
