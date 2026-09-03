-- 0062 · The activity feed, with the things members actually do
--
-- Ours reported four kinds: somebody joined, somebody booked a table, somebody
-- named a rival, somebody placed at an event. Legacy reports twenty. The
-- client bought coaching, ordered merchandise and booked event tickets, saw
-- none of it, and reasonably asked what the feed is for.
--
-- One function rather than a query per source, for two reasons.
--
--  1. RLS. A member cannot read another member's merchandise order, coaching
--     booking or event ticket, and nor should they be able to. The feed is a
--     different question from "show me that order": it needs a name, a time
--     and a line of text, never a total or an address. Reading past RLS here
--     is what lets it say "Gulnabi ordered a club shirt" without handing over
--     the order.
--  2. Twelve round trips to draw one panel is twelve chances to be slow.
--
-- Guarded on club membership, the same gate the panel already had in the
-- component. It is enforced here now, so the gate cannot be forgotten by a
-- future caller.

create or replace function public.club_activity_feed(
  p_club bigint,
  p_days integer default 14,
  p_limit integer default 18
)
returns table (
  id text,
  kind text,
  at timestamptz,
  who text,
  what text,
  ref text
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select public.is_club_member(p_club) or public.can_manage_club(p_club) as ok
  ),
  since as (
    select (now() - make_interval(days => greatest(1, coalesce(p_days, 14)))) as cutoff
  ),
  named as (
    select pr.id, coalesce(nullif(btrim(pr.full_name), ''), 'A member') as who
    from public.profiles pr
  ),
  feed as (
    -- Somebody joined.
    --
    -- Aliased here and nowhere else on purpose: a UNION takes its column names
    -- from the FIRST branch, so without these the CTE has no column called
    -- "at" and the filter below cannot see it.
    select 'join-' || m.id           as id,
           'join'                    as kind,
           m.joined_at::timestamptz  as at,
           n.who                     as who,
           'joined the club'         as what,
           m.profile_id::text        as ref
      from public.club_memberships m
      join named n on n.id = m.profile_id
     where m.club_id = p_club and m.status = 'approved' and m.joined_at is not null

    union all
    -- Somebody moved up a tier
    select 'tier-' || m.id, 'tier', m.tier_assigned_at, n.who,
           'moved to ' || coalesce(nullif(btrim(t.label), ''), 'a new tier'),
           m.profile_id::text
      from public.club_memberships m
      join named n on n.id = m.profile_id
      join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = p_club and m.status = 'approved'
       and m.tier_assigned_at is not null

    union all
    -- Somebody named a rival
    select 'rival-' || r.id, 'rival', r.created_at, n.who,
           'named ' || o.who || ' a rival', r.profile_id::text
      from public.club_rivals r
      join named n on n.id = r.profile_id
      join named o on o.id = r.rival_id
     where r.club_id = p_club

    union all
    -- Somebody booked a table
    select 'booking-' || b.id, 'booking', b.created_at, n.who,
           case when btrim(coalesce(b.game_title, '')) <> ''
                then 'booked a table for ' || btrim(b.game_title)
                else 'booked a table' end,
           ''
      from public.club_bookings b
      join named n on n.id = b.booked_by
     where b.club_id = p_club and b.status = 'booked'

    union all
    -- A game got a score. Named from the booker's side, which is the side the
    -- row is written from.
    select 'result-' || b.id, 'result', b.result_at, n.who,
           -- trim_scale, or a score of 15 reads as "15.00": the column is
           -- numeric so a club can record half points.
           'recorded ' || trim_scale(b.booked_by_score) || ' to ' || trim_scale(b.opponent_score)
             || case when btrim(coalesce(b.game_title, '')) <> ''
                     then ' at ' || btrim(b.game_title) else '' end,
           ''
      from public.club_bookings b
      join named n on n.id = b.booked_by
     where b.club_id = p_club and b.status = 'booked'
       and b.result_at is not null and b.booked_by_score is not null

    union all
    -- Somebody is looking for a game, or found one
    select 'lfg-' || l.id,
           case when l.status = 'matched' then 'lfg-matched' else 'lfg' end,
           l.created_at, n.who,
           case when l.status = 'matched'
                then 'found an opponent for ' || coalesce(nullif(btrim(l.game_title), ''), 'a game')
                else 'is looking for a game of '
                     || coalesce(nullif(btrim(l.game_title), ''), 'anything') end,
           ''
      from public.club_looking_for_games l
      join named n on n.id = l.created_by
     where l.club_id = p_club

    union all
    -- Somebody booked event tickets
    select 'ticket-' || eb.id, 'ticket', eb.created_at,
           coalesce(nullif(btrim(eb.full_name), ''), n.who, 'A member'),
           'booked tickets for ' || e.title, e.legacy_id
      from public.club_event_bookings eb
      join public.club_events e on e.id = eb.event_id
      left join named n on n.id = eb.profile_id
     where eb.club_id = p_club and eb.status <> 'cancelled'

    union all
    -- Somebody ordered from the club shop. What, not what it cost.
    select 'order-' || o.id, 'order', o.created_at, n.who,
           'ordered ' || coalesce((
             select string_agg(i.quantity || ' x ' || i.name, ' · ' order by i.id)
               from public.club_merchandise_order_items i
              where i.order_id = o.id
           ), 'from the club shop'),
           ''
      from public.club_merchandise_orders o
      join named n on n.id = o.profile_id
     where o.club_id = p_club

    union all
    -- Somebody booked coaching
    select 'coaching-' || cb.id, 'coaching', cb.booked_at, n.who,
           'booked ' || coalesce(nullif(btrim(cs.title), ''), 'a coaching session'),
           ''
      from public.club_coaching_bookings cb
      join public.club_coaching_slots cs on cs.id = cb.slot_id
      join named n on n.id = cb.profile_id
     where cs.club_id = p_club and cb.status <> 'cancelled'

    union all
    -- Somebody started a thread
    select 'post-' || d.id, 'post', d.created_at, n.who,
           'posted "' || d.title || '" on the board', d.id::text
      from public.club_discussion_posts d
      join named n on n.id = d.author_profile_id
     where d.club_id = p_club and d.removed_at is null

    union all
    -- A club posted a league update
    select 'league-' || u.id, 'league', u.posted_on::timestamptz, c.title,
           coalesce(nullif(btrim(u.title), ''), 'posted an update'), ''
      from public.club_competition_updates u
      join public.club_competitions c on c.id = u.competition_id
     where c.club_id = p_club and u.posted_on is not null

    union all
    -- Somebody placed at one of the club's events. The event's date is the
    -- honest time: a placing carries none of its own.
    select 'placing-' || res.id, 'placing', e.start_date::timestamptz,
           coalesce(nullif(btrim(res.member_name), ''), 'A member'),
           'took ' || coalesce(nullif(btrim(res.placement), ''), '#' || res.rank)
             || ' at ' || e.title,
           e.legacy_id
      from public.club_event_results res
      join public.club_events e on e.id = res.event_id
     where e.club_id = p_club and e.start_date is not null
  )
  select f.*
    from feed f, allowed a, since s
   where a.ok
     and f.at is not null
     and f.at >= s.cutoff
   order by f.at desc
   limit greatest(1, least(100, coalesce(p_limit, 18)));
$$;

revoke all on function public.club_activity_feed(bigint, integer, integer) from public, anon;
grant execute on function public.club_activity_feed(bigint, integer, integer) to authenticated;
