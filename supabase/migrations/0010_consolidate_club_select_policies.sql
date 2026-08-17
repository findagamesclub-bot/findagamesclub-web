-- 0009 · One SELECT policy per role
--
-- 0002 created two permissive SELECT policies on clubs for `authenticated`.
-- Postgres evaluates every permissive policy on every query, which the database
-- linter flags (0006_multiple_permissive_policies). Merged into one policy per
-- role, with the repeated admin lookup hoisted into a stable function.
--
-- security invoker is deliberate: profiles_select_authenticated already lets a
-- signed-in user read profiles, so no elevation is needed and none is taken.

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

drop policy if exists clubs_select_active on public.clubs;
drop policy if exists clubs_select_own    on public.clubs;

create policy clubs_select_anon
  on public.clubs for select
  to anon
  using (status = 'active');

create policy clubs_select_authenticated
  on public.clubs for select
  to authenticated
  using (
    status = 'active'
    or owner_id = (select auth.uid())
    or public.is_admin()
  );

drop policy if exists clubs_update_own on public.clubs;

create policy clubs_update_own
  on public.clubs for update
  to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());
