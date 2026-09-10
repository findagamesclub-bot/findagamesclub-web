-- 0081 · A tab per role on the accounts screen
--
-- 0080 gave the console one tab, "Runs a club", which answers "who has console
-- access" and not "who are the helpers". Those are the questions actually
-- asked, so each role gets its own tab, and membership gets one too: the gap
-- between somebody who signed up and somebody who actually joined a club is
-- worth being able to see.
--
-- Replaced rather than dropped this time. The returned row is unchanged, so
-- `create or replace` is a replacement rather than an overload.

create or replace function public.admin_find_accounts(
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
            -- One seat on one club's team. The value is the role itself, so a
            -- fourth role would need a tab and nothing else.
            or (p_status in ('owner', 'manager', 'helper') and exists (
                  select 1 from public.club_team t
                   where t.profile_id = p.id and t.role = p_status))
            -- Joined a club, as opposed to signed up and stopped.
            or (p_status = 'member' and exists (
                  select 1 from public.club_memberships cm
                   where cm.profile_id = p.id and cm.status = 'approved')))
  ),
  counted as (select count(*) as n from matched)
  select m.id, m.full_name, m.email, m.role, m.is_active, m.created_at,
         (select count(*)::integer from public.clubs c where c.owner_id = m.id),
         (select count(*)::integer from public.club_memberships cm
           where cm.profile_id = m.id and cm.status = 'approved'),
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
