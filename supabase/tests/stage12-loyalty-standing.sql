-- 0156 · Who can see what rung somebody is on.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- The scheme has to be on, or there is no standing to report.
insert into public.club_loyalty_settings (club_id, enabled, point_value)
  select id, true, 0.05 from c;

-- The member has earned, and spent. Lifetime keeps the earning; available
-- carries the spend, which is the half nobody else may see.
-- `source_key` is the idempotency key every award carries, so the fixture has
-- to carry one too.
insert into public.club_loyalty_transactions
  (club_id, profile_id, kind, category, description, available_delta, lifetime_delta,
   source_key)
  select id, 'e0000000-0000-0000-0000-000000000003', 'earned', 'membership-approved',
         'Joined', 300, 300, 'test::joined' from c;
insert into public.club_loyalty_transactions
  (club_id, profile_id, kind, category, description, available_delta, lifetime_delta,
   source_key)
  select id, 'e0000000-0000-0000-0000-000000000003', 'spent', 'game-booking',
         'Paid for a table', -120, 0, 'test::spend' from c;

-- ===========================================================================
-- 1. A clubmate sees the lifetime total, and only that
-- ===========================================================================

do $$
declare v_row record; v_n integer;
begin
  -- The owner is an approved member of this club in the shared seed.
  perform pg_temp.be((select owner from who));

  select count(*) into v_n
    from public.member_loyalty_standing(
      'e0000000-0000-0000-0000-000000000003', array[(select id from c)]);
  if v_n <> 1 then raise exception 'a clubmate got % rows', v_n; end if;

  select * into v_row
    from public.member_loyalty_standing(
      'e0000000-0000-0000-0000-000000000003', array[(select id from c)]);

  -- 300 earned, and the 120 spend does not touch it. Reading 180 here would
  -- mean the function had handed back the spendable balance.
  if v_row.lifetime <> 300 then
    raise exception 'lifetime came back as %, expected 300', v_row.lifetime;
  end if;
end $$;

-- ===========================================================================
-- 2. Somebody outside the club sees nothing
-- ===========================================================================

do $$
declare v_n integer;
begin
  perform pg_temp.be((select stranger from who));
  select count(*) into v_n
    from public.member_loyalty_standing(
      'e0000000-0000-0000-0000-000000000003', array[(select id from c)]);
  if v_n <> 0 then
    raise exception 'a stranger read % rows of somebody else''s standing', v_n;
  end if;
end $$;

-- ===========================================================================
-- 3. A club the scheme is off at reports nothing
-- ===========================================================================

do $$
declare v_n integer;
begin
  update public.club_loyalty_settings set enabled = false
   where club_id = (select id from c);

  perform pg_temp.be((select owner from who));
  select count(*) into v_n
    from public.member_loyalty_standing(
      'e0000000-0000-0000-0000-000000000003', array[(select id from c)]);
  if v_n <> 0 then
    raise exception 'a switched-off scheme reported % standings', v_n;
  end if;

  update public.club_loyalty_settings set enabled = true
   where club_id = (select id from c);
end $$;

-- ===========================================================================
-- 4. An empty club list, and a club nobody named, both answer nothing
-- ===========================================================================

do $$
declare v_n integer;
begin
  perform pg_temp.be((select owner from who));

  select count(*) into v_n
    from public.member_loyalty_standing(
      'e0000000-0000-0000-0000-000000000003', '{}'::bigint[]);
  if v_n <> 0 then raise exception 'an empty club list returned % rows', v_n; end if;

  select count(*) into v_n
    from public.member_loyalty_standing(
      'e0000000-0000-0000-0000-000000000003', null);
  if v_n <> 0 then raise exception 'a null club list returned % rows', v_n; end if;
end $$;

-- ===========================================================================
-- 5. Nothing hands it to anon
-- ===========================================================================

do $$
begin
  if has_function_privilege('anon',
       'public.member_loyalty_standing(uuid, bigint[])', 'execute') then
    raise exception 'anon can read loyalty standings';
  end if;
end $$;

rollback;

\echo 'stage12-loyalty-standing: all pass'
