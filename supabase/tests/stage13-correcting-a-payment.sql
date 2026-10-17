-- 0195 · the club correcting a payment it already recorded.
--
-- 0012 made this ledger insert-only and the only correction was the SQL
-- console. What matters here is that loosening it did not loosen the three
-- things 0012 was really protecting: somebody else's ledger, the row's
-- identity, and the row existing at all.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Read as postgres. A blocked UPDATE touches zero rows and raises nothing, so
-- reading the row back through the caller's own session cannot tell a refusal
-- from a success that changed nothing.
create or replace function pg_temp.paid(p_id bigint)
returns table (note text, price text, edited_at timestamptz, edited_by uuid,
               membership_id bigint, recorded_by uuid)
language sql security definer as $fn$
  select note, price, edited_at, edited_by, membership_id, recorded_by
    from public.club_membership_payments where id = p_id $fn$;

create or replace function pg_temp.seed_payment()
returns bigint language plpgsql security definer as $fn$
declare v_id bigint;
begin
  insert into public.club_membership_payments
    (membership_id, club_id, profile_id, tier_key, tier_label,
     billing_option_label, price, price_duration, period_start_at,
     period_end_at, note, recorded_by)
  select m.id, m.club_id, m.profile_id, 'basic', 'Basic',
         'Monthly', 'GBP 10', 'month', now(), now() + interval '1 month',
         'Cash at the door', 'e0000000-0000-0000-0000-000000000001'
    from public.club_memberships m
   where m.profile_id = 'e0000000-0000-0000-0000-000000000003'
   limit 1
  returning id into v_id;
  return v_id;
end $fn$;

create temp table p as select pg_temp.seed_payment() as id;
grant select on p to authenticated;

set local role authenticated;

do $$
declare w record; v_p bigint; r record; v_err text;
begin
  select * into w from who;
  select id into v_p from p;

  -- 1 · The club corrects the note, and it sticks.
  perform pg_temp.be(w.owner);
  update public.club_membership_payments
     set note = 'Bank transfer, not cash' where id = v_p;
  select * into r from pg_temp.paid(v_p);
  if r.note <> 'Bank transfer, not cash' then
    raise exception 'FAIL 1: the club could not correct the note: %', r.note;
  end if;

  -- 2 · The correction is stamped, and by the trigger rather than the caller:
  -- `edited_by` is not in the column grant at all.
  if r.edited_at is null or r.edited_by <> w.owner then
    raise exception 'FAIL 2: the correction left no mark: at=%, by=%',
      r.edited_at, r.edited_by;
  end if;

  -- 3 · The money is correctable too, which is the half the client asked for.
  update public.club_membership_payments
     set price = 'GBP 15', billing_option_label = 'Monthly (corrected)'
   where id = v_p;
  select * into r from pg_temp.paid(v_p);
  if r.price <> 'GBP 15' then
    raise exception 'FAIL 3: the price did not correct: %', r.price;
  end if;

  -- 4 · A stranger cannot. Zero rows, no error, so the value is the test.
  perform pg_temp.be(w.stranger);
  update public.club_membership_payments set note = 'owned by nobody' where id = v_p;
  select * into r from pg_temp.paid(v_p);
  if r.note = 'owned by nobody' then
    raise exception 'FAIL 4: a stranger corrected somebody else''s payment';
  end if;

  -- 5 · Nor the member it belongs to. They may READ their own ledger, which is
  -- 0012's select policy, and reading is not writing.
  perform pg_temp.be(w.member);
  update public.club_membership_payments set note = 'I paid more than that' where id = v_p;
  select * into r from pg_temp.paid(v_p);
  if r.note = 'I paid more than that' then
    raise exception 'FAIL 5: the member rewrote their own payment record';
  end if;

  -- 6 · The row's identity is not correctable. Not in the grant, so this is a
  -- privilege error rather than a silent no-op.
  perform pg_temp.be(w.owner);
  begin
    update public.club_membership_payments set membership_id = 999999 where id = v_p;
    raise exception 'FAIL 6: a payment was moved to another membership';
  exception
    when insufficient_privilege then null;
    when foreign_key_violation then
      raise exception 'FAIL 6: membership_id was grantable, the FK is what stopped it';
  end;

  -- 7 · Neither is who first wrote it down.
  begin
    update public.club_membership_payments set recorded_by = w.stranger where id = v_p;
    raise exception 'FAIL 7: the club rewrote who recorded the payment';
  exception when insufficient_privilege then null;
  end;

  -- 8 · And a payment still cannot be made to disappear, which is the half of
  -- 0012 that was never in question.
  begin
    delete from public.club_membership_payments where id = v_p;
    select * into r from pg_temp.paid(v_p);
    if r.note is null then
      raise exception 'FAIL 8: a payment was deleted';
    end if;
  exception when insufficient_privilege then null;
  end;

  raise notice 'all eight pass';
end $$;

reset role;
rollback;
