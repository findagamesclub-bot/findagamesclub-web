-- 0183 · a team event scores a game its own way, and places by team.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

insert into public.club_events (club_id, legacy_id, title, start_date, status, team_event)
  select id, 'teams-183', 'Team Open', current_date + 20, 'published', true from c;

create temp table ev as
  select id from public.club_events where legacy_id = 'teams-183';

insert into public.club_event_teams (event_id, name, position)
  select id, 'Red Dice', 0 from ev;
insert into public.club_event_teams (event_id, name, position)
  select id, 'Blue Dice', 1 from ev;

create temp table tm as select
  (select id from public.club_event_teams where name = 'Red Dice') as red,
  (select id from public.club_event_teams where name = 'Blue Dice') as blue;

do $$
declare
  w record; v_event bigint; v_red bigint; v_blue bigint;
  v_fixture bigint; v_table bigint; v_one integer; v_two integer; v_rows integer;
begin
  select * into w from who;
  select id into v_event from ev;
  select red, blue into v_red, v_blue from tm;

  -- 1 · A stranger cannot build a round at somebody else's event.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.add_event_team_fixture(v_event, 1, v_red, v_blue);
    reset role;
    raise exception 'FAIL 1: a stranger made a fixture';
  exception when insufficient_privilege then
    reset role;
  end;

  -- 2 · The club makes one by hand, and the round it needs is made with it.
  --     0168 left the shuffle as the only way to get a fixture, which is what
  --     the client ran into: a format the draw does not understand had no way
  --     in at all.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_fixture := public.add_event_team_fixture(v_event, 1, v_red, v_blue);
  reset role;

  if v_fixture is null then raise exception 'FAIL 2: no fixture came back'; end if;
  if (select count(*) from public.club_event_pairings
       where event_id = v_event and round = 1) <> 1 then
    raise exception 'FAIL 3: the round was not made with the fixture';
  end if;

  -- 3 · A fixture is two different teams, and both of them are at this event.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.add_event_team_fixture(v_event, 1, v_red, v_red);
    reset role;
    raise exception 'FAIL 4: a team was drawn against itself';
  exception when check_violation then
    reset role;
  end;

  -- 4 · A table inside the fixture, with victory points AND the format's own
  --     score. 80-60 on victory points, scored 3-1 by the format: the two
  --     mean different things and both are kept, which is 0176's rule one
  --     level down.
  --
  --     AS THE CLUB, not as postgres. This table is granted by column, so a
  --     new one is readable and never writable until it is named in the
  --     grant, and postgres bypasses that entirely. Written the other way
  --     round this block passed while the screen answered "permission denied
  --     for table club_event_pairing_matches".
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.club_event_pairing_matches
    (pairing_id, event_id, team_match_id, table_label,
     player_one, player_two, score_one, score_two, points_one, points_two, position)
  select pairing_id, v_event, v_fixture, 'A1',
         'Ann', 'Ben', 80, 60, 3, 1, 0
    from public.club_event_team_matches where id = v_fixture
  returning id into v_table;
  reset role;

  select points_one, points_two into v_one, v_two
    from public.club_event_pairing_matches where id = v_table;
  if v_one <> 3 or v_two <> 1 then
    raise exception 'FAIL 5: the game''s own score reads % to %', v_one, v_two;
  end if;

  -- 5 · And the victory points still roll into the fixture, untouched by it.
  select score_one, score_two into v_one, v_two
    from public.club_event_team_matches where id = v_fixture;
  if v_one <> 80 or v_two <> 60 then
    raise exception 'FAIL 6: the fixture totals % to % rather than 80 to 60',
      v_one, v_two;
  end if;

  -- 6 · One side of a game's own score without the other is half a result,
  --     and the club has to be able to write the column at all to find out.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.club_event_pairing_matches
       set points_one = 5, points_two = null where id = v_table;
    reset role;
    raise exception 'FAIL 7: half a game score was accepted';
  exception when check_violation then
    reset role;
  end;

  -- 7 · The reader hands both pairs back, so a screen can draw either.
  if (select (t ->> 'pointsOne')::integer
        from public.event_team_draw(v_event) d,
             jsonb_array_elements(d.tables) t
       where d.id = v_fixture limit 1) <> 3 then
    raise exception 'FAIL 8: the draw does not return a game''s own score';
  end if;

  -- 8 · A team's finishing place carries a figure beside it now. The rank was
  --     already there; what the client asked for is the score.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.club_event_teams
     set final_rank = 1, placement = 'Winners', final_score = 17
   where id = v_red and event_id = v_event;
  reset role;

  if (select final_score from public.event_teams(v_event) where id = v_red) <> 17 then
    raise exception 'FAIL 9: a team''s own score did not come back';
  end if;

  -- 9 · And it cannot be negative, which is the one thing a tally is not.
  begin
    update public.club_event_teams set final_score = -1 where id = v_blue;
    raise exception 'FAIL 10: a negative team score was accepted';
  exception when check_violation then null;
  end;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'stage13 team scoring: all pass';
end $$;

rollback;
