-- 0238 · a note can be meant for the member.
--
-- Section 2 is the break test that matters most and it points the other way
-- from the client's report: a note the club kept to itself must STAY kept.
-- The whole migration widens what a member may read, and the thing that must
-- not come with it is every note already typed under 0020's promise.
--
-- Section 7 is the client's own report. Mark an order refunded, come back
-- later and correct what the member reads.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- The ledger is revoked from `authenticated` outright, so every read of the
-- table itself is as postgres. Reading a fixture through a session RLS hides
-- it from has caught three suites already.
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

create or replace function pg_temp.refunds(p_order bigint) returns bigint
language sql security definer as $fn$
  select count(*) from public.club_money_events
   where scope = 'order' and entity_id = p_order and kind = 'refund' $fn$;

create or replace function pg_temp.newest_refund(p_order bigint)
returns public.club_money_events language sql security definer as $fn$
  select * from public.club_money_events
   where scope = 'order' and entity_id = p_order and kind = 'refund'
   order by id desc limit 1 $fn$;

-- Straight at the table, as a writer that predates 0238 would have done.
create or replace function pg_temp.old_note(p_order bigint) returns void
language plpgsql security definer as $fn$
declare v_club bigint; v_who uuid;
begin
  select club_id, profile_id into v_club, v_who
    from public.club_merchandise_orders where id = p_order;
  insert into public.club_money_events
    (club_id, scope, entity_id, side, profile_id, kind, note, author_id, automatic)
  values (v_club, 'order', p_order, '', v_who, 'note',
          'written before anybody chose an audience', v_who, false);
end $fn$;

create or replace function pg_temp.backdate(p_order bigint) returns void
language plpgsql security definer as $fn$ begin
  -- `now()` is the transaction's clock, so a refund and a correction made in
  -- one test transaction share it. Backdating is what lets the assertion see
  -- which of the two the trigger reached for.
  update public.club_merchandise_orders
     set refunded_at = now() - interval '1 day' where id = p_order;
end $fn$;

create temp table fx as select pg_temp.seed_order() as ord;
grant select on fx to authenticated;

set local role authenticated;

do $$
declare
  w record; fx_row record; v_ord bigint; n bigint; v_said text;
  v_ev public.club_money_events%rowtype;
begin
  select * into w from who;
  select * into fx_row from fx;
  v_ord := fx_row.ord;

  perform pg_temp.be(w.owner);

  -- ====================================================================== 1
  -- The refund's own note reaches the member, which is what 0237 built and
  -- what order 16 in the live data proves. Here as the control: section 2
  -- means nothing if the member can read nothing at all.
  -- ====================================================================== 1
  perform public.club_set_order_refund(
    v_ord, 'refund_due', '', 'Hoodie never arrived from the supplier');

  perform pg_temp.be(w.member);
  select note into v_said from public.club_money_history('order', array[v_ord])
   where kind = 'refund' order by id desc limit 1;
  if v_said is distinct from 'Hoodie never arrived from the supplier' then
    raise exception '1 FAIL: the member cannot read the refund note (%)', v_said;
  end if;

  -- ====================================================================== 2
  -- BREAK TEST. A note with no audience named is the club's own, and the
  -- member must not be able to read a word of it. Drop `and (e.kind <>
  -- 'note' or e.audience = 'member')` from the reader and this fails.
  -- ====================================================================== 2
  perform pg_temp.be(w.owner);
  perform public.add_money_note(
    'order', v_ord, '', 'chase the supplier, do not tell them yet');

  perform pg_temp.be(w.member);
  select count(*) into n from public.club_money_history('order', array[v_ord])
   where kind = 'note';
  if n <> 0 then
    raise exception '2 FAIL: the member read % of the club''s own notes', n;
  end if;

  -- ====================================================================== 3
  -- And one meant for them arrives. This is the client's items 18 and 19.
  -- ====================================================================== 3
  perform pg_temp.be(w.owner);
  perform public.add_money_note(
    'order', v_ord, '', 'refund processed back to your card. thanks', 'member');

  perform pg_temp.be(w.member);
  select count(*) into n from public.club_money_history('order', array[v_ord])
   where kind = 'note';
  if n <> 1 then
    raise exception '3 FAIL: the member read % member notes, wanted 1', n;
  end if;

  select note into v_said from public.club_money_history('order', array[v_ord])
   where kind = 'note' limit 1;
  if v_said is distinct from 'refund processed back to your card. thanks' then
    raise exception '3 FAIL: wrong note reached the member (%)', v_said;
  end if;

  -- ====================================================================== 4
  -- The club reads both, and can tell them apart.
  -- ====================================================================== 4
  perform pg_temp.be(w.owner);
  select count(*) into n from public.club_money_history('order', array[v_ord])
   where kind = 'note';
  if n <> 2 then
    raise exception '4 FAIL: the club read % of its own notes, wanted 2', n;
  end if;

  select count(*) into n from public.club_money_history('order', array[v_ord])
   where kind = 'note' and audience = 'member';
  if n <> 1 then
    raise exception '4 FAIL: % notes came back marked for the member', n;
  end if;

  -- ====================================================================== 5
  -- An audience nobody recognises is refused rather than guessed at.
  -- ====================================================================== 5
  begin
    perform public.add_money_note('order', v_ord, '', 'anyone at all', 'world');
    raise exception '5 FAIL: an unknown audience was accepted';
  exception when check_violation then null;
  end;

  -- ====================================================================== 6
  -- BREAK TEST, the backfill half. A note written before this migration has
  -- no audience of its own, and it must come out as the club's.
  -- ====================================================================== 6
  perform pg_temp.old_note(v_ord);

  perform pg_temp.be(w.member);
  select count(*) into n from public.club_money_history('order', array[v_ord])
   where kind = 'note';
  if n <> 1 then
    raise exception '6 FAIL: a note from before 0238 reached the member (% visible)', n;
  end if;

  -- ====================================================================== 7
  -- BREAK TEST, the client's report. Correct what the member reads on a
  -- refund already recorded. It writes a new line, dated when the correction
  -- was made and not when the money moved: stamp it with `refunded_at` and
  -- the member gets two lines an hour apart that both say the same time.
  -- ====================================================================== 7
  perform pg_temp.be(w.owner);
  perform public.club_set_order_refund(v_ord, 'refunded', 'Cash', 'refunded in cash');
  perform pg_temp.backdate(v_ord);

  n := pg_temp.refunds(v_ord);
  perform public.club_set_order_refund(
    v_ord, 'refunded', 'Cash', 'refunded in cash on games night, sorry for the wait');

  if pg_temp.refunds(v_ord) <> n + 1 then
    raise exception '7 FAIL: correcting the note wrote % lines', pg_temp.refunds(v_ord) - n;
  end if;

  v_ev := pg_temp.newest_refund(v_ord);
  if v_ev.happened_at < now() - interval '1 hour' then
    raise exception '7 FAIL: the correction was dated % , the old refund date', v_ev.happened_at;
  end if;

  perform pg_temp.be(w.member);
  select note into v_said from public.club_money_history('order', array[v_ord])
   where kind = 'refund' order by id desc limit 1;
  if v_said is distinct from
     'refunded in cash on games night, sorry for the wait' then
    raise exception '7 FAIL: the member still reads the old words (%)', v_said;
  end if;

  -- ====================================================================== 8
  -- Saving a refund that has not changed says nothing. A club reopening the
  -- dialog to read it must not add a line to somebody else's history.
  -- ====================================================================== 8
  perform pg_temp.be(w.owner);
  n := pg_temp.refunds(v_ord);
  perform public.club_set_order_refund(
    v_ord, 'refunded', 'Cash', 'refunded in cash on games night, sorry for the wait');
  if pg_temp.refunds(v_ord) <> n then
    raise exception '8 FAIL: an unchanged save wrote a line';
  end if;

  raise notice 'stage13 0238 · all 8 passed';
end $$;
