-- 0054 · The rest of a rivalry
--
-- 0031 answered "who plays whom, and who is ahead". Legacy's table also carries
-- what each of them scores, whether the nomination went both ways, and how hot
-- the rivalry is, and it has a head-to-head page behind every row
-- (/clubs/<slug>/rivalries/<pair>) with the match list and a per-game
-- breakdown. The client tested against that page and found ours had none of it.
--
-- Two changes:
--
-- 1. club_rivalries gains the score totals and the nomination facts, so the
--    table can show what 0031 already had the rows to compute.
--
-- 2. club_rivalry_matches returns the games behind one pair, so the detail page
--    can list them and group them by game without a second round trip per row.
--
-- Both keep 0031's membership guard. These functions run as their owner, so a
-- missing club check would let any signed-in person read any club's results by
-- passing its id.

-- Dropped rather than replaced: 0031 already defines this, and a set-returning
-- function cannot have columns added to it by CREATE OR REPLACE. Postgres
-- refuses with 42P13 and tells you to drop it first.
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
  -- Everything below is new.
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
    select
      least(b.booked_by, b.opponent_profile_id)    as low,
      greatest(b.booked_by, b.opponent_profile_id) as high,
      b.session_date,
      case when b.booked_by = least(b.booked_by, b.opponent_profile_id)
           then b.booked_by_score else b.opponent_score end as low_score,
      case when b.booked_by = least(b.booked_by, b.opponent_profile_id)
           then b.opponent_score else b.booked_by_score end as high_score
    from public.club_bookings b
    where b.club_id = p_club
      and b.status = 'booked'
      and b.booked_by_score is not null
      and b.opponent_profile_id is not null
      and (public.is_club_member(p_club) or public.can_manage_club(p_club))
  ),
  -- Who named whom. A pair can be nominated one way or both, and legacy calls
  -- the both-ways ones mutual, which is the rivalry worth watching.
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
    max(g.session_date),
    coalesce(sum(g.low_score), 0)::integer,
    coalesce(sum(g.high_score), 0)::integer,
    coalesce(max(n.nominations), 0)::integer,
    coalesce(bool_or(n.mutual), false)
  from games g
  left join public.profiles a on a.id = g.low
  left join public.profiles c on c.id = g.high
  left join nods n on n.low = g.low and n.high = g.high
  group by g.low, g.high, a.full_name, c.full_name
  order by count(*) desc, max(g.session_date) desc;
$$;

revoke all on function public.club_rivalries(bigint) from public, anon;
grant execute on function public.club_rivalries(bigint) to authenticated;

/**
 * Every scored game between two members of one club, newest first.
 *
 * The head-to-head page groups these by game system and lists them; doing that
 * here would mean a second function for the breakdown and a third for the list.
 * The rows are a handful even for a rivalry that has run for years.
 */
drop function if exists public.club_rivalry_matches(bigint, uuid, uuid);

create function public.club_rivalry_matches(
  p_club bigint,
  p_one uuid,
  p_two uuid
)
returns table (
  booking_id bigint,
  session_date date,
  game_title text,
  score_one integer,
  score_two integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.session_date,
    coalesce(nullif(btrim(b.game_title), ''), 'Club game'),
    -- Always from p_one's side, whichever seat they were in, so the caller
    -- never has to work out which score belongs to whom.
    (case when b.booked_by = p_one then b.booked_by_score else b.opponent_score end)::integer,
    (case when b.booked_by = p_one then b.opponent_score else b.booked_by_score end)::integer
  from public.club_bookings b
  where b.club_id = p_club
    and b.status = 'booked'
    and b.booked_by_score is not null
    and b.opponent_score is not null
    and ((b.booked_by = p_one and b.opponent_profile_id = p_two)
      or (b.booked_by = p_two and b.opponent_profile_id = p_one))
    and (public.is_club_member(p_club) or public.can_manage_club(p_club))
  order by b.session_date desc, b.id desc;
$$;

revoke all on function public.club_rivalry_matches(bigint, uuid, uuid) from public, anon;
grant execute on function public.club_rivalry_matches(bigint, uuid, uuid) to authenticated;
