-- 0003 · Namespace hygiene
--
-- 0001 originally created these in `public`, which the Supabase database linter
-- flags (lint 0014_extension_in_public). 0001 has since been corrected, so on a
-- fresh build this migration is a no-op. It exists for databases already built
-- from the original 0001.
--
-- Order matters: earthdistance depends on cube.

do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
             where e.extname = 'pg_trgm' and n.nspname = 'public') then
    execute 'alter extension pg_trgm set schema extensions';
  end if;
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
             where e.extname = 'citext' and n.nspname = 'public') then
    execute 'alter extension citext set schema extensions';
  end if;
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
             where e.extname = 'earthdistance' and n.nspname = 'public') then
    execute 'alter extension earthdistance set schema extensions';
  end if;
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
             where e.extname = 'cube' and n.nspname = 'public') then
    execute 'alter extension cube set schema extensions';
  end if;
end
$$;
