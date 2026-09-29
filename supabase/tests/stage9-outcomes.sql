-- 0141 · a recorded army carries how the game went.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- As postgres: `game_result_armies_select` hides a club's rows from anybody
-- outside it, so counting from an ordinary session cannot tell a missing row
-- from a hidden one.
create or replace function pg_temp.army(p_source text, p_id bigint, p_side text)
returns public.game_result_armies language sql security definer as $fn$
  select * from public.game_result_armies
   where source_type = p_source and source_id = p_id and side = p_side $fn$;

set local role authenticated;

do $$
declare w record; v_club bigint; v_book bigint; a public.game_result_armies;
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_book from bk;

  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['2000'], 'warhammer-40k-11th', '11th', 'v1');
  perform public.save_army_faction('warhammer-40k-11th', 'death-guard', 'Death Guard', 0);
  perform public.save_army_faction('warhammer-40k-11th', 'aeldari', 'Aeldari', 1);
  perform public.publish_army_catalogue('warhammer-40k-11th', '');

  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');

  -- ------------------------------------------------------ who won, per side
  -- The member records it, so it is submitted rather than settled.
  perform pg_temp.be(w.member);
  perform public.record_booking_result(v_book, 85, 62, '', '', 'Purge', 'dawn-of-war',
    'Ruins', '',
    jsonb_build_object(
      'one', jsonb_build_object('factionId', 'death-guard'),
      'two', jsonb_build_object('factionId', 'aeldari')));

  a := pg_temp.army('booking', v_book, 'one');
  assert a.outcome = 'won', 'the booker scored more and did not win: ' || a.outcome;
  assert a.mission = 'Purge', 'the mission did not travel: ' || a.mission;
  assert a.deployment = 'dawn-of-war', 'the deployment did not travel';
  assert a.terrain = 'Ruins', 'the terrain did not travel';
  raise notice 'PASS outcome: the booker won and the context came with it';

  a := pg_temp.army('booking', v_book, 'two');
  assert a.outcome = 'lost', 'the other side did not lose: ' || a.outcome;
  raise notice 'PASS outcome: and the other side lost';

  -- ---------------------------------------- a member has not settled anything
  assert not (pg_temp.army('booking', v_book, 'one')).confirmed,
    'a result a member typed counted as settled';
  raise notice 'PASS confirmed: a submitted result does not count yet';

  -- -------------------------------------------------- the club settles it
  perform pg_temp.be(w.owner);
  perform public.record_booking_result(v_book, 85, 62, '', '', 'Purge', 'dawn-of-war',
    'Ruins', 'admin-confirmed',
    jsonb_build_object(
      'one', jsonb_build_object('factionId', 'death-guard'),
      'two', jsonb_build_object('factionId', 'aeldari')));
  assert (pg_temp.army('booking', v_book, 'one')).confirmed,
    'the club settled it and it still does not count';
  assert (pg_temp.army('booking', v_book, 'one')).outcome = 'won',
    'settling it changed who won';
  raise notice 'PASS confirmed: settling it is what makes it count';

  -- ------------------------------------------------------------- a draw
  perform public.record_booking_result(v_book, 70, 70, '', '', '', '', '',
    'admin-confirmed',
    jsonb_build_object(
      'one', jsonb_build_object('factionId', 'death-guard'),
      'two', jsonb_build_object('factionId', 'aeldari')));
  assert (pg_temp.army('booking', v_book, 'one')).outcome = 'drew',
    'equal scores did not read as a draw';
  assert (pg_temp.army('booking', v_book, 'two')).outcome = 'drew',
    'a draw was only a draw for one of them';
  raise notice 'PASS outcome: equal scores are a draw for both';

  -- ------------------------------------------- a podium never gains a result
  -- Legacy is explicit: podiums strengthen faction and unit signals and create
  -- no synthetic wins or losses.
  perform pg_temp.be(w.owner);
  declare v_event bigint; v_placing bigint;
  begin
    insert into public.club_events (club_id, legacy_id, title, start_date, status)
    values (v_club, 'x-rtt', 'RTT', public.london_today() - 7, 'published')
    returning id into v_event;
    v_placing := public.save_event_placing(v_event, null, 1, 'Somebody', null,
      'Death Guard', '', '');
    a := pg_temp.army('event_podium', v_placing, 'one');
    assert a.outcome = '', 'a podium invented a result: ' || a.outcome;
    assert a.confirmed, 'a podium has nothing to settle and did not count';
    raise notice 'PASS podium: a finishing place is not a win';
  end;

  -- ------------------------------------------------ clearing takes them with it
  perform public.clear_booking_result(v_book);
  assert pg_temp.army('booking', v_book, 'one') is null,
    'clearing a result left its army counting';
  raise notice 'PASS clear: unrecording a game unrecords what it says';

  raise notice 'ALL PASS · stage 9 outcomes';
end $$;

rollback;
