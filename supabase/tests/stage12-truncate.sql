-- 0151 · TRUNCATE, TRIGGER and REFERENCES are gone, and stay gone.
--
-- Run against a harness built WITHOUT the strict grants, then simulate what
-- Supabase really leaves behind before applying 0151:
--   scripts/pg-harness.sh build
--   scripts/pg-harness.sh psql -v ON_ERROR_STOP=1 -f supabase/tests/stage12-truncate.sql

-- ---------------------------------------------------------------------------
-- 1. Put the site into the state the live database is actually in
-- ---------------------------------------------------------------------------

-- Tables AND views. The first version of this simulated tables only, which is
-- why it passed while the real database still had a view holding all three.
do $$
declare t record;
begin
  for t in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
  loop
    execute format(
      'grant truncate, trigger, references on public.%I to anon, authenticated',
      t.relname);
  end loop;
end $$;

do $$
declare n integer;
begin
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated')
     and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');
  if n = 0 then raise exception 'the simulation granted nothing'; end if;
  raise notice 'simulated % grants across tables and views', n;
end $$;

-- What the app genuinely needs, recorded before the revoke so the comparison
-- afterwards is against fact rather than against what I remember.
create temp table kept as
  select table_name, grantee, privilege_type
    from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated')
     and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE');

-- ---------------------------------------------------------------------------
-- 2. Apply it
-- ---------------------------------------------------------------------------

\i supabase/migrations/0151_revoke_truncate.sql

-- ---------------------------------------------------------------------------
-- 3. The three are gone
-- ---------------------------------------------------------------------------

do $$
declare n integer;
begin
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated')
     and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');
  if n <> 0 then raise exception '% of the three survived', n; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. And nothing the app needs went with them
-- ---------------------------------------------------------------------------

do $$
declare missing text;
begin
  select string_agg(format('%s.%s (%s)', k.table_name, k.privilege_type, k.grantee),
                    ', ' order by k.table_name)
    into missing
    from kept k
   where not exists (
     select 1 from information_schema.role_table_grants g
      where g.table_schema = 'public'
        and g.table_name = k.table_name
        and g.grantee = k.grantee
        and g.privilege_type = k.privilege_type);

  if missing is not null then
    raise exception 'the revoke took grants the app needs: %', missing;
  end if;
end $$;

-- Named spot checks, so a future change to the loop cannot pass by making
-- `kept` empty. These are grants the site would visibly break without.
do $$
begin
  if not exists (select 1 from information_schema.role_table_grants
                  where table_name = 'clubs' and grantee = 'anon'
                    and privilege_type = 'SELECT') then
    raise exception 'anon can no longer read clubs';
  end if;
  if not exists (select 1 from information_schema.role_column_grants
                  where table_name = 'clubs' and grantee = 'authenticated'
                    and privilege_type = 'UPDATE' and column_name = 'summary') then
    raise exception 'an owner can no longer edit the club summary';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Running it twice changes nothing
-- ---------------------------------------------------------------------------

\i supabase/migrations/0151_revoke_truncate.sql

-- ---------------------------------------------------------------------------
-- 6. A table added afterwards does not get them back
-- ---------------------------------------------------------------------------

/*
 * The half that decides whether this fix lasts. Without the default privilege
 * change, the next migration that creates a table hands all three straight
 * back and nobody notices until the next audit.
 */
do $$
declare n integer;
begin
  create table public.zzz_after_the_fix (id bigint primary key);

  select count(*) into n from information_schema.role_table_grants
   where table_name = 'zzz_after_the_fix' and grantee in ('anon', 'authenticated')
     and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');

  drop table public.zzz_after_the_fix;

  if n <> 0 then
    raise exception 'a new table was handed % of the three back', n;
  end if;
end $$;

select 'stage12-truncate ok' as result;
