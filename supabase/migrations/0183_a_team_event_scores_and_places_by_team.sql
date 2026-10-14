-- 0183 · a team event scores a game its own way, and places by team.
--
-- Three of the four things the client found on item 21.
--
-- 21b: "we should have a Victory Points score per game and round, which is the
-- current number we track e.g 80 vs 100. However, we should also allow a
-- separate score to be added per game and per round. You have implemented this
-- per round currently, can we add a per game separate score also?"
--
-- 0176 gave the FIXTURE a typed pair beside the players' own total, for
-- exactly the reason the client gave then: adding the players up can read
-- 200-190 while the format records it 5-4. The same is true one level down. A
-- table is 80-60 on victory points and the format may score it 3-1, and until
-- now there was nowhere to put the 3-1.
--
-- Two numbers that mean different things are not two copies of one number,
-- which is 0176's own sentence and is why both pairs stay.
--
-- 21c: "Add a table button is missing for teams events. Currently club owner
-- has no way of manually setting the draw and round pairings for a team
-- event." 0168 hid Paste and Add a table at a team event because a table made
-- on its own would belong to no fixture, be counted into no total and sit on
-- the draw looking exactly like one that would. The reasoning holds; the
-- conclusion was wrong. A club that runs a format the shuffle does not
-- understand has to be able to build a round by hand, which means making a
-- fixture and then putting tables inside it.
--
-- `club_event_pairing_matches` already takes `team_match_id` (0168) through an
-- ordinary insert, so a table inside a fixture needs no new SQL. A FIXTURE
-- does: 0168 revoked insert on `club_event_team_matches` outright and left
-- only the draw to make them.
--
-- 21d: "placings for team events is incorrect, it asks for player names
-- whereas it should ask for the team name and overall team score." The rank
-- is already there (`final_rank`, which the podium badges read since 0167);
-- what is missing is the score beside it.

-- ------------------------------------------------- 21b · a game's own score

alter table public.club_event_pairing_matches
  add column if not exists points_one integer,
  add column if not exists points_two integer;

comment on column public.club_event_pairing_matches.points_one is
  'What the format scored this table at, where that is not the victory points. '
  'Null means the club has not said, which is not the same as nil.';

alter table public.club_event_pairing_matches
  drop constraint if exists club_event_pairing_matches_points;
alter table public.club_event_pairing_matches
  add constraint club_event_pairing_matches_points
  -- One side given and not the other is half a result and reads as a walkover
  -- nobody recorded, which is the rule the victory points already follow.
  check ((points_one is null) = (points_two is null)
         and coalesce(points_one, 0) >= 0 and coalesce(points_two, 0) >= 0);

-- `club_event_pairing_matches` is granted by column, not whole-table, so a new
-- one is readable and never writable until it is named here. CLAUDE.md has
-- said this since stage 3 and this migration got it right for
-- `club_event_teams` two blocks down and wrong here: the first save from a
-- browser came back "permission denied for table club_event_pairing_matches",
-- which is what Postgres says about a column you may not touch.
--
-- The behaviour suite missed it because its insert and update ran as postgres,
-- which bypasses grants entirely. 0158 wrote that lesson down as "set local
-- role authenticated or the suite proves nothing", and the suite now does.
grant insert (points_one, points_two), update (points_one, points_two)
  on public.club_event_pairing_matches to authenticated;

-- ------------------------------------------------ 21d · a team's own score

alter table public.club_event_teams
  add column if not exists final_score integer;

comment on column public.club_event_teams.final_score is
  'The overall figure beside a team''s finishing place, in whatever the format '
  'counts. Typed by the club, never derived: a final table has tiebreakers '
  'only the organiser knows, which is what `final_rank` already says.';

alter table public.club_event_teams
  drop constraint if exists club_event_teams_final_score;
alter table public.club_event_teams
  add constraint club_event_teams_final_score
  check (final_score is null or final_score >= 0);

-- 0168 grants this table by column, so a new one has to be named or it is
-- readable and never writable. Sixth time this file records that shape.
grant insert (final_score), update (final_score)
  on public.club_event_teams to authenticated;

-- --------------------------------------------- 21c · a fixture by hand
--
-- The draw makes these in bulk and 0168 left no other door. A club running a
-- format the shuffle does not understand needs one, and it is the same guard
-- the rest of the draw is behind.

create or replace function public.add_event_team_fixture(
  p_event bigint, p_round integer, p_team_one bigint, p_team_two bigint
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_club bigint; v_pairing bigint; v_id bigint; v_next smallint;
begin
  select club_id into v_club from public.club_events where id = p_event;
  if v_club is null then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'check_violation';
  end if;

  if not (public.club_can(v_club, 'events.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if p_team_one is null or p_team_two is null then
    raise exception 'FIXTURE_NEEDS_TWO_TEAMS' using errcode = 'check_violation';
  end if;
  if p_team_one = p_team_two then
    raise exception 'FIXTURE_SAME_TEAM' using errcode = 'check_violation';
  end if;

  -- Both teams have to be at this event, or a hand-rolled call could draw a
  -- team from somebody else's tournament onto this one's table.
  if (select count(*) from public.club_event_teams t
       where t.event_id = p_event and t.id in (p_team_one, p_team_two)) <> 2 then
    raise exception 'FIXTURE_TEAM_NOT_HERE' using errcode = 'check_violation';
  end if;

  -- The round has to exist before anything can hang off it. The draw calls
  -- this the pairing, which is the row the published flag lives on.
  select id into v_pairing from public.club_event_pairings
   where event_id = p_event and round = p_round;
  if v_pairing is null then
    insert into public.club_event_pairings (event_id, round, label, published)
    values (p_event, p_round, 'Round ' || p_round, false)
    returning id into v_pairing;
  end if;

  select coalesce(max(position) + 1, 0) into v_next
    from public.club_event_team_matches where pairing_id = v_pairing;

  insert into public.club_event_team_matches
    (event_id, pairing_id, team_one, team_two, position)
  values (p_event, v_pairing, p_team_one, p_team_two, v_next)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.add_event_team_fixture(bigint, integer, bigint, bigint)
  from public, anon;
grant execute on function public.add_event_team_fixture(bigint, integer, bigint, bigint)
  to authenticated;

-- ---------------------------------------------------------- the reads
--
-- Built from 0176's definition, not 0168's. Rebuilding a replacement from the
-- first version with a name is what dropped `save_pairing_armies`' outcome
-- stamp in 0181, and the suite caught it; this is the same trap one migration
-- later. `create or replace` cannot change a return type, so it drops first.

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
                    'pointsOne', pm.points_one, 'pointsTwo', pm.points_two,
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

-- A team's own score has to come back, or it is writable and never readable.
-- 0168's definition with one column added; it is the only one with this name.

drop function if exists public.event_teams(bigint);

create function public.event_teams(p_event bigint)
returns table (
  id bigint, name text, "position" smallint, final_rank smallint, placement text,
  final_score integer, captain_profile_id uuid, players jsonb
)
language sql stable security invoker set search_path = public as $$
  select t.id, t.name, t.position, t.final_rank, t.placement, t.final_score,
         t.captain_profile_id,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', p.id, 'profileId', p.profile_id,
                    'name', p.player_name, 'position', p.position)
                  order by p.position, p.id)
             from public.club_event_team_players p where p.team_id = t.id
         ), '[]'::jsonb)
    from public.club_event_teams t
   where t.event_id = p_event
   order by coalesce(t.final_rank, 9999), t.position, lower(t.name)
$$;

revoke all on function public.event_teams(bigint) from public;
grant execute on function public.event_teams(bigint) to authenticated, anon;
