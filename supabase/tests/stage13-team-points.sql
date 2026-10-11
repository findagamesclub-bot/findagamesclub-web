-- 0176 · a club scores a team fixture itself, beside the players' total.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.fixture(p_id bigint)
returns public.club_event_team_matches language sql security definer as $fn$
  select * from public.club_event_team_matches where id = p_id $fn$;

insert into public.club_events (club_id, legacy_id, title, start_date, team_event)
  select id, '2026-06-06-points-bash', 'Points Bash', current_date - 10, true from c;

do $$
declare
  w record; v_event bigint; v_round bigint; v_fix bigint;
  v_red bigint; v_blue bigint; v_row public.club_event_team_matches;
begin
  select * into w from who;
  select id into v_event from public.club_events where legacy_id = '2026-06-06-points-bash';

  insert into public.club_event_teams (event_id, name, position)
    values (v_event, 'Red Dice', 0) returning id into v_red;
  insert into public.club_event_teams (event_id, name, position)
    values (v_event, 'Blue Dice', 1) returning id into v_blue;

  insert into public.club_event_pairings (event_id, round, published)
    values (v_event, 1, true) returning id into v_round;
  insert into public.club_event_team_matches
    (pairing_id, event_id, table_label, team_one, team_two, position)
    values (v_round, v_event, 'A', v_red, v_blue, 0) returning id into v_fix;

  -- Two tables, scored, so the players' total is 200 to 190. The client's own
  -- example.
  insert into public.club_event_pairing_matches
    (pairing_id, event_id, team_match_id, table_label, player_one, player_two,
     score_one, score_two, "position")
  values (v_round, v_event, v_fix, 'A1', 'One Red', 'One Blue', 110, 100, 0),
         (v_round, v_event, v_fix, 'A2', 'Two Red', 'Two Blue', 90, 90, 1);

  v_row := pg_temp.fixture(v_fix);
  if v_row.score_one <> 200 or v_row.score_two <> 190 then
    raise exception 'FAIL 1: the players'' total reads % to %',
      v_row.score_one, v_row.score_two;
  end if;

  -- 1 · Nothing typed yet, so the club has said nothing. Null is not nil.
  if v_row.points_one is not null or v_row.points_two is not null then
    raise exception 'FAIL 2: a fixture nobody scored came back with points';
  end if;

  -- 2 · The club types 5 and 4, which is not the total and is not meant to be.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.set_team_match_points(v_fix, 5, 4);
  reset role;
  perform set_config('request.jwt.claims', null, true);

  v_row := pg_temp.fixture(v_fix);
  if v_row.points_one <> 5 or v_row.points_two <> 4 then
    raise exception 'FAIL 3: the club''s own score reads % to %',
      v_row.points_one, v_row.points_two;
  end if;

  -- 3 · AND THE PLAYERS' TOTAL IS UNTOUCHED. That is the whole answer to
  --     0168's worry: the two are different questions, not two copies of one.
  if v_row.score_one <> 200 or v_row.score_two <> 190 then
    raise exception 'FAIL 4: typing a team score moved the players'' total to % to %',
      v_row.score_one, v_row.score_two;
  end if;

  -- 4 · A table changing still refreshes the players' total and leaves the
  --     club's own score alone.
  update public.club_event_pairing_matches set score_one = 120
   where team_match_id = v_fix and table_label = 'A1';

  v_row := pg_temp.fixture(v_fix);
  if v_row.score_one <> 210 then
    raise exception 'FAIL 5: the players'' total did not follow the table (%)',
      v_row.score_one;
  end if;
  if v_row.points_one <> 5 then
    raise exception 'FAIL 6: a table change overwrote the club''s own score';
  end if;

  -- 5 · Clearing goes back to the total with nothing lost.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.set_team_match_points(v_fix, null, null);
  reset role;
  perform set_config('request.jwt.claims', null, true);

  v_row := pg_temp.fixture(v_fix);
  if v_row.points_one is not null or v_row.points_two is not null then
    raise exception 'FAIL 7: clearing left % to %', v_row.points_one, v_row.points_two;
  end if;
  if v_row.score_one <> 210 or v_row.score_two <> 190 then
    raise exception 'FAIL 8: clearing disturbed the players'' total';
  end if;

  -- 6 · One side without the other is half a result.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.set_team_match_points(v_fix, 5, null);
    reset role;
    raise exception 'FAIL 9: one side of a team score was accepted';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'TEAM_POINTS_BOTH' then raise; end if;
  end;

  -- 7 · And a negative score is not one.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.set_team_match_points(v_fix, -1, 4);
    reset role;
    raise exception 'FAIL 10: a negative team score was accepted';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'TEAM_POINTS_NEGATIVE' then raise; end if;
  end;
  perform set_config('request.jwt.claims', null, true);

  -- 8 · A stranger cannot score somebody else's fixture, and the guard is
  --     what stops them rather than the absence of a grant.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.set_team_match_points(v_fix, 9, 0);
    reset role;
    raise exception 'FAIL 11: a stranger scored somebody else''s fixture';
  exception when insufficient_privilege then reset role;
  end;
  perform set_config('request.jwt.claims', null, true);

  -- 9 · A site admin can score a fixture at a club they are not on the team
  --     of. Measured, not assumed: `club_role_of` returns 'admin' for them, so
  --     `club_can` is already true and the `or public.is_admin()` clause in the
  --     writer is belt and braces rather than the thing that admits them. This
  --     pins the outcome, which is what matters, and makes no claim about
  --     which half does it.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.set_team_match_points(v_fix, 3, 3);
  reset role;
  perform set_config('request.jwt.claims', null, true);

  v_row := pg_temp.fixture(v_fix);
  if v_row.points_one <> 3 then
    raise exception 'FAIL 12: a site admin could not score a fixture';
  end if;

  -- 10 · The read hands both pairs back, because the screen shows both.
  if not exists (
    select 1 from public.event_team_draw(v_event)
     where id = v_fix and points_one = 3 and score_one = 210) then
    raise exception 'FAIL 13: the draw read did not return both scores';
  end if;

  raise notice 'stage13 team points: all pass';
end $$;

rollback;
