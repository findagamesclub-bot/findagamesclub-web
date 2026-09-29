-- The demo seed, run against the real schema and then read back.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- The seed names Didcot and reads the catalogue, so the harness needs both.
update public.clubs set slug = 'didcot-wargames-didcot'
 where id = (select id from c);

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

set local role authenticated;
do $$
declare w record;
begin
  select * into w from who;
  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['2000'], 'warhammer-40k-11th', '11th', 'v1');

  -- Ten factions so the seed has eight to choose from, each with a detachment
  -- that offers a disposition and one unit to tag.
  for i in 1..10 loop
    perform public.save_army_faction('warhammer-40k-11th',
      'faction-' || i, 'Faction ' || i, i);
    perform public.save_army_detachment('warhammer-40k-11th', 'faction-' || i,
      'det-' || i, 'Detachment ' || i,
      array[(array['Purge the Foe','Take and Hold','Priority Assets'])[1 + i % 3]], 0);
    perform public.save_army_unit('warhammer-40k-11th', 'faction-' || i,
      'Unit ' || i, 100, '[]'::jsonb, '[]'::jsonb, 0);
  end loop;
  perform public.publish_army_catalogue('warhammer-40k-11th', '');
end $$;
reset role;

\i supabase/seeds/demo_meta_results.sql

set local role authenticated;
do $$
declare w record; v_club bigint; f record; n int; total int;
begin
  select * into w from who;
  select id into v_club from c;
  perform pg_temp.be(w.member);

  select count(*)::int into total from public.game_result_armies
   where source_id >= 900001;
  assert total >= 40, 'the seed wrote almost nothing: ' || total;
  raise notice 'PASS seed: % army rows written', total;

  -- Two sides for every game, never one.
  select count(*)::int into n from (
    select source_id from public.game_result_armies
     where source_id >= 900001 group by source_id having count(*) <> 2) x;
  assert n = 0, n || ' games were seeded with one side';
  raise notice 'PASS seed: every seeded game has two sides';

  -- The two sides agree about who won.
  select count(*)::int into n
    from public.game_result_armies a
    join public.game_result_armies b
      on b.source_id = a.source_id and b.side <> a.side
   where a.source_id >= 900001
     and ((a.outcome = 'won' and b.outcome <> 'lost')
       or (a.outcome = 'drew' and b.outcome <> 'drew'));
  assert n = 0, n || ' games disagree about who won';
  raise notice 'PASS seed: both sides of a game tell the same story';

  -- Every combination is one the catalogue actually offers. The whole point
  -- of reading the catalogue rather than naming armies.
  select count(*)::int into n
    from public.game_result_armies a
    left join public.army_detachments d
      on d.faction_id = a.faction_id and d.label = a.detachment
   where a.source_id >= 900001
     and (d.id is null or not (a.disposition = any (d.dispositions)));
  assert n = 0, n || ' seeded armies are combinations the pickers would refuse';
  raise notice 'PASS seed: every army is one the catalogue offers';

  -- ------------------------------------------------ and the tracker reads it
  select count(*)::int into n from public.meta_factions(v_club);
  assert n >= 6, 'the tracker found only ' || n || ' factions';
  raise notice 'PASS meta: % factions to compare', n;

  select * into f from public.meta_factions(v_club) limit 1;
  assert f.games >= 2, 'the leader is still an early signal: ' || f.games;
  assert not f.early_signal, 'the leader should not be flagged early now';
  assert f.win_rate between 0 and 100, 'impossible win rate: ' || f.win_rate;
  raise notice 'PASS meta: % leads at %%% over % games',
    f.faction_label, f.win_rate, f.games;

  select count(*)::int into n from public.meta_matchups(v_club);
  assert n >= 6, 'only ' || n || ' matchups';
  select count(*)::int into n from public.meta_battle_context(v_club);
  assert n >= 10, 'only ' || n || ' context rows';
  select count(*)::int into n from public.meta_trend(v_club);
  assert n >= 6, 'only ' || n || ' trend points, so the chart has no shape';
  raise notice 'PASS meta: matchups, context and a trend with months in it';

  -- The units view has to be able to disagree with itself. The first seed
  -- tagged one unit as the one that earned it on every single army, so every
  -- unit read 100% from a full sample: a column of identical cards that could
  -- not be wrong and could not be useful either.
  select count(*)::int into n from public.meta_units(v_club)
   where underwhelming > 0;
  assert n > 0, 'no unit was ever tagged as the one that did not earn it';

  select count(distinct unit_name)::int into n from public.meta_units(v_club);
  assert n >= 4, 'only ' || n || ' distinct units tagged across a year';

  select count(*)::int into n from public.meta_units(v_club) where mvp > 0;
  assert n > 0, 'no unit was ever tagged as the one that earned it';
  raise notice 'PASS units: tagged both ways, and more than one unit';
end $$;

-- Running it twice has to re-seed rather than quietly do nothing. The first
-- cut used `on conflict do nothing`, so a second run printed the same
-- reassuring counts and left the old rows in place: a change to the seed
-- looked applied and was not.
reset role;
update public.game_result_armies
   set mvp_units = '{}', underwhelming_units = '{}', faction_label = 'Wrong'
 where source_id >= 900001;

\i supabase/seeds/demo_meta_results.sql

set local role authenticated;
do $$
declare w record; v_club bigint; n int;
begin
  select * into w from who;
  select id into v_club from c;
  perform pg_temp.be(w.member);

  select count(*)::int into n from public.game_result_armies
   where source_id >= 900001 and faction_label = 'Wrong';
  assert n = 0, n || ' rows survived a second run untouched';

  select count(*)::int into n from public.meta_units(v_club);
  assert n > 0, 'the second run wrote no units back';
  raise notice 'PASS rerun: running the seed again re-seeds rather than skipping';

  -- A window narrows it, which is the whole point of the lens.
  select count(*)::int into n from public.meta_factions(
    v_club, public.london_today() - 30, public.london_today());
  assert n > 0, 'the last 30 days are empty';
  assert n <= (select count(*) from public.meta_factions(v_club)),
    'a 30 day window found more than all time';
  raise notice 'PASS meta: the window narrows the sample';

  raise notice 'ALL PASS · stage 9 seed';
end $$;

rollback;
