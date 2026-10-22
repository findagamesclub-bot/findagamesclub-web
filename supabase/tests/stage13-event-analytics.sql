-- 0209 · event analytics grouped the way a club reads them.
--
-- The assertion that matters is 2: "taken by N players" counts people, not
-- rows. One person at one event has an army row per table of the draw plus one
-- on the podium, so counting rows would say a field of two was five.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Two players, two rounds, and a podium on top. Both bring Sororitas under
-- different detachments, which is the case `meta_event` could not answer:
-- grouped by the whole triple they are two minority rows, and "how did
-- Sororitas do here" is on neither of them.
create or replace function pg_temp.seed_event() returns bigint
language plpgsql security definer as $fn$
declare
  v_club bigint; v_event bigint; v_round bigint;
  v_m1 bigint; v_m2 bigint; v_m3 bigint;
  v_place bigint;
begin
  select id into v_club from public.clubs where slug = 'army-club';

  insert into public.club_events (club_id, legacy_id, title, start_date, status)
  values (v_club, '2099-02-02-analytics-test', 'Analytics Open',
          current_date - 7, 'published')
  returning id into v_event;

  insert into public.club_event_pairings (event_id, round, label, published)
  values (v_event, 1, 'Round 1', true) returning id into v_round;
  insert into public.club_event_pairing_matches
    (pairing_id, event_id, position, player_one, player_two)
  values (v_round, v_event, 1, 'Ann Lee', 'Ben Shah') returning id into v_m1;

  insert into public.club_event_pairings (event_id, round, label, published)
  values (v_event, 2, 'Round 2', true) returning id into v_round;
  insert into public.club_event_pairing_matches
    (pairing_id, event_id, position, player_one, player_two)
  values (v_round, v_event, 1, 'Ann Lee', 'Ben Shah') returning id into v_m2;

  -- A third round drawn and never scored. Without it the outcome filter in
  -- `meta_event_players` is a guard nothing exercises: a podium row is already
  -- excluded by the join, so removing the filter changes no figure. This is
  -- the row it is actually there for.
  insert into public.club_event_pairings (event_id, round, label, published)
  values (v_event, 3, 'Round 3', true) returning id into v_round;
  insert into public.club_event_pairing_matches
    (pairing_id, event_id, position, player_one, player_two)
  values (v_round, v_event, 1, 'Ann Lee', 'Ben Shah') returning id into v_m3;

  insert into public.club_event_results (event_id, rank, placement, member_name)
  values (v_event, 1, '1st', 'Ann Lee') returning id into v_place;

  -- Ann wins both rounds with Sororitas / Hallowed Martyrs / Take and Hold.
  -- Ben loses both with Sororitas / Army of Faith / Disruption.
  insert into public.game_result_armies
    (source_type, source_id, side, club_id, played_on, player_name,
     faction_id, faction_label, detachment, disposition, outcome)
  values
    ('event_pairing', v_m1, 'one', v_club, current_date - 7, 'Ann Lee',
     'adepta-sororitas', 'Adepta Sororitas', 'Hallowed Martyrs', 'Take and Hold', 'won'),
    ('event_pairing', v_m1, 'two', v_club, current_date - 7, 'Ben Shah',
     'adepta-sororitas', 'Adepta Sororitas', 'Army of Faith', 'Disruption', 'lost'),
    ('event_pairing', v_m2, 'one', v_club, current_date - 7, 'Ann Lee',
     'adepta-sororitas', 'Adepta Sororitas', 'Hallowed Martyrs', 'Take and Hold', 'won'),
    ('event_pairing', v_m2, 'two', v_club, current_date - 7, 'Ben Shah',
     'adepta-sororitas', 'Adepta Sororitas', 'Army of Faith', 'Disruption', 'lost'),
    -- Round 3, drawn and never scored. An army taken, not a game played.
    ('event_pairing', v_m3, 'one', v_club, current_date - 7, 'Ann Lee',
     'adepta-sororitas', 'Adepta Sororitas', 'Hallowed Martyrs', 'Take and Hold', ''),
    ('event_pairing', v_m3, 'two', v_club, current_date - 7, 'Ben Shah',
     'adepta-sororitas', 'Adepta Sororitas', 'Army of Faith', 'Disruption', ''),
    -- And Ann's podium army, which is another row for the same two people.
    ('event_podium', v_place, 'one', v_club, current_date - 7, 'Ann Lee',
     'adepta-sororitas', 'Adepta Sororitas', 'Hallowed Martyrs', 'Take and Hold', '');

  return v_event;
end $fn$;

create temp table ev as select pg_temp.seed_event() as id;
grant select on ev to authenticated;

set local role authenticated;

do $$
declare w record; v_event bigint; r record; n bigint;
begin
  select * into w from who;
  select id into v_event from ev;
  perform pg_temp.be(w.owner);

  -- 1 · One faction row, not two. The whole point: both players brought
  --     Sororitas, so "how did Sororitas do here" is one answer.
  select count(*) into n
    from public.meta_event_breakdown(v_event) where kind = 'faction';
  if n <> 1 then
    raise exception 'FAIL 1: the faction group has % rows, expected one', n;
  end if;

  -- 2 · Taken by TWO players, out of five army rows. Counting rows would say
  --     five, which is the figure that made the old panel unreadable.
  select * into r from public.meta_event_breakdown(v_event) where kind = 'faction';
  if r.players <> 2 then
    raise exception 'FAIL 2: Sororitas was taken by % players, expected 2', r.players;
  end if;
  if r.appearances <> 7 then
    raise exception 'FAIL 2b: % army rows, expected 7', r.appearances;
  end if;

  -- 3 · And its rate is over the SCORED games only, so the podium army with
  --     no outcome neither helps nor hurts it. Four scored, two won.
  if r.games <> 4 or r.wins <> 2 or r.win_rate <> 50.0 then
    raise exception 'FAIL 3: % scored, % won, rate %', r.games, r.wins, r.win_rate;
  end if;

  -- 4 · The detachments split where the faction did not, which is the detail
  --     the client asked for: one is unbeaten and one has not won a game.
  select * into r from public.meta_event_breakdown(v_event)
   where kind = 'detachment' and label = 'Hallowed Martyrs';
  if r.win_rate <> 100.0 or r.players <> 1 or r.parent <> 'Adepta Sororitas' then
    raise exception 'FAIL 4: Hallowed Martyrs read rate %, players %, parent %',
      r.win_rate, r.players, r.parent;
  end if;
  select * into r from public.meta_event_breakdown(v_event)
   where kind = 'detachment' and label = 'Army of Faith';
  if r.win_rate <> 0.0 then
    raise exception 'FAIL 4b: Army of Faith read rate %', r.win_rate;
  end if;

  -- 5 · Dispositions are their own group, which is the client's own example:
  --     "Disruption disposition was taken by N players, and had a X% win
  --     rate".
  select * into r from public.meta_event_breakdown(v_event)
   where kind = 'disposition' and label = 'Disruption';
  if r.players <> 1 or r.games <> 2 or r.win_rate <> 0.0 then
    raise exception 'FAIL 5: Disruption read players %, games %, rate %',
      r.players, r.games, r.win_rate;
  end if;

  -- 5b · And ONE row, never one per army that took it. A detachment belongs
  --      to one faction so it carries its parent; a disposition is shared, and
  --      splitting it put the same name on the screen twice at a two-player
  --      event. Both players took Take and Hold or Disruption under different
  --      factions in the fuller fixtures, and the client's example is one row.
  select count(*) into n from public.meta_event_breakdown(v_event)
   where kind = 'disposition' and label = 'Disruption';
  if n <> 1 then
    raise exception 'FAIL 5b: Disruption is % rows, expected one', n;
  end if;
  if r.parent <> '' then
    raise exception 'FAIL 5c: a disposition carries the parent "%"', r.parent;
  end if;

  -- 6 · Best first within a group, which is what "best to worst" means.
  select label into r from public.meta_event_breakdown(v_event)
   where kind = 'detachment' limit 1;
  if r.label <> 'Hallowed Martyrs' then
    raise exception 'FAIL 6: the detachments lead with %, not the best one', r.label;
  end if;

  -- 7 · Match ups come from tables of the draw, never from a podium: a
  --     placing has no other side to sit opposite. Both players brought the
  --     same faction here, so this is a mirror and ONE row, which is also the
  --     sharper test of the self-join: what pairs two armies is being on
  --     opposite sides of one table, not being different factions.
  select count(*) into n from public.meta_event_matchups(v_event);
  if n <> 1 then
    raise exception 'FAIL 7: % match up rows, expected one mirror', n;
  end if;
  select * into r from public.meta_event_matchups(v_event);
  if r.games <> 4 or r.wins <> 2 or r.win_rate <> 50.0 then
    raise exception 'FAIL 7b: the mirror read % games, % wins, rate %',
      r.games, r.wins, r.win_rate;
  end if;
  -- Seven army rows exist and only the four scored ones are in here, so the
  -- podium and the unscored round are both excluded.
  if r.games <> 4 then
    raise exception 'FAIL 7c: the podium army reached the match ups';
  end if;

  -- 8 · And the players list is what "undefeated" is read from. Ann played
  --     two and won two; the podium row is not a game and is not counted.
  select * into r from public.meta_event_players(v_event) where player = 'Ann Lee';
  if r.games <> 2 or r.wins <> 2 or r.losses <> 0 then
    raise exception 'FAIL 8: Ann read % games, % wins, % losses',
      r.games, r.wins, r.losses;
  end if;
  select count(*) into n from public.meta_event_players(v_event);
  if n <> 2 then
    raise exception 'FAIL 8b: % players at a two-player event', n;
  end if;
end $$;

rollback;

\echo '0209 event analytics: all pass'
