/**
 * A team fixture the club scores itself.
 *
 * The client's words: *"Most Warhammer 40k teams events have different ways of
 * scoring. We should record the game results as we do now, but also allow the
 * club owner to set an overall team score per round, as this might not just be
 * a total of the players scores. For example, adding up all players scores for
 * round 1 could be 200 vs 190, however this might be recorded in a different
 * way, such as 5 points for team A and 4 points for team B."*
 *
 * 0168 said a team's score is never typed, because "a team result that can
 * disagree with the games under it is the two-mechanisms-for-one-fact problem
 * in the place it would be noticed last". That is a real worry and it is
 * answered by keeping both rather than by refusing one: `score_one` and
 * `score_two` go on being the players' total, kept by the trigger exactly as
 * they are, and the club's own figure lands beside them. The two cannot
 * disagree, because they are answers to two different questions, and the
 * screen shows both.
 *
 * Nullable, so "the club has not said" and "the club said nil" stay different.
 * Clearing them goes back to the players' total with nothing lost.
 */

alter table public.club_event_team_matches
  add column if not exists points_one integer,
  add column if not exists points_two integer;

comment on column public.club_event_team_matches.points_one is
  'The club''s own team score for this fixture. Null means use the players'' total in score_one.';

-- Both or neither. One side of a fixture scored and the other not is half a
-- result, and every reader would have to invent what the other half means.
alter table public.club_event_team_matches
  drop constraint if exists club_event_team_matches_points_pair;
alter table public.club_event_team_matches
  add constraint club_event_team_matches_points_pair
  check ((points_one is null) = (points_two is null));

-- ------------------------------------------------------------- the writer

/**
 * The club's own score for one fixture, or clearing it.
 *
 * A function rather than a column grant, because the guard is the club's and
 * `club_can` is false for a site admin with no team row. Third time that
 * clause has had to be written down.
 */
create or replace function public.set_team_match_points(
  p_match bigint, p_one integer, p_two integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_club bigint;
begin
  select e.club_id into v_club
    from public.club_event_team_matches m
    join public.club_events e on e.id = m.event_id
   where m.id = p_match;
  if v_club is null then raise exception 'FIXTURE_NOT_FOUND'; end if;

  if not (public.club_can(v_club, 'events.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- One side given and not the other is the constraint's business, but saying
  -- it here names the mistake instead of raising a 23514 at the screen.
  if (p_one is null) <> (p_two is null) then
    raise exception 'TEAM_POINTS_BOTH';
  end if;

  if coalesce(p_one, 0) < 0 or coalesce(p_two, 0) < 0 then
    raise exception 'TEAM_POINTS_NEGATIVE';
  end if;

  update public.club_event_team_matches
     set points_one = p_one, points_two = p_two
   where id = p_match;
end $$;

revoke all on function public.set_team_match_points(bigint, integer, integer)
  from public, anon;
grant execute on function public.set_team_match_points(bigint, integer, integer)
  to authenticated;

-- -------------------------------------------------------------- the read

-- `create or replace` cannot change a function's return type, so this drops
-- first. Same reason 0162 and 0167 had to.
drop function if exists public.event_team_draw(bigint);

create function public.event_team_draw(p_event bigint)
returns table (
  id bigint, pairing_id bigint, round smallint, table_label text,
  team_one bigint, team_one_name text, team_two bigint, team_two_name text,
  score_one integer, score_two integer, games_one smallint, games_two smallint,
  points_one integer, points_two integer,
  "position" smallint, published boolean, tables jsonb
)
language sql stable security invoker set search_path = public as $$
  select m.id, m.pairing_id, pr.round, m.table_label,
         m.team_one, one.name, m.team_two, two.name,
         m.score_one, m.score_two, m.games_one, m.games_two,
         m.points_one, m.points_two, m.position,
         pr.published,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', pm.id, 'tableLabel', pm.table_label,
                    'playerOne', pm.player_one, 'playerOneId', pm.player_one_id,
                    'playerTwo', pm.player_two, 'playerTwoId', pm.player_two_id,
                    'scoreOne', pm.score_one, 'scoreTwo', pm.score_two,
                    'position', pm.position)
                  order by pm.position, pm.id)
             from public.club_event_pairing_matches pm where pm.team_match_id = m.id
         ), '[]'::jsonb)
    from public.club_event_team_matches m
    join public.club_event_pairings pr on pr.id = m.pairing_id
    left join public.club_event_teams one on one.id = m.team_one
    left join public.club_event_teams two on two.id = m.team_two
   where m.event_id = p_event
   order by pr.round, m.position, m.id
$$;

-- The grants 0168 gave it, restated because dropping the function dropped
-- them with it.
revoke all on function public.event_team_draw(bigint) from public;
grant execute on function public.event_team_draw(bigint) to authenticated, anon;
