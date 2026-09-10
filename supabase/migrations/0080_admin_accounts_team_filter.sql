-- 0080 · "Who runs a club" on the accounts screen
--
-- The console can find somebody by name and filter on active, suspended and
-- admin, which are all facts about the account itself. It cannot answer the
-- question an admin actually arrives with, which is about the club: who has
-- console access, and as what.
--
-- One more value on the filter it already has rather than new parameters. The
-- fuller version, filtering by a named club and by one role at a time, wants
-- selects rather than tabs and lands with the admin lists in stage 6; it is
-- written up in DEFERRED.md.
--
-- Dropped rather than replaced: the returned row gains a column, and
-- `create or replace` cannot change a function's return type.

drop function if exists public.admin_find_accounts(text, text, integer, integer);

create function public.admin_find_accounts(
  p_query text default '',
  p_status text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  is_active boolean,
  created_at timestamptz,
  clubs_owned integer,
  memberships integer,
  team_roles text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (select public.is_admin() as ok),
  wanted as (select nullif(btrim(lower(coalesce(p_query, ''))), '') as q),
  matched as (
    select p.id, p.full_name, u.email::text as email, p.role, p.is_active, p.created_at
      from public.profiles p
      join auth.users u on u.id = p.id, allowed a, wanted w
     where a.ok
       and (w.q is null
            or lower(coalesce(p.full_name, '')) like '%' || w.q || '%'
            or lower(coalesce(u.email, '')) like '%' || w.q || '%')
       and (coalesce(p_status, 'all') = 'all'
            or (p_status = 'active' and p.is_active)
            or (p_status = 'suspended' and not p.is_active)
            or (p_status = 'admin' and p.role = 'admin')
            -- Anybody holding a seat on any club's team. An owner is one of
            -- them: the mirror trigger in 0067 gives every owner a row.
            or (p_status = 'team' and exists (
                  select 1 from public.club_team t where t.profile_id = p.id)))
  ),
  counted as (select count(*) as n from matched)
  select m.id, m.full_name, m.email, m.role, m.is_active, m.created_at,
         (select count(*)::integer from public.clubs c where c.owner_id = m.id),
         (select count(*)::integer from public.club_memberships cm
           where cm.profile_id = m.id and cm.status = 'approved'),
         -- What they run, in the words the console uses. Three at most: this
         -- is a row in a list, and the account's own page carries the rest.
         (select string_agg(x.line, ' · ') from (
            select case t.role when 'owner' then 'Owner of '
                               else initcap(t.role) || ' at ' end || c.name as line
              from public.club_team t
              join public.clubs c on c.id = t.club_id
             where t.profile_id = m.id
             order by case t.role when 'owner' then 1 when 'manager' then 2 else 3 end,
                      c.name
             limit 3) x),
         c.n
    from matched m, counted c
   order by m.created_at desc
   limit greatest(1, least(100, coalesce(p_limit, 25)))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.admin_find_accounts(text, text, integer, integer)
  from public, anon;
grant execute on function public.admin_find_accounts(text, text, integer, integer)
  to authenticated;
