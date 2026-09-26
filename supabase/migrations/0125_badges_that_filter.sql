-- 0125 · Who holds what, searched, counted and paged
--
-- The client asked for filtering on both badge tabs. The definitions tab is a
-- handful of rows a person typed by hand, so that one is sifted in TypeScript
-- and stays one read. This is the other tab: one row per badge per member, so a
-- club a few seasons in has thousands and shipping all of them to Node so it
-- can hide most of them is the thing the scale rules exist to stop.
--
-- `club_badge_awards` stays where it is. It answers "everybody, unfiltered",
-- which is what the Stage 7 behaviour suite asserts the guard on, and the two
-- below are additions rather than a rewrite of it.
--
-- Checked on a throwaway Postgres built from every migration: a helper is
-- refused and a manager is not, the search matches the member, the badge and
-- the note, the state tabs split on the badge rather than the award, the count
-- is the count before paging, the counts narrow with the search and the badge,
-- and paging past the end returns nothing rather than erroring.

create index if not exists member_badges_club_badge_idx
  on public.member_badges (club_id, badge_id, awarded_at desc)
  where revoked_at is null;

/**
 * A page of awards, with the total behind it.
 *
 * `p_state` splits on whether the badge is still being given out, not on the
 * award: an award has no state of its own once it has been taken back, because
 * a revoked one is not in here at all. "Who holds something we stopped giving
 * out" is a real question and this is where it gets asked.
 */
create or replace function public.club_badge_awards_page(
  p_club bigint, p_badge bigint default null, p_query text default '',
  p_state text default '', p_sort text default 'recent',
  p_limit integer default 24, p_offset integer default 0
) returns table (
  id bigint, badge_id bigint, label text, icon text, tone text,
  badge_active boolean, profile_id uuid, member_name text, note text,
  awarded_at timestamptz, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
begin
  if not public.club_can(p_club, 'members.manage') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with matching as (
    select m.id, b.id as b_id, b.label, b.icon, b.tone, b.active,
           m.profile_id, m.note, m.awarded_at,
           coalesce(nullif(btrim(p.full_name), ''), 'No name yet') as who
      from public.member_badges m
      join public.club_badges b on b.id = m.badge_id
      left join public.profiles p on p.id = m.profile_id
     where m.club_id = p_club and m.revoked_at is null
       and (p_badge is null or m.badge_id = p_badge)
       and (btrim(coalesce(p_state, '')) = ''
            or (p_state = 'live' and b.active)
            or (p_state = 'retired' and not b.active))
       and (btrim(coalesce(p_query, '')) = ''
            or p.full_name ilike v_like
            or b.label ilike v_like
            or m.note ilike v_like)
  ),
  counted as (select count(*) as n from matching)
  select m.id, m.b_id, m.label, m.icon, m.tone, m.active,
         m.profile_id, m.who, m.note, m.awarded_at, counted.n
    from matching m
    cross join counted
   -- Newest first unless asked otherwise. Every case below is null on the
   -- default, so the trailing sort is what runs and there is no branch.
   order by case when p_sort = 'oldest' then m.awarded_at end asc,
            case when p_sort = 'member' then lower(m.who) end asc,
            case when p_sort = 'badge' then lower(m.label) end asc,
            m.awarded_at desc, m.id desc
   limit greatest(coalesce(p_limit, 24), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

revoke all on function public.club_badge_awards_page(
  bigint, bigint, text, text, text, integer, integer) from public, anon;
grant execute on function public.club_badge_awards_page(
  bigint, bigint, text, text, text, integer, integer) to authenticated;

/**
 * The figure beside each tab.
 *
 * The search and the badge narrow them, because "Retired 1" beside a search for
 * Gulnabi has to mean one retired badge of Gulnabi's. A tab counting the whole
 * club lies about the list underneath it.
 */
create or replace function public.club_badge_award_counts(
  p_club bigint, p_badge bigint default null, p_query text default ''
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
begin
  if not public.club_can(p_club, 'members.manage') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return (
    with matching as (
      select b.active
        from public.member_badges m
        join public.club_badges b on b.id = m.badge_id
        left join public.profiles p on p.id = m.profile_id
       where m.club_id = p_club and m.revoked_at is null
         and (p_badge is null or m.badge_id = p_badge)
         and (btrim(coalesce(p_query, '')) = ''
              or p.full_name ilike v_like
              or b.label ilike v_like
              or m.note ilike v_like)
    )
    select jsonb_build_object(
      'all',     (select count(*) from matching),
      'live',    (select count(*) from matching where active),
      'retired', (select count(*) from matching where not active)
    ));
end $$;

revoke all on function public.club_badge_award_counts(bigint, bigint, text)
  from public, anon;
grant execute on function public.club_badge_award_counts(bigint, bigint, text)
  to authenticated;
