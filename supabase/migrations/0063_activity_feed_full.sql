-- 0063 · The activity feed, all of it, and visible to visitors
--
-- Two gaps the client's question exposed.
--
-- 1. "Can I check this reports on all key events?" Legacy reports 22 kinds
--    (club_store.py:20666). We reported 13. The six added here are the ones it
--    has that we could build today: waitlist promotions, board replies, event
--    results, competition round scores, competition table moves, and a result
--    between two people who have named each other rivals. The three still
--    missing (army list on a result, post-game unit notes, badges) all need the
--    Army Builder in Milestone 3.
--
-- 2. "Recent member activity board is missing." Legacy builds this feed for
--    everybody and only strips the names for non-members: "A new member joined
--    the club" rather than "Gulnabi joined the club". We showed a padlock and
--    nothing else, so somebody comparing a club they had not joined saw a
--    populated board there and an empty one here. Anonymised now, in legacy's
--    own wording, which is also the better answer for a visitor deciding
--    whether this club is worth the trip.
--
-- The return type gains `detail`, so this has to drop before it creates:
-- `create or replace` cannot change a set-returning function's signature
-- (42P13).

drop function if exists public.club_activity_feed(bigint, integer, integer);

create function public.club_activity_feed(
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
  detail text,
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
  club as (
    select coalesce(nullif(btrim(c.name), ''), 'The club') as who
    from public.clubs c where c.id = p_club
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
           null::text                as detail,
           'A new member joined the club' as public_what,
           m.profile_id::text        as ref
      from public.club_memberships m
      join named n on n.id = m.profile_id
     where m.club_id = p_club and m.status = 'approved' and m.joined_at is not null

    union all
    -- Somebody moved up a tier
    select 'tier-' || m.id, 'tier', m.tier_assigned_at, n.who,
           'moved to ' || coalesce(nullif(btrim(t.label), ''), 'a new tier'),
           null,
           'A member upgraded their membership',
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
           'named ' || o.who || ' a rival', null,
           'A new rivalry was added', r.profile_id::text
      from public.club_rivals r
      join named n on n.id = r.profile_id
      join named o on o.id = r.rival_id
     where r.club_id = p_club

    union all
    -- Somebody booked a table. The night it is on is the detail, because
    -- "booked a table" without a date is half a sentence.
    select 'booking-' || b.id, 'booking', b.created_at, n.who,
           case when btrim(coalesce(b.game_title, '')) <> ''
                then 'booked a table for ' || btrim(b.game_title)
                else 'booked a table' end,
           nullif(concat_ws(' · ', nullif(btrim(coalesce(b.session_label, '')), ''),
                            to_char(b.session_date, 'FMDD Mon'),
                            nullif(btrim(coalesce(b.session_time, '')), '')), ''),
           'A new table booking was made',
           ''
      from public.club_bookings b
      join named n on n.id = b.booked_by
     where b.club_id = p_club and b.status = 'booked'

    union all
    -- A game got a score. Named from the booker's side, which is the side the
    -- row is written from, and it says who they played: a score with nobody
    -- on the other end of it is not a result.
    select 'result-' || b.id, 'result', b.result_at, n.who,
           'recorded a result against '
             || coalesce(nullif(btrim(b.opponent_name), ''), o.who, 'their opponent'),
           -- trim_scale, or a score of 15 reads as "15.00": the column is
           -- numeric so a club can record half points.
           n.who || ' ' || trim_scale(b.booked_by_score) || '-' || trim_scale(b.opponent_score)
             || ' ' || coalesce(nullif(btrim(b.opponent_name), ''), o.who, 'their opponent')
             || case when btrim(coalesce(b.game_title, '')) <> ''
                     then ' · ' || btrim(b.game_title) else '' end,
           'A game result was recorded',
           ''
      from public.club_bookings b
      join named n on n.id = b.booked_by
      left join named o on o.id = b.opponent_profile_id
     where b.club_id = p_club and b.status = 'booked'
       and b.result_at is not null and b.booked_by_score is not null
       and b.opponent_score is not null
       and not exists (
         select 1 from public.club_rivals r
          where r.club_id = p_club
            and ((r.profile_id = b.booked_by and r.rival_id = b.opponent_profile_id)
              or (r.rival_id = b.booked_by and r.profile_id = b.opponent_profile_id)))

    union all
    -- The same result, when the two have named each other rivals.
    --
    -- Legacy emits this as a SECOND line beside the ordinary result, which in
    -- a panel this size is the same sentence twice. It is one line here that
    -- knows it is a rivalry, and its link goes to the head to head page rather
    -- than to the booking, which is the part of legacy's version worth having.
    select 'rivalry-result-' || b.id, 'rivalry-result', b.result_at, n.who,
           'added a rivalry result against '
             || coalesce(nullif(btrim(b.opponent_name), ''), o.who, 'their rival'),
           n.who || ' ' || trim_scale(b.booked_by_score) || '-' || trim_scale(b.opponent_score)
             || ' ' || coalesce(nullif(btrim(b.opponent_name), ''), o.who, 'their rival')
             || case when btrim(coalesce(b.game_title, '')) <> ''
                     then ' · ' || btrim(b.game_title) else '' end,
           'A rivalry result was added',
           least(b.booked_by::text, b.opponent_profile_id::text) || '_'
             || greatest(b.booked_by::text, b.opponent_profile_id::text)
      from public.club_bookings b
      join named n on n.id = b.booked_by
      left join named o on o.id = b.opponent_profile_id
     where b.club_id = p_club and b.status = 'booked'
       and b.result_at is not null and b.booked_by_score is not null
       and b.opponent_score is not null
       and exists (
         select 1 from public.club_rivals r
          where r.club_id = p_club
            and ((r.profile_id = b.booked_by and r.rival_id = b.opponent_profile_id)
              or (r.rival_id = b.booked_by and r.profile_id = b.opponent_profile_id)))

    union all
    -- Somebody is looking for a game, or found one
    select 'lfg-' || l.id,
           case when l.status = 'matched' then 'lfg-matched' else 'lfg' end,
           l.created_at, n.who,
           case when l.status = 'matched'
                then 'found an opponent for ' || coalesce(nullif(btrim(l.game_title), ''), 'a game')
                else 'is looking for a game of '
                     || coalesce(nullif(btrim(l.game_title), ''), 'anything') end,
           null,
           case when l.status = 'matched' then 'A new game match was made'
                else 'A member is looking for a game' end,
           ''
      from public.club_looking_for_games l
      join named n on n.id = l.created_by
     where l.club_id = p_club

    union all
    -- A waiting list turned into a table. Worth a line of its own: it is the
    -- one thing on this board that happens TO a member rather than because
    -- they pressed something, so it is the one they are most likely to miss.
    select 'waitlist-' || w.id, 'waitlist', w.promoted_at, n.who,
           'was promoted from the waiting list',
           nullif(concat_ws(' · ', nullif(btrim(coalesce(w.session_label, '')), ''),
                            to_char(w.session_date, 'FMDD Mon'),
                            nullif(btrim(coalesce(w.game_title, '')), '')), ''),
           'A waitlist entry was promoted into a booking',
           ''
      from public.club_booking_waitlist w
      join named n on n.id = w.requested_by
     where w.club_id = p_club and w.promoted_at is not null

    union all
    -- Somebody booked event tickets
    select 'ticket-' || eb.id, 'ticket', eb.created_at,
           coalesce(nullif(btrim(eb.full_name), ''), n.who, 'A member'),
           'booked tickets for ' || e.title,
           (select string_agg(i.quantity || ' x ' || i.label, ' · ' order by i.id)
              from public.club_event_booking_items i where i.booking_id = eb.id),
           'New tickets were booked for ' || e.title,
           e.legacy_id
      from public.club_event_bookings eb
      join public.club_events e on e.id = eb.event_id
      left join named n on n.id = eb.profile_id
     where eb.club_id = p_club and eb.status <> 'cancelled'

    union all
    -- Somebody ordered from the club shop. What, not what it cost.
    select 'order-' || o.id, 'order', o.created_at, n.who,
           'ordered from the club shop',
           (select string_agg(i.quantity || ' x ' || i.name, ' · ' order by i.id)
              from public.club_merchandise_order_items i where i.order_id = o.id),
           'A new merchandise order was placed',
           ''
      from public.club_merchandise_orders o
      join named n on n.id = o.profile_id
     where o.club_id = p_club

    union all
    -- Somebody booked coaching
    select 'coaching-' || cb.id, 'coaching', cb.booked_at, n.who,
           'booked ' || coalesce(nullif(btrim(cs.title), ''), 'a coaching session'),
           nullif(concat_ws(' · ', to_char(cs.slot_date, 'FMDD Mon'),
                            nullif(btrim(coalesce(cs.start_time, '')), '')), ''),
           'A coaching slot was booked',
           ''
      from public.club_coaching_bookings cb
      join public.club_coaching_slots cs on cs.id = cb.slot_id
      join named n on n.id = cb.profile_id
     where cs.club_id = p_club and cb.status <> 'cancelled'

    union all
    -- Somebody started a thread
    select 'post-' || d.id, 'post', d.created_at, n.who,
           'posted "' || d.title || '" on the board',
           nullif(btrim(coalesce(d.category, '')), ''),
           'A new discussion thread was posted',
           d.id::text
      from public.club_discussion_posts d
      join named n on n.id = d.author_profile_id
     where d.club_id = p_club and d.removed_at is null

    union all
    -- Somebody replied to one. The thread is the detail, because a reply on
    -- its own says nothing about what the club is talking about.
    select 'reply-' || rp.id, 'reply', rp.created_at, n.who,
           'replied on the board',
           'On "' || d.title || '"',
           'A new discussion reply was posted',
           d.id::text
      from public.club_discussion_replies rp
      join public.club_discussion_posts d on d.id = rp.post_id
      join named n on n.id = rp.author_profile_id
     where d.club_id = p_club and rp.removed_at is null and d.removed_at is null

    union all
    -- An event's results went up.
    --
    -- One line per event with the podium under it, not one line per placing.
    -- Legacy emits both, and a twenty-player tournament then fills the whole
    -- fortnight with its own standings. The event's own date is the honest
    -- time: a placing carries none of its own.
    select 'results-' || e.id, 'results', e.start_date::timestamptz, cl.who,
           'published results for ' || e.title,
           (select string_agg(coalesce(nullif(btrim(tp.placement), ''), '#' || tp.rank)
                                || ' ' || coalesce(nullif(btrim(tp.member_name), ''), 'A member'),
                              ' · ' order by tp.rank)
              from (select r2.placement, r2.rank, r2.member_name
                      from public.club_event_results r2
                     where r2.event_id = e.id order by r2.rank limit 3) tp),
           'Results published for ' || e.title,
           e.legacy_id
      from public.club_events e
      cross join club cl
     where e.club_id = p_club and e.start_date is not null
       and exists (select 1 from public.club_event_results r3 where r3.event_id = e.id)

    union all
    -- A club posted a league update
    select 'league-' || u.id, 'league', u.posted_on::timestamptz, cl.who,
           'posted ' || coalesce(nullif(btrim(u.title), ''), 'an update')
             || ' to ' || c.title,
           nullif(btrim(regexp_replace(coalesce(u.summary, ''), '\s+', ' ', 'g')), ''),
           'posted ' || coalesce(nullif(btrim(u.title), ''), 'an update')
             || ' to ' || c.title,
           ''
      from public.club_competition_updates u
      join public.club_competitions c on c.id = u.competition_id
      cross join club cl
     where c.club_id = p_club and u.posted_on is not null

    union all
    -- Round scores went in against that update
    select 'round-' || u.id, 'round', u.posted_on::timestamptz, cl.who,
           'added round scores to ' || c.title,
           (select string_agg(m.player_one || ' ' || coalesce(nullif(btrim(m.player_one_score), ''), '-')
                                || '-' || coalesce(nullif(btrim(m.player_two_score), ''), '-')
                                || ' ' || m.player_two, ' · ' order by m.position)
              from (select m2.player_one, m2.player_one_score, m2.player_two,
                           m2.player_two_score, m2.position
                      from public.club_competition_matches m2
                     where m2.update_id = u.id order by m2.position limit 2) m),
           'added round scores to ' || c.title,
           ''
      from public.club_competition_updates u
      join public.club_competitions c on c.id = u.competition_id
      cross join club cl
     where c.club_id = p_club and u.posted_on is not null
       and exists (select 1 from public.club_competition_matches m3 where m3.update_id = u.id)

    union all
    -- And the table moved with them
    select 'table-' || u.id, 'table', u.posted_on::timestamptz, cl.who,
           'updated the ' || c.title || ' table',
           -- Points and record ride inside each name rather than beside it:
           -- one separator doing both jobs read as four players, not two.
           (select string_agg(coalesce(nullif(btrim(s.member_name), ''), 'A member')
                                || ' ' || s.points || ' pts'
                                || coalesce(' (' || nullif(btrim(s.record_label), '') || ')', ''),
                              ' · ' order by s.rank)
              from (select s2.member_name, s2.points, s2.record_label, s2.rank
                      from public.club_competition_standings s2
                     where s2.competition_id = c.id order by s2.rank limit 2) s),
           'updated the ' || c.title || ' table',
           ''
      from public.club_competition_updates u
      join public.club_competitions c on c.id = u.competition_id
      cross join club cl
     where c.club_id = p_club and u.posted_on is not null
       and exists (select 1 from public.club_competition_standings s3
                    where s3.competition_id = c.id)
  )
  -- A visitor gets the shape of the fortnight and none of the names. No actor,
  -- no detail line, and no link: every destination behind these rows is
  -- members-only anyway, so a chevron would only lead to a locked door.
  select f.id,
         f.kind,
         f.at,
         case when a.ok then f.who end,
         case when a.ok then f.what else f.public_what end,
         case when a.ok then f.detail end,
         case when a.ok then f.ref else '' end
    from feed f, allowed a, since s
   where f.at is not null
     and f.at >= s.cutoff
   order by f.at desc
   limit greatest(1, least(200, coalesce(p_limit, 18)));
$$;

revoke all on function public.club_activity_feed(bigint, integer, integer) from public;
grant execute on function public.club_activity_feed(bigint, integer, integer) to anon, authenticated;
