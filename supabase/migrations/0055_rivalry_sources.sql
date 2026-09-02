-- 0055 · A rivalry is not only table bookings
--
-- Legacy builds a head-to-head from two sources, not one
-- (club_store.py:21640 `record_match`): scored table bookings AND the match
-- history posted under a club's competitions. Ours counted only bookings, so
-- two members who meet in the club league saw none of it, and the detail page
-- had no "Competitions" breakdown to put beside "Games" the way legacy does.
--
-- It also lists the head-to-heads already in the diary
-- (`_list_upcoming_rivalry_bookings`, club_store.py:10475), which is the one
-- panel on that page that looks forwards.
--
-- Three changes:
--
--  1. club_rivalry_games() normalises both sources into one shape, so the
--     leaderboard and the detail page cannot disagree about who is ahead.
--  2. club_rivalries and club_rivalry_matches are rebuilt on top of it, and
--     matches now say which competition each game belonged to.
--  3. club_rivalry_upcoming() returns the pair's booked, unplayed meetings.
--
-- Every one keeps 0031's membership guard: these run as their owner, so a
-- missing club check would let any signed-in person read any club's results.

/**
 * Every scored game between two members of one club, from either source.
 *
 * Pairs are stored low/high by uuid rather than in the order they were played,
 * so a pair is one pair however the two of them were seated.
 */
create or replace function public.club_rivalry_games(p_club bigint)
returns table (
  ref_id bigint,
  source text,
  low uuid,
  high uuid,
  played_on date,
  game_title text,
  competition text,
  low_score integer,
  high_score integer
)
language sql
stable
security definer
set search_path = public
as $$
  -- Competition matches name their players in free text, so they have to be
  -- matched back to members by name. A name held by two approved members is
  -- dropped rather than guessed at: attributing somebody else's loss to you is
  -- worse than leaving the game out.
  with roster as (
    select min(pr.id::text)::uuid as id, lower(btrim(pr.full_name)) as folded
    from public.club_memberships cm
    join public.profiles pr on pr.id = cm.profile_id
    where cm.club_id = p_club
      and cm.status = 'approved'
      and btrim(pr.full_name) <> ''
    group by lower(btrim(pr.full_name))
    having count(*) = 1
  ),
  bookings as (
    select
      b.id                                          as ref_id,
      'booking'::text                               as source,
      least(b.booked_by, b.opponent_profile_id)     as low,
      greatest(b.booked_by, b.opponent_profile_id)  as high,
      b.session_date                                as played_on,
      coalesce(nullif(btrim(b.game_title), ''), 'Club game') as game_title,
      'Club game booking'::text                     as competition,
      (case when b.booked_by = least(b.booked_by, b.opponent_profile_id)
            then b.booked_by_score else b.opponent_score end)::integer as low_score,
      (case when b.booked_by = least(b.booked_by, b.opponent_profile_id)
            then b.opponent_score else b.booked_by_score end)::integer as high_score
    from public.club_bookings b
    where b.club_id = p_club
      and b.status = 'booked'
      and b.booked_by_score is not null
      and b.opponent_score is not null
      and b.opponent_profile_id is not null
      and b.booked_by <> b.opponent_profile_id
  ),
  competitions as (
    select
      m.id                                          as ref_id,
      'competition'::text                           as source,
      least(r1.id, r2.id)                           as low,
      greatest(r1.id, r2.id)                        as high,
      u.posted_on                                   as played_on,
      coalesce(nullif(btrim(c.game), ''), 'Club game')      as game_title,
      coalesce(nullif(btrim(c.title), ''), 'Competition')   as competition,
      (case when r1.id = least(r1.id, r2.id)
            then btrim(m.player_one_score)::integer
            else btrim(m.player_two_score)::integer end)    as low_score,
      (case when r1.id = least(r1.id, r2.id)
            then btrim(m.player_two_score)::integer
            else btrim(m.player_one_score)::integer end)    as high_score
    from public.club_competition_matches m
    join public.club_competition_updates u on u.id = m.update_id
    join public.club_competitions c on c.id = u.competition_id
    join roster r1 on r1.folded = lower(btrim(m.player_one))
    join roster r2 on r2.folded = lower(btrim(m.player_two))
    where c.club_id = p_club
      and r1.id <> r2.id
      -- A club types these in by hand, so "3 - 1" and "n/a" both turn up. Only
      -- a plain number is a score; anything else is a note, not a result.
      and btrim(m.player_one_score) ~ '^-?[0-9]+$'
      and btrim(m.player_two_score) ~ '^-?[0-9]+$'
  )
  select * from (
    select * from bookings
    union all
    select * from competitions
  ) g
  where public.is_club_member(p_club) or public.can_manage_club(p_club);
$$;

revoke all on function public.club_rivalry_games(bigint) from public, anon;
grant execute on function public.club_rivalry_games(bigint) to authenticated;

-- Same columns as 0054, different arithmetic behind them. Dropped rather than
-- replaced because a set-returning function refuses CREATE OR REPLACE with
-- 42P13 the moment anything about its return type moves.
drop function if exists public.club_rivalries(bigint);

create function public.club_rivalries(p_club bigint)
returns table (
  member_one uuid,
  member_one_name text,
  member_two uuid,
  member_two_name text,
  played integer,
  wins_one integer,
  wins_two integer,
  draws integer,
  last_played date,
  score_one integer,
  score_two integer,
  nominations integer,
  mutual boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with games as (
    select * from public.club_rivalry_games(p_club)
  ),
  nods as (
    select
      least(r.profile_id, r.rival_id)    as low,
      greatest(r.profile_id, r.rival_id) as high,
      count(*)::integer                  as nominations,
      count(*) > 1                       as mutual
    from public.club_rivals r
    where r.club_id = p_club
      and (public.is_club_member(p_club) or public.can_manage_club(p_club))
    group by least(r.profile_id, r.rival_id), greatest(r.profile_id, r.rival_id)
  )
  select
    g.low,
    coalesce(nullif(btrim(a.full_name), ''), 'Club member'),
    g.high,
    coalesce(nullif(btrim(c.full_name), ''), 'Club member'),
    count(*)::integer,
    count(*) filter (where g.low_score  > g.high_score)::integer,
    count(*) filter (where g.high_score > g.low_score)::integer,
    count(*) filter (where g.low_score  = g.high_score)::integer,
    max(g.played_on),
    coalesce(sum(g.low_score), 0)::integer,
    coalesce(sum(g.high_score), 0)::integer,
    coalesce(max(n.nominations), 0)::integer,
    coalesce(bool_or(n.mutual), false)
  from games g
  left join public.profiles a on a.id = g.low
  left join public.profiles c on c.id = g.high
  left join nods n on n.low = g.low and n.high = g.high
  group by g.low, g.high, a.full_name, c.full_name
  order by count(*) desc, max(g.played_on) desc nulls last;
$$;

revoke all on function public.club_rivalries(bigint) from public, anon;
grant execute on function public.club_rivalries(bigint) to authenticated;

/**
 * Every scored game between two members, newest first.
 *
 * Carries the competition each one belonged to, because legacy's results table
 * has that column and its detail page breaks the record down by it: "he only
 * beats me in the league" is a different complaint from "he only beats me at
 * Kill Team".
 */
drop function if exists public.club_rivalry_matches(bigint, uuid, uuid);

create function public.club_rivalry_matches(
  p_club bigint,
  p_one uuid,
  p_two uuid
)
returns table (
  booking_id bigint,
  source text,
  session_date date,
  game_title text,
  competition text,
  score_one integer,
  score_two integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.ref_id,
    g.source,
    g.played_on,
    g.game_title,
    g.competition,
    -- Always from p_one's side, whichever seat they were in, so the caller
    -- never has to work out which score belongs to whom.
    (case when g.low = p_one then g.low_score  else g.high_score end),
    (case when g.low = p_one then g.high_score else g.low_score  end)
  from public.club_rivalry_games(p_club) g
  where g.low = least(p_one, p_two)
    and g.high = greatest(p_one, p_two)
    and p_one <> p_two
  order by g.played_on desc nulls last, g.ref_id desc;
$$;

revoke all on function public.club_rivalry_matches(bigint, uuid, uuid) from public, anon;
grant execute on function public.club_rivalry_matches(bigint, uuid, uuid) to authenticated;

/**
 * The pair's booked meetings that have not happened yet.
 *
 * The only panel on the head-to-head page that looks forwards. Legacy leads
 * with the next one and lists the rest.
 */
create or replace function public.club_rivalry_upcoming(
  p_club bigint,
  p_one uuid,
  p_two uuid
)
returns table (
  booking_id bigint,
  session_date date,
  session_time text,
  session_label text,
  game_title text,
  booked_by_name text,
  notes text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.session_date,
    b.session_time,
    b.session_label,
    coalesce(nullif(btrim(b.game_title), ''), 'Club game'),
    coalesce(nullif(btrim(pr.full_name), ''), 'Club member'),
    b.notes
  from public.club_bookings b
  left join public.profiles pr on pr.id = b.booked_by
  where b.club_id = p_club
    and b.status = 'booked'
    and b.session_date >= public.london_today()
    and ((b.booked_by = p_one and b.opponent_profile_id = p_two)
      or (b.booked_by = p_two and b.opponent_profile_id = p_one))
    and p_one <> p_two
    and (public.is_club_member(p_club) or public.can_manage_club(p_club))
  order by b.session_date, b.session_time, b.id;
$$;

revoke all on function public.club_rivalry_upcoming(bigint, uuid, uuid) from public, anon;
grant execute on function public.club_rivalry_upcoming(bigint, uuid, uuid) to authenticated;
