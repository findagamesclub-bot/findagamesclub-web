-- 0151 · Taking back TRUNCATE, and the two beside it
--
-- **Row security does not apply to TRUNCATE.** A policy decides which rows a
-- statement may touch, and TRUNCATE touches no rows: it empties the table in
-- one operation and never asks. So a table whose policies hide every row from
-- everybody is still emptiable by anybody holding the privilege.
--
-- Supabase grants the whole table to `anon` and `authenticated` on creation.
-- Our migrations have always revoked `insert, update, delete` and then granted
-- columns back, which is right as far as it goes and leaves three behind:
-- TRUNCATE, TRIGGER and REFERENCES. Measured on the live database: **66 tables,
-- both roles, 396 grants.**
--
-- Nothing in the application uses any of the three. TRUNCATE is never issued,
-- triggers are created by migrations as the owner, and foreign keys are
-- declared in migrations too. Revoking them removes a way to destroy the site's
-- data and costs nothing.
--
-- INSERT and DELETE are deliberately left alone. They are still broader than
-- they should be on some tables, but row security *does* govern them, so a
-- whole-table INSERT with no insert policy grants nothing in practice. That is
-- a tidy-up with a real chance of breaking a write, and it belongs in its own
-- migration with its own test rather than folded in here.
--
-- Checked on a throwaway Postgres built from every migration, with Supabase's
-- table grants reproduced (PGHARNESS_SUPABASE_GRANTS=1): every one of the three
-- is gone from both roles, the grants the app actually needs are untouched, a
-- table created afterwards does not get them back, and running it twice is a
-- no-op.

-- ---------------------------------------------------------------------------
-- 1. Everything that holds one of them now
-- ---------------------------------------------------------------------------

/*
 * Driven by the grants catalogue rather than by `pg_tables`, because
 * `pg_tables` leaves out views and the first version of this shipped with that
 * hole: `listing_subscription_standing` is a view, Supabase granted it the
 * whole set like everything else, and the guard below caught it on the live
 * database after the harness had passed. The harness passed because the test's
 * own simulation was built from the same wrong assumption.
 *
 * Asking the catalogue who actually holds the privilege cannot make that
 * mistake: whatever kind of object it is, if the grant is recorded it is
 * revoked. TRIGGER on a view is not idle either, since an INSTEAD OF trigger
 * on a view is a real thing to be able to create.
 */
do $$
declare
  t record;
  n integer := 0;
begin
  for t in
    select distinct table_name
      from information_schema.role_table_grants
     where table_schema = 'public'
       and grantee in ('anon', 'authenticated')
       and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
     order by table_name
  loop
    execute format(
      'revoke truncate, trigger, references on public.%I from anon, authenticated',
      t.table_name);
    n := n + 1;
  end loop;
  raise notice 'revoked truncate, trigger and references on % objects', n;
end $$;

-- ---------------------------------------------------------------------------
-- 2. And every table added after this
-- ---------------------------------------------------------------------------

/*
 * Without this the next migration that creates a table hands all three straight
 * back, and the fix lasts exactly as long as nobody adds a table.
 *
 * It applies to objects created by the role that sets it, which is the role
 * migrations run as. If the platform refuses it, the guard below still holds
 * for today's tables and the notice says what did not happen, rather than the
 * migration failing on something that is a hardening step rather than the fix.
 */
do $$
begin
  alter default privileges in schema public
    revoke truncate, trigger, references on tables from anon, authenticated;
exception when insufficient_privilege then
  raise notice
    'could not change the default privileges; new tables will need their own revoke';
end $$;

-- ---------------------------------------------------------------------------
-- 3. The guard
-- ---------------------------------------------------------------------------

do $$
declare
  leftovers text;
begin
  select string_agg(distinct table_name, ', ' order by table_name)
    into leftovers
    from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee in ('anon', 'authenticated')
     and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');

  if leftovers is not null then
    raise exception 'these tables can still be truncated: %', leftovers;
  end if;
end $$;
