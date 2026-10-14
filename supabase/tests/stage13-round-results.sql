-- 0181 · a round result is a result, wherever it was played.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

insert into public.club_competitions (club_id, title, status, start_date)
  select id, 'Autumn Ladder', 'active', current_date - 30 from c;

create temp table comp as
  select id from public.club_competitions where title = 'Autumn Ladder';

do $$
declare
  w record; v_comp bigint; v_round bigint; v_round2 bigint;
  v_one bigint; v_two bigint; v_again bigint;
  v_army record; v_count integer;
begin
  select * into w from who;
  select id into v_comp from comp;

  -- 1 · A stranger cannot post a round to somebody else's league.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.save_competition_round(v_comp, null, 'Round 1', '', current_date,
      '[{"playerOne":"A","playerOneScore":"20","playerTwo":"B","playerTwoScore":"10"}]'::jsonb);
    reset role;
    raise exception 'FAIL 1: a stranger posted a round';
  exception when insufficient_privilege then
    reset role;
  end;

  -- 2 · The club posts a round with two games.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_round := public.save_competition_round(v_comp, null, 'Round 1', 'Tight one.',
    current_date,
    ('[{"playerOne":"Member Eight","playerOneScore":"80","playerTwo":"Dave","playerTwoScore":"60",'
     || '"playerOneId":"' || w.member || '"},'
     || '{"playerOne":"Ann","playerOneScore":"W","playerTwo":"Ben","playerTwoScore":"L"}]')::jsonb);
  reset role;

  select id into v_one from public.club_competition_matches
   where update_id = v_round and position = 0;
  select id into v_two from public.club_competition_matches
   where update_id = v_round and position = 1;
  if v_one is null or v_two is null then
    raise exception 'FAIL 2: the round did not keep two games';
  end if;

  -- 3 · The named member is attached; the typed names are not.
  if (select player_one_id from public.club_competition_matches where id = v_one)
     is distinct from w.member then
    raise exception 'FAIL 3: the member was not attached to their own game';
  end if;

  -- 4 · A profile that is nobody at this club is refused. Attaching a result
  --     to an account is 0177's question and a club does not get to answer it.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.save_competition_round(v_comp, v_round, 'Round 1', '', current_date,
      ('[{"playerOne":"Stranger","playerOneScore":"1","playerTwo":"B","playerTwoScore":"2",'
       || '"playerOneId":"' || w.stranger || '"}]')::jsonb);
    reset role;
    raise exception 'FAIL 4: a stranger was attached to a league game';
  exception when check_violation then
    reset role;
  end;

  -- 5 · Armies on the first game, with the setup.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_competition_match_result(v_one,
    '{"one": {"primaryScore": 45, "secondaryScore": 30, "painted": true},
      "two": {"primaryScore": 30, "secondaryScore": 20}}'::jsonb,
    'Take and Hold', 'Dawn of War', 'UKTC');
  reset role;

  select * into v_army from public.game_result_armies
   where source_type = 'competition_match' and source_id = v_one and side = 'one';
  if v_army is null then
    raise exception 'FAIL 5: no army row was written for a league game';
  end if;

  -- 6 · The setup reached the army row, which is what the rollups read.
  if v_army.mission <> 'Take and Hold' or v_army.deployment <> 'dawn-of-war'
     or v_army.terrain <> 'UKTC' then
    raise exception 'FAIL 6: the setup did not reach the army row (% / % / %)',
      v_army.mission, v_army.deployment, v_army.terrain;
  end if;

  -- 7 · And the outcome, from the two numeric scores. 80 beats 60.
  if v_army.outcome <> 'won' then
    raise exception 'FAIL 7: side one went 80-60 and reads "%"', v_army.outcome;
  end if;
  if (select outcome from public.game_result_armies
       where source_type = 'competition_match' and source_id = v_one and side = 'two')
     <> 'lost' then
    raise exception 'FAIL 8: the other side of an 80-60 game did not lose';
  end if;

  -- 8 · A club that types "W" gets no outcome rather than a wrong one. The
  --     scores have been free text since 0024 and a win rate cannot be built
  --     out of a letter.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_competition_match_result(v_two,
    '{"one": {"primaryScore": 10, "secondaryScore": 5}}'::jsonb, '', '', '');
  reset role;

  if (select outcome from public.game_result_armies
       where source_type = 'competition_match' and source_id = v_two and side = 'one')
     <> '' then
    raise exception 'FAIL 9: "W" against "L" was turned into an outcome';
  end if;

  -- 9 · Saving the round again KEEPS the game, and its armies with it. The
  --     delete-and-reinsert this replaced would have wiped both.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_competition_round(v_comp, v_round, 'Round one', 'Edited.',
    current_date,
    ('[{"id":"' || v_one || '","playerOne":"Member Eight","playerOneScore":"80",'
     || '"playerTwo":"Dave","playerTwoScore":"60","playerOneId":"' || w.member || '"},'
     || '{"id":"' || v_two || '","playerOne":"Ann","playerOneScore":"W",'
     || '"playerTwo":"Ben","playerTwoScore":"L"}]')::jsonb);
  reset role;

  select id into v_again from public.club_competition_matches
   where update_id = v_round and position = 0;
  if v_again is distinct from v_one then
    raise exception 'FAIL 10: the game lost its id on a re-save (% to %)', v_one, v_again;
  end if;

  select count(*) into v_count from public.game_result_armies
   where source_type = 'competition_match' and source_id = v_one;
  if v_count <> 2 then
    raise exception 'FAIL 11: re-saving the round left % armies rather than 2', v_count;
  end if;

  -- 10 · Taking a game off the round takes its armies with it. 0164's rule:
  --      a polymorphic id needs a delete path, or the Meta Tracker counts a
  --      game nobody played.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_competition_round(v_comp, v_round, 'Round one', '', current_date,
    ('[{"id":"' || v_two || '","playerOne":"Ann","playerOneScore":"W",'
     || '"playerTwo":"Ben","playerTwoScore":"L"}]')::jsonb);
  reset role;

  select count(*) into v_count from public.game_result_armies
   where source_type = 'competition_match' and source_id = v_one;
  if v_count <> 0 then
    raise exception 'FAIL 12: a removed game left % phantom armies', v_count;
  end if;

  -- 11 · And the reader answers to a signed-out visitor, because a league
  --      table and its rounds have been public since 0024.
  perform set_config('request.jwt.claims', null, true);
  set local role anon;
  select count(*) into v_count from public.competition_games(v_comp);
  reset role;
  if v_count <> 1 then
    raise exception 'FAIL 13: a visitor reads % games rather than 1', v_count;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'stage13 round results: all pass';
end $$;

rollback;
