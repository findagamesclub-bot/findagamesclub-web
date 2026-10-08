-- A member's record, from everywhere they have played.
--
-- The client's words: "Event and competition game results, these should show
-- against your overall stats and analytics in your profile. Your stats should
-- be made up of results from normal club game bookings, recorded club
-- competition and league results, and event results."
--
-- All three already exist and none of them met. A profile showed leagues in
-- one panel, podium finishes in another, and the club nights only on the
-- member's own `/account/games`. Nothing added them up.
--
-- Three rows rather than one total, because the three are not the same kind of
-- evidence and flattening them would hide that:
--
--   club   one row per table booking with both scores in and the club having
--          settled it. `result_confirmation = 'admin-confirmed'` is the same
--          bar stage 9's tracker uses, so the two cannot disagree about what
--          counts. (0169 takes that filter back out: see its header.)
--   event  one row per table of a draw, which has carried an outcome since
--          0163, and only once somebody has typed the score. A finishing
--          place is a separate source and is not a game at all.
--   league a standing's own wins, draws and losses. `club_competition_matches`
--          holds both players as free text with no account behind them
--          (0024), so a league cannot be counted game by game. The standing is
--          the club's own tally and is the best there is.
--
-- Who may read it is the rule 0156 settled for the loyalty rung: the reader
-- and the person read have to share a club. Definer, because the three tables
-- have three different select policies and the answer has to be one audience.
--
-- Checked on a throwaway Postgres built from every migration: a settled club
-- night counts and an unsettled one does not, a scored table of a draw counts
-- and a podium does not, a league standing contributes its own tally, and a
-- stranger reading somebody they share no club with gets nothing at all.

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
       and b.booked_by_score is not null
       and b.opponent_score is not null
       -- The club has settled it. An unsettled score is one player's word.
       and b.result_confirmation = 'admin-confirmed'
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
