-- 0168 · team events: a draw at two levels.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- The triggers and the derived score are what is under test and none of them
-- reads `auth.uid()`, so the body runs as postgres. The refusals have their
-- own section at the end, with the role assumed.
create or replace function pg_temp.fixture(p_id bigint)
returns public.club_event_team_matches language sql security definer as $fn$
  select * from public.club_event_team_matches where id = p_id $fn$;

create or replace function pg_temp.holds(p_profile uuid, p_place integer)
returns bigint language sql security definer as $fn$
  select count(*) from public.member_badges m
    join public.club_badges b on b.id = m.badge_id
   where m.profile_id = p_profile and b.podium_rank = p_place
     and m.revoked_at is null $fn$;

create or replace function pg_temp.tables_under(p_match bigint)
returns bigint language sql security definer as $fn$
  select count(*) from public.club_event_pairing_matches
   where team_match_id = p_match $fn$;

insert into public.club_events (club_id, legacy_id, title, start_date, team_event)
  select id, '2026-06-06-team-bash', 'Team Bash', current_date - 10, true from c;

do $$
declare
  w record; v_event bigint; v_round bigint; v_fix bigint;
  v_red bigint; v_blue bigint; v_one bigint; v_two bigint;
  v_row public.club_event_team_matches; v_bad boolean;
begin
  select * into w from who;
  select id into v_event from public.club_events where legacy_id = '2026-06-06-team-bash';

  -- 1 · Two teams of two.
  insert into public.club_event_teams (event_id, name, position)
    values (v_event, 'Red Dice', 0) returning id into v_red;
  insert into public.club_event_teams (event_id, name, position)
    values (v_event, 'Blue Dice', 1) returning id into v_blue;

  insert into public.club_event_team_players (team_id, event_id, profile_id, player_name, position)
  values (v_red, v_event, w.member, 'Member Eight', 0),
         (v_red, v_event, w.admin, 'Admin Eight', 1),
         (v_blue, v_event, w.owner, 'Owner Eight', 0),
         (v_blue, v_event, w.stranger, 'Stranger Eight', 1);

  -- 2 · Nobody plays for two teams.
  begin
    insert into public.club_event_team_players (team_id, event_id, profile_id, player_name)
      values (v_blue, v_event, w.member, 'Member Eight');
    raise exception 'FAIL 1: one player was put in two teams';
  exception when unique_violation then null;
  end;

  -- 3 · A round, and one fixture in it.
  insert into public.club_event_pairings (event_id, round, published)
    values (v_event, 1, false) returning id into v_round;
  insert into public.club_event_team_matches
    (pairing_id, event_id, table_label, team_one, team_two, position)
    values (v_round, v_event, 'A', v_red, v_blue, 0) returning id into v_fix;

  v_row := pg_temp.fixture(v_fix);
  if v_row.score_one is not null then
    raise exception 'FAIL 2: a fixture nobody has played has a score';
  end if;

  -- 4 · Two tables under it, in the order the fixture names its teams.
  insert into public.club_event_pairing_matches
    (pairing_id, event_id, team_match_id, table_label,
     player_one, player_one_id, player_two, player_two_id, position)
    values (v_round, v_event, v_fix, 'A1',
            'Member Eight', w.member, 'Owner Eight', w.owner, 0)
    returning id into v_one;
  insert into public.club_event_pairing_matches
    (pairing_id, event_id, team_match_id, table_label,
     player_one, player_one_id, player_two, player_two_id, position)
    values (v_round, v_event, v_fix, 'A2',
            'Admin Eight', w.admin, 'Stranger Eight', w.stranger, 1)
    returning id into v_two;

  v_row := pg_temp.fixture(v_fix);
  if v_row.score_one is not null then
    raise exception 'FAIL 3: two unplayed tables made a score';
  end if;

  -- 5 · The fixture adds its own tables up, and counts the ones won outright.
  update public.club_event_pairing_matches
     set score_one = 80, score_two = 60 where id = v_one;
  update public.club_event_pairing_matches
     set score_one = 45, score_two = 55 where id = v_two;

  v_row := pg_temp.fixture(v_fix);
  if v_row.score_one <> 125 or v_row.score_two <> 115 then
    raise exception 'FAIL 4: the fixture reads % to %', v_row.score_one, v_row.score_two;
  end if;
  if v_row.games_one <> 1 or v_row.games_two <> 1 then
    raise exception 'FAIL 5: tables won read % to %', v_row.games_one, v_row.games_two;
  end if;

  -- 6 · Taking a table back takes it out of the total.
  update public.club_event_pairing_matches
     set score_one = null, score_two = null where id = v_two;
  v_row := pg_temp.fixture(v_fix);
  if v_row.score_one <> 80 or v_row.games_two <> 0 then
    raise exception 'FAIL 6: clearing a table left % and % won',
      v_row.score_one, v_row.games_two;
  end if;

  -- 7 · player_one plays for team_one, and the other way round is refused.
  begin
    insert into public.club_event_pairing_matches
      (pairing_id, event_id, team_match_id, table_label,
       player_one, player_one_id, player_two, player_two_id, position)
      values (v_round, v_event, v_fix, 'A3',
              'Owner Eight', w.owner, 'Member Eight', w.member, 2);
    raise exception 'FAIL 7: a player was put on the wrong side of a fixture';
  exception when others then
    if sqlerrm <> 'TEAM_PLAYER_WRONG_SIDE' then raise; end if;
  end;

  -- 8 · A name with no account is nobody's to check, and still saves.
  insert into public.club_event_pairing_matches
    (pairing_id, event_id, team_match_id, table_label,
     player_one, player_two, position)
    values (v_round, v_event, v_fix, 'A3', 'A Ringer', 'Somebody Else', 2);

  -- 9 · Removing the fixture takes its tables with it.
  if pg_temp.tables_under(v_fix) <> 3 then
    raise exception 'FAIL 8: % tables under the fixture', pg_temp.tables_under(v_fix);
  end if;

  -- 10 · A team on the podium puts every one of its players there.
  update public.club_event_teams
     set final_rank = 1, placement = '1st' where id = v_red;
  if pg_temp.holds(w.member, 1) <> 1 or pg_temp.holds(w.admin, 1) <> 1 then
    raise exception 'FAIL 9: winning as a team gave no badges';
  end if;
  if pg_temp.holds(w.owner, 1) <> 0 then
    raise exception 'FAIL 10: the losing team was given a winner badge';
  end if;

  update public.club_event_teams
     set final_rank = 2, placement = '2nd' where id = v_blue;
  if pg_temp.holds(w.owner, 2) <> 1 or pg_temp.holds(w.stranger, 2) <> 1 then
    raise exception 'FAIL 11: second as a team gave no badges';
  end if;

  -- 11 · Fourth is not a podium, at team level either.
  update public.club_event_teams set final_rank = 4 where id = v_blue;
  if pg_temp.holds(w.owner, 3) <> 0 then
    raise exception 'FAIL 12: fourth place was given a podium badge';
  end if;

  -- 12 · The fixture goes, and its tables go with it.
  delete from public.club_event_team_matches where id = v_fix;
  if pg_temp.tables_under(v_fix) <> 0 then
    raise exception 'FAIL 13: removing a fixture left its tables behind';
  end if;

  raise notice 'stage13 team events: the draw passes';
end $$;

-- The only part where the session matters.
set local role authenticated;

do $$
declare w record; v_event bigint; v_seen bigint;
begin
  select * into w from who;
  select id into v_event from public.club_events where legacy_id = '2026-06-06-team-bash';

  -- A stranger cannot make a team on somebody else's event.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  begin
    insert into public.club_event_teams (event_id, name) values (v_event, 'Gatecrashers');
    raise exception 'FAIL 14: a stranger made a team';
  exception when insufficient_privilege then null;
  end;

  -- And cannot rename one either: the write policy filters the row out, so the
  -- update touches nothing rather than raising. Zero rows is the refusal.
  update public.club_event_teams set name = 'Mine Now' where event_id = v_event;
  get diagnostics v_seen = row_count;
  if v_seen <> 0 then
    raise exception 'FAIL 15: a stranger renamed % teams', v_seen;
  end if;

  -- The teams themselves are readable, because a tournament publishes who is
  -- playing and the draw is unreadable without them.
  select count(*) into v_seen from public.event_teams(v_event);
  if v_seen <> 2 then
    raise exception 'FAIL 16: a visitor read % teams', v_seen;
  end if;

  -- The club can do both.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  update public.club_event_teams set placement = 'Winners' where event_id = v_event;
  get diagnostics v_seen = row_count;
  if v_seen <> 2 then
    raise exception 'FAIL 17: the club updated % teams', v_seen;
  end if;

  raise notice 'stage13 team events: all pass';
end $$;

rollback;
