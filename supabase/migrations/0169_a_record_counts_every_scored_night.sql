-- 0169 · A club night counts once somebody has typed a score
--
-- 0166 required `result_confirmation = 'admin-confirmed'` as well, on the
-- reasoning that it is the bar stage 9's Meta Tracker uses and that an
-- unsettled score is one player's word. Driving it in a browser is what
-- settled the other way.
--
-- On a real profile the panel rendered nothing at all, because almost nothing
-- in the database has been confirmed, while the grudge tracker three panels
-- further down the same page read "9 games played · 55.6% win rate".
-- `club_member_games` (0056) has always counted any booking carrying both
-- scores, which is legacy's own rule for somebody's own game history. Two
-- answers to "how many games has this person played" on one page is the
-- one-tag-one-vocabulary rule broken in the most visible place there is, and
-- the one that was hiding itself is the new one.
--
-- The tracker's stricter bar stays right where it is. A public faction win
-- rate is a shared dataset and one player's word would skew it for everybody.
-- A profile record is that person's own games, the club can still dispute one,
-- and "the club has not got round to pressing confirm" is not the same fact as
-- "this game did not happen".
--
-- Nothing else about 0166 changes. Checked on a throwaway Postgres built from
-- every migration: a settled night and an unsettled one both count, a night
-- with no score on it does not, and a stranger still reads nothing.

create or replace function public.member_overall_record(p_profile uuid)
returns table (
  source text, played integer, wins integer, draws integer, losses integer
)
language sql stable security definer set search_path = public as $$
  with allowed as (
    -- Themselves, or somebody approved at a club they are both approved at.
    select p_profile = auth.uid()
           or exists (
             select 1
               from public.club_memberships mine
               join public.club_memberships theirs
                 on theirs.club_id = mine.club_id
              where mine.profile_id = auth.uid()   and mine.status = 'approved'
                and theirs.profile_id = p_profile  and theirs.status = 'approved')
           as ok
  ),
  nights as (
    select
      case when b.booked_by = p_profile then b.booked_by_score else b.opponent_score end as mine,
      case when b.booked_by = p_profile then b.opponent_score else b.booked_by_score end as theirs
      from public.club_bookings b, allowed
     where allowed.ok
       and b.status = 'booked'
       -- Both scores, which is what makes it a game somebody played. The
       -- confirmation is the club's housekeeping and is not asked about here.
       and b.booked_by_score is not null
       and b.opponent_score is not null
       and p_profile in (b.booked_by, b.opponent_profile_id, b.accepted_by)
  ),
  tables as (
    select a.outcome
      from public.game_result_armies a, allowed
     where allowed.ok
       and a.source_type = 'event_pairing'
       and a.profile_id = p_profile
       -- A table whose score nobody has typed yet carries '' and is not a
       -- game anybody has played. A podium is already out by source_type.
       and a.outcome <> ''
  ),
  leagues as (
    select s.wins, s.draws, s.losses
      from public.club_competition_standings s, allowed
     where allowed.ok and s.profile_id = p_profile
  )
  select 'club', count(*)::integer,
         count(*) filter (where mine > theirs)::integer,
         count(*) filter (where mine = theirs)::integer,
         count(*) filter (where mine < theirs)::integer
    from nights
  union all
  select 'event', count(*)::integer,
         count(*) filter (where outcome = 'won')::integer,
         count(*) filter (where outcome = 'drew')::integer,
         count(*) filter (where outcome = 'lost')::integer
    from tables
  union all
  select 'league',
         coalesce(sum(wins + draws + losses), 0)::integer,
         coalesce(sum(wins), 0)::integer,
         coalesce(sum(draws), 0)::integer,
         coalesce(sum(losses), 0)::integer
    from leagues
$$;

revoke all on function public.member_overall_record(uuid) from public, anon;
grant execute on function public.member_overall_record(uuid) to authenticated;
