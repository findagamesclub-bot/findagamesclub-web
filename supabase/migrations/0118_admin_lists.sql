-- 0118 · Every live club and every live event, in one place
--
-- The client's words: "Every live club in one place, search and filters" and
-- "Every live event in one place, search and filters". Legacy has neither as a
-- screen: its admin is a listings queue, a users page and billing issues
-- (`adminListing`, `adminUsersPage`, `adminBillingIssues` in clubs-v2). So
-- there is no legacy behaviour to copy here and the requirement is the spec.
--
-- Filtered, counted and paged in SQL rather than in the browser, because the
-- whole point of these screens is that they hold everything. A directory of
-- five thousand clubs shipped to Node so it can hide 4,975 of them is the thing
-- the scale rules exist to stop.
--
-- Admin only, by `is_admin()`, and definer so the answer does not depend on
-- which policy happens to cover a club an admin is not a member of.
--
-- Checked on a throwaway Postgres: a member is refused, an admin is not, the
-- search matches name and town, the status filter narrows, the count is the
-- count before paging and not the size of the page, and paging past the end
-- returns nothing rather than erroring.

create or replace function public.admin_clubs(
  p_query text default '', p_status text default '',
  p_limit integer default 25, p_offset integer default 0
) returns table (
  id bigint, slug text, name text, city text, status text,
  claimable boolean, spotlight boolean, owner_name text,
  members bigint, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with matching as (
    select c.*
      from public.clubs c
     where (btrim(coalesce(p_query, '')) = ''
            or c.name ilike v_like or c.city ilike v_like or c.slug ilike v_like)
       and (btrim(coalesce(p_status, '')) = '' or c.status = p_status)
  ),
  counted as (select count(*) as n from matching)
  select m.id, m.slug::text, m.name, m.city, m.status,
         coalesce(m.claimable, false), coalesce(m.spotlight, false),
         coalesce(p.full_name, '') as owner_name,
         (select count(*) from public.club_memberships cm
           where cm.club_id = m.id and cm.status = 'approved') as members,
         counted.n
    from matching m
    left join public.profiles p on p.id = m.owner_id
    cross join counted
   order by m.name
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

revoke all on function public.admin_clubs(text, text, integer, integer) from public, anon;
grant execute on function public.admin_clubs(text, text, integer, integer) to authenticated;

create or replace function public.admin_events(
  p_query text default '', p_status text default '', p_when text default '',
  p_limit integer default 25, p_offset integer default 0
) returns table (
  id bigint, legacy_id text, title text, start_date date, status text,
  club_slug text, club_name text, places bigint, sold bigint, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with matching as (
    select e.*, c.slug as c_slug, c.name as c_name
      from public.club_events e
      join public.clubs c on c.id = e.club_id
     where (btrim(coalesce(p_query, '')) = ''
            or e.title ilike v_like or c.name ilike v_like or c.city ilike v_like)
       and (btrim(coalesce(p_status, '')) = '' or e.status = p_status)
       -- "Upcoming" and "past" are London days, like every other date here.
       and (btrim(coalesce(p_when, '')) = ''
            or (p_when = 'upcoming' and e.start_date >= public.london_today())
            or (p_when = 'past' and e.start_date < public.london_today()))
  ),
  counted as (select count(*) as n from matching)
  select m.id, m.legacy_id, m.title, m.start_date, m.status,
         m.c_slug::text, m.c_name,
         coalesce((select sum(t.quantity_available) from public.club_event_ticket_types t
                    where t.event_id = m.id), 0)::bigint as places,
         (select count(*) from public.club_event_bookings b
           where b.event_id = m.id and b.status <> 'cancelled') as sold,
         counted.n
    from matching m
    cross join counted
   -- Upcoming counts forwards, everything else counts back. On the Upcoming
   -- tab, newest first means the event furthest away leads and the one this
   -- Saturday is on page three, which is the opposite of why anybody opened
   -- the tab.
   order by case when p_when = 'upcoming' then m.start_date end asc,
            m.start_date desc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

revoke all on function public.admin_events(text, text, text, integer, integer)
  from public, anon;
grant execute on function public.admin_events(text, text, text, integer, integer)
  to authenticated;

/**
 * The figures beside each tab.
 *
 * A separate call rather than more columns on the list, because the list is a
 * page of 25 and these are counts over everything. Both go in one wave, so the
 * page pays one round trip for the pair.
 *
 * The search narrows them too: "Live 3" beside a search for Leeds has to mean
 * three live clubs in Leeds, not three live clubs anywhere, or the tab lies
 * about the list underneath it.
 */
create or replace function public.admin_club_counts(p_query text default '')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return (
    with matching as (
      select c.status from public.clubs c
       where btrim(coalesce(p_query, '')) = ''
          or c.name ilike v_like or c.city ilike v_like or c.slug ilike v_like
    )
    select jsonb_build_object(
      'all',       (select count(*) from matching),
      'active',    (select count(*) from matching where status = 'active'),
      'paused',    (select count(*) from matching where status = 'paused'),
      'suspended', (select count(*) from matching where status = 'suspended')
    ));
end $$;

revoke all on function public.admin_club_counts(text) from public, anon;
grant execute on function public.admin_club_counts(text) to authenticated;

create or replace function public.admin_event_counts(p_query text default '')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return (
    with matching as (
      select e.start_date
        from public.club_events e
        join public.clubs c on c.id = e.club_id
       where btrim(coalesce(p_query, '')) = ''
          or e.title ilike v_like or c.name ilike v_like or c.city ilike v_like
    )
    select jsonb_build_object(
      'all',      (select count(*) from matching),
      'upcoming', (select count(*) from matching
                    where start_date >= public.london_today()),
      'past',     (select count(*) from matching
                    where start_date < public.london_today())
    ));
end $$;

revoke all on function public.admin_event_counts(text) from public, anon;
grant execute on function public.admin_event_counts(text) to authenticated;
