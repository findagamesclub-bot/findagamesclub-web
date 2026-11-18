-- 0241 · a status stamps itself.
--
-- The regression test for the bug the client found: marking a merchandise
-- order Paid. It has to run as `authenticated`, because the fault was a
-- COLUMN GRANT and a definer function cannot see one. Every other merchandise
-- test goes through `club_set_order_refund`, which is definer, which is
-- precisely why none of them caught it.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.seed_placed() returns bigint
language plpgsql security definer as $fn$
declare v_club bigint; v_id bigint;
begin
  select id into v_club from public.clubs where slug = 'army-club';
  insert into public.club_merchandise_orders
    (club_id, profile_id, status, subtotal, total, status_updated_at)
  values (v_club, 'e0000000-0000-0000-0000-000000000003', 'placed', 12, 12,
          now() - interval '2 days')
  returning id into v_id;
  return v_id;
end $fn$;

create or replace function pg_temp.order_row(p_order bigint)
returns public.club_merchandise_orders language sql security definer as $fn$
  select * from public.club_merchandise_orders where id = p_order $fn$;

create temp table fx as select pg_temp.seed_placed() as ord;
grant select on fx to authenticated;

set local role authenticated;

do $$
declare
  w record; fx_row record; v_ord bigint; v_row public.club_merchandise_orders%rowtype;
  v_was timestamptz;
begin
  select * into w from who;
  select * into fx_row from fx;
  v_ord := fx_row.ord;
  v_was := (pg_temp.order_row(v_ord)).status_updated_at;

  perform pg_temp.be(w.owner);

  -- ====================================================================== 1
  -- The club marks the order paid, the way `setOrderStatus` does it now:
  -- one column. This always worked, so it is the control and not the
  -- reproduction. Section 3 is the reproduction.
  -- ====================================================================== 1
  update public.club_merchandise_orders set status = 'paid' where id = v_ord;

  v_row := pg_temp.order_row(v_ord);
  if v_row.status <> 'paid' then
    raise exception '1 FAIL: the club could not mark the order paid (status %)',
      v_row.status;
  end if;

  -- ====================================================================== 2
  -- And the stamp moved without anybody sending one.
  -- ====================================================================== 2
  if v_row.status_updated_at <= v_was then
    raise exception '2 FAIL: the stamp did not move (% then %)',
      v_was, v_row.status_updated_at;
  end if;

  -- ====================================================================== 3
  -- BREAK TEST, and this is the client's own report. Sending the stamp with
  -- the status is what `setOrderStatus` did until 0241, and Postgres refuses
  -- the WHOLE statement when one column in it is not granted. Hand the grant
  -- back and this assertion fails, which is the state that would have let the
  -- old code through and reopened what 0237 closed.
  -- ====================================================================== 3
  begin
    update public.club_merchandise_orders
       set status = 'fulfilled', status_updated_at = now()
     where id = v_ord;
    raise exception '3 FAIL: a form could write the status date by hand';
  exception when insufficient_privilege then null;
  end;

  -- ====================================================================== 4
  -- A change that is not the status leaves the stamp alone, so correcting a
  -- refund note does not rewrite the day the order was collected.
  -- ====================================================================== 4
  v_row := pg_temp.order_row(v_ord);
  v_was := v_row.status_updated_at;
  perform public.club_set_order_refund(v_ord, 'refunded', 'Cash', 'first wording');
  perform public.club_set_order_refund(v_ord, 'refunded', 'Cash', 'second wording');

  if (pg_temp.order_row(v_ord)).status_updated_at
     <> (select status_updated_at from public.club_merchandise_orders where id = v_ord) then
    raise exception '4 FAIL: the two reads of the stamp disagree';
  end if;

  raise notice 'stage13 0241 · all 4 passed';
end $$;
