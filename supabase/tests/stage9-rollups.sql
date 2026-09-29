-- 0142 · what wins, and who may ask.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Backdating a booking needs postgres: the guard refuses a past date on write,
-- which is right for a member and in the way of a test that needs history.
create or replace function pg_temp.played_on(p_id bigint, p_date date)
returns void language sql security definer as $fn$
  update public.club_bookings set session_date = p_date where id = p_id $fn$;

set local role authenticated;

do $$
declare
  w record; v_club bigint; v_book bigint; f record; m record; n int;
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_book from bk;

  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['2000'], 'warhammer-40k-11th', '11th', 'v1');
  perform public.save_army_faction('warhammer-40k-11th', 'death-guard', 'Death Guard', 0);
  perform public.save_army_faction('warhammer-40k-11th', 'aeldari', 'Aeldari', 1);
  perform public.save_army_detachment('warhammer-40k-11th', 'death-guard',
    'mortarions-hammer', 'Mortarion''s Hammer', array['Purge the Foe'], 0);
  perform public.publish_army_catalogue('warhammer-40k-11th', '');

  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');

  -- ------------------------------------------------- an unsettled game first
  perform pg_temp.be(w.member);
  perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
    jsonb_build_object(
      'one', jsonb_build_object('factionId', 'death-guard',
                                'detachment', 'Mortarion''s Hammer',
                                'disposition', 'Purge the Foe'),
      'two', jsonb_build_object('factionId', 'aeldari')));
  perform pg_temp.played_on(v_book, public.london_today() - 10);

  select count(*)::int into n from public.meta_factions(v_club);
  assert n = 0, 'an unsettled game was counted: ' || n || ' factions';
  raise notice 'PASS counting: a result the club has not settled is not in the meta';

  -- ------------------------------------------------------- the club settles
  perform pg_temp.be(w.owner);
  perform public.record_booking_result(v_book, 85, 62, '', '', 'Purge', 'dawn-of-war',
    'Ruins', 'admin-confirmed',
    jsonb_build_object(
      'one', jsonb_build_object('factionId', 'death-guard',
                                'detachment', 'Mortarion''s Hammer',
                                'disposition', 'Purge the Foe',
                                'mvpUnits', jsonb_build_array('Plague Marines')),
      'two', jsonb_build_object('factionId', 'aeldari')));
  perform pg_temp.played_on(v_book, public.london_today() - 10);

  select * into f from public.meta_factions(v_club) where faction_id = 'death-guard';
  assert f.games = 1, 'the settled game was not counted';
  assert f.wins = 1, 'the winner did not win';
  assert f.win_rate = 100.0, 'wrong win rate: ' || f.win_rate;
  assert f.representation = 50.0, 'two armies, one faction, so half: ' || f.representation;
  assert f.early_signal, 'one game should read as an early signal';
  raise notice 'PASS factions: settled games count, and one game is flagged early';

  -- ------------------------------------------------ the same game, both ways
  select * into m from public.meta_matchups(v_club) where faction_id = 'death-guard';
  assert m.opponent_id = 'aeldari', 'wrong opponent: ' || m.opponent_id;
  assert m.win_rate = 100.0, 'wrong matchup rate';
  select * into m from public.meta_matchups(v_club) where faction_id = 'aeldari';
  assert m.win_rate = 0.0, 'the loser did not read as a loss from their side';
  raise notice 'PASS matchups: one game, read from both sides';

  -- ------------------------------------------------ a disposition is a pair
  select count(*)::int into n from public.meta_dispositions(v_club);
  assert n = 1, 'wrong number of disposition rows: ' || n;
  select count(*)::int into n from public.meta_detachments(v_club);
  assert n = 1, 'wrong number of detachment rows: ' || n;
  raise notice 'PASS depth: the detachment and its disposition each counted once';

  -- ------------------------------------------------------ the battle context
  select count(*)::int into n from public.meta_battle_context(v_club)
   where kind = 'mission' and value = 'Purge';
  assert n = 1, 'the mission did not reach the context view';
  raise notice 'PASS context: the mission, deployment and terrain are groupable';

  -- --------------------------------------------------------------- the units
  select count(*)::int into n from public.meta_units(v_club)
   where unit_name = 'Plague Marines';
  assert n = 1, 'the MVP tag did not reach the unit view';
  raise notice 'PASS units: an MVP tag is a signal';

  -- ------------------------------------------- a podium moves no win rate
  declare v_event bigint; v_placing bigint; v_before numeric;
  begin
    select win_rate into v_before from public.meta_factions(v_club)
     where faction_id = 'death-guard';

    insert into public.club_events (club_id, legacy_id, title, start_date, status)
    values (v_club, 'x-rtt', 'RTT', public.london_today() - 7, 'published')
    returning id into v_event;
    v_placing := public.save_event_placing(v_event, null, 1, 'Somebody', null,
      'Death Guard', '', '');

    select * into f from public.meta_factions(v_club) where faction_id = 'death-guard';
    assert f.win_rate = v_before, 'a podium moved a win rate: ' || f.win_rate;
    assert f.podiums = 1, 'the podium was not counted at all';
    assert f.appearances = 2, 'the podium did not count towards representation';
    raise notice 'PASS podium: it strengthens the signal without inventing a win';
  end;

  -- ------------------------------------------------------ a window is a window
  select count(*)::int into n from public.meta_factions(
    v_club, public.london_today() - 3, public.london_today());
  assert n = 0, 'a game from ten days ago showed up in a three day window';
  raise notice 'PASS lens: the window is respected';

  -- ------------------------------------------------- and who may ask at all
  perform pg_temp.be(w.stranger);
  begin
    perform count(*) from public.meta_factions(v_club);
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then
      raise notice 'PASS scope: a stranger cannot read one club''s meta';
    when others then raise exception 'wrong error for a stranger: %', sqlerrm;
  end;

  -- The global sample is the site-wide tracker, open to anybody signed in.
  perform count(*) from public.meta_factions(null);
  raise notice 'PASS scope: but the site-wide sample is theirs to read';

  select count(*)::int into n from public.meta_scope_counts();
  assert n = 0, 'a stranger was offered a club in the scope picker';
  perform pg_temp.be(w.member);
  select count(*)::int into n from public.meta_scope_counts();
  assert n = 1, 'a member was not offered their own club: ' || n;
  raise notice 'PASS scope: the picker offers only the clubs you are in';

  raise notice 'ALL PASS · stage 9 rollups';
end $$;

rollback;
