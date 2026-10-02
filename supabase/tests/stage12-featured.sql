-- 0155 · A featured slot tells the club it is on one.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- A notification is readable only by the person it is for, so the test has to
-- read them as postgres. This suite has been caught by that four times now.
create or replace function pg_temp.notices(p uuid)
returns setof public.notifications language sql security definer as $fn$
  select * from public.notifications
   where profile_id = p and kind like 'featured-%' order by id $fn$;

create or replace function pg_temp.slot(
  p_from date, p_to date, p_price integer default 2000)
returns bigint language sql security definer as $fn$
  insert into public.featured_listings (club_id, starts_on, ends_on, price_pence)
  select id, p_from, p_to, p_price from c returning id $fn$;

-- ===========================================================================
-- 1. Booking one tells the owner
-- ===========================================================================

do $$
declare v_slot bigint; v_row record; v_n integer;
begin
  perform pg_temp.be((select admin from who));
  v_slot := pg_temp.slot(public.london_today(), public.london_today() + 6);

  select count(*) into v_n from pg_temp.notices((select owner from who));
  if v_n <> 1 then raise exception 'the owner got % notices for a booking', v_n; end if;

  select * into v_row from pg_temp.notices((select owner from who)) limit 1;
  if v_row.kind <> 'featured-booked' then
    raise exception 'booking wrote kind %', v_row.kind;
  end if;
  -- The dates are the whole point of the notice: a slot booked for next month
  -- is not the same news as one starting today.
  if v_row.body not like 'Featured from %to %' then
    raise exception 'booking said "%"', v_row.body;
  end if;
  if v_row.entity_type <> 'featured_listings'
     or v_row.entity_id <> v_slot::text then
    raise exception 'booking pointed at %/%', v_row.entity_type, v_row.entity_id;
  end if;

  -- Nobody is told about their own doing, and the three kinds are separate
  -- rows rather than one rewriting another, which is the 0104 trap.
  delete from public.featured_listings where id = v_slot;

  select count(*) into v_n from pg_temp.notices((select owner from who));
  if v_n <> 2 then
    raise exception 'taking a live slot down left % notices', v_n;
  end if;
  if not exists (select 1 from pg_temp.notices((select owner from who))
                  where kind = 'featured-removed') then
    raise exception 'taking a live slot down wrote no removal notice';
  end if;
end $$;

delete from public.notifications where kind like 'featured-%';

-- ===========================================================================
-- 2. An admin who owns the club is told nothing
-- ===========================================================================

do $$
declare v_n integer;
begin
  perform pg_temp.be((select owner from who));
  perform pg_temp.slot(public.london_today(), public.london_today() + 6);

  select count(*) into v_n from pg_temp.notices((select owner from who));
  if v_n <> 0 then
    raise exception 'somebody booking their own club got % notices', v_n;
  end if;
end $$;

delete from public.featured_listings;
delete from public.notifications where kind like 'featured-%';

-- ===========================================================================
-- 3. Taking down a slot that already finished is housekeeping, not news
-- ===========================================================================

do $$
declare v_slot bigint; v_n integer;
begin
  perform pg_temp.be((select admin from who));
  v_slot := pg_temp.slot(public.london_today() - 20, public.london_today() - 14);
  -- It was announced when it ended, so the owner has already heard.
  update public.featured_listings set ended_notice_at = now() where id = v_slot;
  delete from public.notifications where kind like 'featured-%';

  delete from public.featured_listings where id = v_slot;

  select count(*) into v_n from pg_temp.notices((select owner from who));
  if v_n <> 0 then
    raise exception 'tidying a finished slot wrote % notices', v_n;
  end if;
end $$;

delete from public.notifications where kind like 'featured-%';

-- ===========================================================================
-- 4. The ending is announced once, and only once
-- ===========================================================================

do $$
declare v_slot bigint; v_n integer; v_did boolean; v_row record;
begin
  perform pg_temp.be((select admin from who));
  v_slot := pg_temp.slot(public.london_today() - 10, public.london_today() - 3);
  -- A slot still running is not a candidate.
  perform pg_temp.slot(public.london_today() - 1, public.london_today() + 5);
  -- After both, not between them: booking the second one rings its own bell,
  -- and clearing too early counted that as the ending. The first version of
  -- this test failed on exactly that and the code was right.
  delete from public.notifications where kind like 'featured-%';

  select count(*) into v_n from public.featured_slots_just_ended();
  if v_n <> 1 then
    raise exception 'the job found % finished slots, expected 1', v_n;
  end if;

  v_did := public.mark_featured_announced(v_slot);
  if not v_did then raise exception 'the first announcement answered false'; end if;

  select count(*) into v_n from pg_temp.notices((select owner from who));
  if v_n <> 1 then raise exception 'the ending wrote % notices', v_n; end if;

  select * into v_row from pg_temp.notices((select owner from who)) limit 1;
  if v_row.kind <> 'featured-ended' then
    raise exception 'the ending wrote kind %', v_row.kind;
  end if;

  -- Running the job twice in a day must not write a second letter.
  v_did := public.mark_featured_announced(v_slot);
  if v_did then raise exception 'the second announcement answered true'; end if;

  select count(*) into v_n from pg_temp.notices((select owner from who));
  if v_n <> 1 then raise exception 'a second run left % notices', v_n; end if;

  select count(*) into v_n from public.featured_slots_just_ended();
  if v_n <> 0 then
    raise exception 'an announced slot is still a candidate (% left)', v_n;
  end if;
end $$;

delete from public.featured_listings;
delete from public.notifications where kind like 'featured-%';

-- ===========================================================================
-- 5. An unclaimed listing is stamped rather than asked about for ever
-- ===========================================================================

do $$
declare v_slot bigint; v_n integer;
begin
  perform pg_temp.be((select admin from who));
  update public.clubs set owner_id = null where id = (select id from c);
  delete from public.club_team where club_id = (select id from c);

  v_slot := pg_temp.slot(public.london_today() - 9, public.london_today() - 2);

  select count(*) into v_n from public.featured_slots_just_ended();
  if v_n <> 1 then
    raise exception 'an unowned club returned % candidates, expected 1', v_n;
  end if;

  if not public.mark_featured_announced(v_slot) then
    raise exception 'stamping an unowned club answered false';
  end if;

  select count(*) into v_n from public.featured_slots_just_ended();
  if v_n <> 0 then
    raise exception 'an unowned club is still a candidate after stamping';
  end if;
end $$;

-- ===========================================================================
-- 6. Nothing hands these out
-- ===========================================================================

do $$
declare v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('featured_notify', 'featured_slots_just_ended',
                       'mark_featured_announced')
     and (has_function_privilege('authenticated', p.oid, 'execute')
          or has_function_privilege('anon', p.oid, 'execute'));
  if v_bad is not null then
    raise exception 'a member can call: %', v_bad;
  end if;
end $$;

rollback;

\echo 'stage12-featured: all pass'
