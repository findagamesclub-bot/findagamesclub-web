-- 0031 · The club's rivalry leaderboard
--
-- Every pair at a club who have played a scored game, ranked by how often.
-- Legacy ranks by games played first so "the biggest repeat head-to-head
-- stories rise to the top" (rivalries.js:175), which is the right order: a
-- rivalry is about how often, not how well.
--
-- Aggregated in the database. A club with 1000 members has half a million
-- possible pairs; only the ones who have actually played exist as rows, and
-- counting them in the app would mean shipping every game to do it.

/**
 * Pair up scored games at one club and count them.
 *
 * The pair is stored least-then-greatest so A v B and B v A are one row, the
 * same trick club_messages uses for a conversation. Scores are attributed back
 * to whichever side of the pair each player was on.
 */
create or replace function public.club_rivalries(p_club bigint)
returns table (
  member_one uuid,
  member_one_name text,
  member_two uuid,
  member_two_name text,
  played integer,
  wins_one integer,
  wins_two integer,
  draws integer,
  last_played date
)
language sql
stable
security definer
set search_path = public
as $$
  with games as (
    select
      least(b.booked_by, b.opponent_profile_id)    as low,
      greatest(b.booked_by, b.opponent_profile_id) as high,
      b.session_date,
      -- Whose score is whose, once the pair has been sorted.
      case when b.booked_by = least(b.booked_by, b.opponent_profile_id)
           then b.booked_by_score else b.opponent_score end as low_score,
      case when b.booked_by = least(b.booked_by, b.opponent_profile_id)
           then b.opponent_score else b.booked_by_score end as high_score
    from public.club_bookings b
    where b.club_id = p_club
      and b.status = 'booked'
      and b.booked_by_score is not null
      and b.opponent_profile_id is not null
      -- The function runs as its owner, so the club check cannot be left to
      -- RLS. Without this, any signed-in person could read any club's members
      -- and results by passing its id.
      and (public.is_club_member(p_club) or public.can_manage_club(p_club))
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
    max(g.session_date)
  from games g
  left join public.profiles a on a.id = g.low
  left join public.profiles c on c.id = g.high
  group by g.low, g.high, a.full_name, c.full_name
  -- Most-played first: the long-running grudges are the point of the table.
  order by count(*) desc, max(g.session_date) desc;
$$;

-- Members only, the same as the roster this sits beside. A non-member gets an
-- empty table rather than an error: they have no business knowing whether the
-- club has rivalries to hide.
revoke all on function public.club_rivalries(bigint) from public, anon;
grant execute on function public.club_rivalries(bigint) to authenticated;

-- The pairing scan is per club, so the index is too. Partial on scored games
-- with a real opponent, which is the only thing this ever reads.
create index if not exists club_bookings_rivalry_idx
  on public.club_bookings (club_id, session_date desc)
  where booked_by_score is not null and opponent_profile_id is not null;
