-- A team event's table keeps the mission it was given.
--
-- 0181 gave every game the full result shape, the setup included, and the
-- console's dialog has been posting it ever since: `save-armies` reads
-- mission, deployment and terrain and `save_pairing_armies` writes them. The
-- client reported them vanishing, and the write was never the problem.
--
-- An ordinary draw reads its tables through `findPairings`, which maps the
-- setup. A TEAM event's tables come back inside `event_team_draw`'s `tables`
-- jsonb (0183), and that object lists the players, the scores and the two
-- kinds of points and stops. So the setup saved, the read did not fetch it,
-- the dialog reopened empty, and going back showed nothing: *"they do not
-- save and are removed when you go back"*.
--
-- Fourteenth time in this revision that a write landed and the read did not
-- follow it, and the first where the two halves are in the same migration
-- pair: 0181 wrote them and 0183 rebuilt the reader without them.
--
-- The returns list does not move, only what goes in the jsonb, so this is a
-- replace rather than a drop. Built from 0183's body, which is the latest.

create or replace function public.event_team_draw(p_event bigint)
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
                    'pointsOne', pm.points_one, 'pointsTwo', pm.points_two,
                    -- Saved since 0181 and never read back here, so a club
                    -- typed the mission into a team event's table and found
                    -- it gone on the way back in.
                    'mission', pm.result_mission,
                    'deployment', pm.result_deployment,
                    'terrain', pm.result_terrain,
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

revoke all on function public.event_team_draw(bigint) from public;
grant execute on function public.event_team_draw(bigint) to authenticated, anon;

-- And the setup is read from the table it is stored on.
--
-- `getRoundSetup` reads `event_pairing_armies`, which selects FROM
-- `game_result_armies` and joins the match for the three setup columns. So the
-- setup only comes back where an ARMY row exists, and `put_result_army` deletes
-- a side with nothing on it. A club that typed the mission and left the
-- factions alone therefore saved it to `club_event_pairing_matches` and read
-- back nothing, on an ordinary draw as much as a team one.
--
-- `getRoundSetup`'s own comment claimed the opposite: "this is what a screen
-- reads so a table with the mission typed and no army recorded still has
-- something to show." It did not. **A comment is not a test**, which this file
-- has now said about an alphabet and a copy-cost rule.
--
-- Invoker, so 0091's policies decide who sees a draw rather than this deciding
-- it again.
create or replace function public.event_pairing_setup(p_event bigint)
returns table (match_id bigint, mission text, deployment text, terrain text)
language sql
stable
security invoker
set search_path = public
as $$
  select m.id, m.result_mission, m.result_deployment, m.result_terrain
    from public.club_event_pairing_matches m
   where m.event_id = p_event
     and (coalesce(m.result_mission, '') <> ''
       or coalesce(m.result_deployment, '') <> ''
       or coalesce(m.result_terrain, '') <> '');
$$;

revoke all on function public.event_pairing_setup(bigint) from public;
grant execute on function public.event_pairing_setup(bigint) to authenticated, anon;
