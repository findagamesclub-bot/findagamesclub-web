-- 0154 · An admin can look back at what was published.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- A small edition of our own, so the test does not depend on the imported
-- 11th edition being present.
insert into public.army_systems (id, label, points_options)
values ('test-system', 'Test System', array['2000'])
on conflict (id) do nothing;

insert into public.army_editions (id, system_id, label, catalogue_version, status)
values ('test-ed', 'test-system', 'Test Edition', 'v1', 'draft')
on conflict (id) do nothing;

insert into public.army_factions (edition_id, id, label, position)
values ('test-ed', 'reds', 'The Reds', 1), ('test-ed', 'blues', 'The Blues', 2)
on conflict do nothing;

insert into public.army_units (edition_id, faction_id, name, base_points, position)
values ('test-ed', 'reds', 'Red One', 100, 1),
       ('test-ed', 'reds', 'Red Two', 150, 2),
       ('test-ed', 'blues', 'Blue One', 120, 1)
on conflict do nothing;

-- The real sequence an admin goes through, and the order matters: a published
-- version is frozen, so editing it is refused until a new draft version has
-- been started. The test follows that rather than working around it.
create or replace function pg_temp.new_draft(p_version text)
returns void language sql security definer as $fn$
  update public.army_editions
     set catalogue_version = p_version, status = 'draft' where id = 'test-ed' $fn$;

create or replace function pg_temp.publish(p_note text)
returns void language sql security definer as $fn$
  select public.publish_army_catalogue('test-ed', p_note) $fn$;

create or replace function pg_temp.add_unit(p_faction text, p_name text, p_points integer)
returns void language sql security definer as $fn$
  insert into public.army_units (edition_id, faction_id, name, base_points, position)
  values ('test-ed', p_faction, p_name, p_points, 9) $fn$;

-- A list pinned to a version. The real writer is `save_army_list`, which
-- prices against the snapshot and would refuse this toy faction; what is under
-- test is the counting, so the rows go in directly as the server.
create or replace function pg_temp.pin_list(p_version text) returns void
language plpgsql security definer as $fn$
declare v_list bigint;
begin
  insert into public.army_lists
    (club_id, profile_id, name, list_type, system_id, edition_id,
     faction_id, faction_label, points_limit)
  select id, 'e0000000-0000-0000-0000-000000000003', 'Test list', 'army-list',
         'test-system', 'test-ed', 'reds', 'The Reds', '2000'
    from public.clubs where slug = 'army-club'
  returning id into v_list;

  insert into public.army_list_versions
    (list_id, version_number, name, list_type, faction_id, faction_label,
     units, total_points, edition_id, catalogue_version, signature)
  values (v_list, 1, 'Test list', 'army-list', 'reds', 'The Reds',
          '[]'::jsonb, 0, 'test-ed', p_version, 'sig');
end $fn$;

set local role authenticated;
select pg_temp.be(admin) from who;

-- ===========================================================================
-- 1. A draft is not history
-- ===========================================================================

do $$
declare v_n integer;
begin
  select count(*) into v_n from public.admin_catalogue_versions()
   where edition_id = 'test-ed';
  if v_n <> 0 then
    raise exception 'an unpublished edition appeared in the history % times', v_n;
  end if;
end $$;

-- ===========================================================================
-- 2. Publishing puts it in the history, counted from the snapshot
-- ===========================================================================

select pg_temp.publish('First cut');

do $$
declare v record;
begin
  select * into v from public.admin_catalogue_versions()
   where edition_id = 'test-ed' and catalogue_version = 'v1';

  if v.catalogue_version is null then raise exception 'v1 is not in the history'; end if;
  if v.factions <> 2 then raise exception 'v1 counted % factions', v.factions; end if;
  if v.units <> 3 then raise exception 'v1 counted % units', v.units; end if;
  if v.note <> 'First cut' then raise exception 'the note reads "%"', v.note; end if;
  if not v.is_current then raise exception 'v1 is not flagged as current'; end if;
  if v.lists <> 0 or v.results <> 0 then
    raise exception 'a fresh version already has % lists and % results', v.lists, v.results;
  end if;
end $$;

-- ===========================================================================
-- 3. The figures describe the version, not the draft that moved on
-- ===========================================================================

do $$
declare v record;
begin
  -- v1 is frozen, so a new draft version comes first. Then a unit lands in it.
  perform pg_temp.new_draft('v2');
  perform pg_temp.add_unit('blues', 'Blue Two', 90);

  select * into v from public.admin_catalogue_versions()
   where edition_id = 'test-ed' and catalogue_version = 'v1';
  if v.units <> 3 then
    raise exception 'v1 now reports % units, so it is reading the draft', v.units;
  end if;
end $$;

select pg_temp.publish('Added Blue Two');

-- ===========================================================================
-- 4. A second publish, and only one of them is current
-- ===========================================================================



do $$
declare v_old record; v_new record; v_first text;
begin
  select * into v_old from public.admin_catalogue_versions()
   where edition_id = 'test-ed' and catalogue_version = 'v1';
  select * into v_new from public.admin_catalogue_versions()
   where edition_id = 'test-ed' and catalogue_version = 'v2';

  if v_old.is_current then raise exception 'the old version is still current'; end if;
  if not v_new.is_current then raise exception 'the new version is not current'; end if;
  if v_new.units <> 4 then raise exception 'v2 counted % units', v_new.units; end if;
  -- The older one is still readable, which is the whole point.
  if v_old.units <> 3 then raise exception 'v1 changed to % units', v_old.units; end if;

  -- Newest first.
  select catalogue_version into v_first from public.admin_catalogue_versions()
   where edition_id = 'test-ed' limit 1;
  if v_first <> 'v2' then raise exception 'the list leads with %', v_first; end if;
end $$;

-- ===========================================================================
-- 5. What is pinned to a version is counted
-- ===========================================================================

do $$
declare v record;
begin
  perform pg_temp.pin_list('v1');

  select * into v from public.admin_catalogue_versions()
   where edition_id = 'test-ed' and catalogue_version = 'v1';
  if v.lists <> 1 then raise exception 'v1 counted % lists', v.lists; end if;

  select * into v from public.admin_catalogue_versions()
   where edition_id = 'test-ed' and catalogue_version = 'v2';
  if v.lists <> 0 then raise exception 'v2 counted % lists it does not hold', v.lists; end if;
end $$;

-- ===========================================================================
-- 6. The frozen catalogue comes back whole, and only to an admin
-- ===========================================================================

do $$
declare v_cat jsonb;
begin
  v_cat := public.admin_catalogue_snapshot('test-ed', 'v1');
  if v_cat is null then raise exception 'the snapshot came back empty'; end if;
  if jsonb_array_length(v_cat -> 'systems' -> 0 -> 'factions') <> 2 then
    raise exception 'the snapshot holds the wrong factions';
  end if;
  -- A version nobody published is nothing, not an error.
  if public.admin_catalogue_snapshot('test-ed', 'never') is not null then
    raise exception 'an unpublished version returned a catalogue';
  end if;
end $$;

select pg_temp.be(member) from who;

do $$ begin
  begin
    perform public.admin_catalogue_versions();
    raise exception 'a member read the version history';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.admin_catalogue_snapshot('test-ed', 'v1');
    raise exception 'a member read a frozen catalogue';
  exception when insufficient_privilege then null;
  end;
end $$;

select 'stage13-catalogue-history ok' as result;

rollback;
