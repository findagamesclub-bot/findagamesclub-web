-- 0135 and 0136 · what somebody actually played.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.armies(p_source text, p_id bigint) returns int
language sql security definer as $fn$
  select count(*)::int from public.game_result_armies
   where source_type = p_source and source_id = p_id $fn$;

create or replace function pg_temp.army(p_source text, p_id bigint, p_side text)
returns public.game_result_armies language sql security definer as $fn$
  select * from public.game_result_armies
   where source_type = p_source and source_id = p_id and side = p_side $fn$;

create or replace function pg_temp.booking_army(p_id bigint) returns text
language sql security definer as $fn$
  select booked_by_army from public.club_bookings where id = p_id $fn$;

-- Somebody taking a table off a looking-for-game post. As postgres, because a
-- member cannot move another member into a seat.
create or replace function pg_temp.accept(p_id bigint, p_who uuid) returns void
language sql security definer as $fn$
  update public.club_bookings
     set accepted_by = p_who, opponent_profile_id = null
   where id = p_id $fn$;

set local role authenticated;

do $$
declare v_club bigint; w record; v_book bigint; a public.game_result_armies; n int;
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_book from bk;

  -- A published catalogue to record against.
  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['2000'], 'warhammer-40k-11th', '11th', 'v1');
  perform public.save_army_faction('warhammer-40k-11th', 'adepta-sororitas',
    'Adepta Sororitas', 0);
  perform public.save_army_detachment('warhammer-40k-11th', 'adepta-sororitas',
    'hallowed-martyrs', 'Hallowed Martyrs', array['Priority Assets'], 0);
  perform public.save_army_detachment('warhammer-40k-11th', 'adepta-sororitas',
    'army-of-faith', 'Army of Faith', array['Take and Hold'], 1);
  perform public.publish_army_catalogue('warhammer-40k-11th', '');

  -- ---------------------------------------------------- the club's own switch
  perform pg_temp.be(w.member);
  begin
    perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then
      raise notice 'PASS switch: a member cannot turn the builder on';
    when others then raise exception 'wrong error for a member: %', sqlerrm;
  end;

  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');
  raise notice 'PASS switch: the owner can';

  -- --------------------------------------------------------- recording a game
  perform pg_temp.be(w.member);
  perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
    jsonb_build_object(
      'one', jsonb_build_object(
        'factionId', 'adepta-sororitas', 'factionLabel', 'Adepta Sororitas',
        'detachment', 'Hallowed Martyrs', 'disposition', 'Priority Assets',
        'primaryScore', 45, 'secondaryScore', 30, 'painted', true,
        'firstTurn', 'first', 'battleRole', 'attacker',
        'mvpUnits', jsonb_build_array('Castigator'),
        'underwhelmingUnits', jsonb_build_array()),
      'two', jsonb_build_object(
        'factionId', 'adepta-sororitas', 'factionLabel', 'Adepta Sororitas',
        'detachment', 'Army of Faith', 'disposition', 'Take and Hold')));

  assert pg_temp.armies('booking', v_book) = 2,
    'expected two armies, got ' || pg_temp.armies('booking', v_book);
  a := pg_temp.army('booking', v_book, 'one');
  -- Legacy's rule: primary + secondary + 10 when painted.
  assert a.total_vp = 85, 'total VP came out as ' || coalesce(a.total_vp::text, 'null');
  assert a.catalogue_version = 'v1', 'the row did not pin the version';
  assert a.mvp_units = array['Castigator'], 'the MVP unit did not land';
  raise notice 'PASS record: two armies, the total computed, the version pinned';

  -- The free-text column keeps being written, so every existing reader works.
  assert pg_temp.booking_army(v_book) = 'Adepta Sororitas · Hallowed Martyrs',
    'booked_by_army reads ' || pg_temp.booking_army(v_book);
  raise notice 'PASS compat: booked_by_army still says faction and detachment';

  -- -------------------------------------------------------------- the refusals
  begin
    perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
      jsonb_build_object('one', jsonb_build_object('factionId', 'space-marines')));
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%RESULT_BAD_FACTION%', 'wrong error: ' || sqlerrm;
      raise notice 'PASS refuse: a faction not in the pinned version';
  end;

  begin
    perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
      jsonb_build_object('one', jsonb_build_object(
        'factionId', 'adepta-sororitas', 'detachment', 'Not A Detachment')));
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%RESULT_BAD_DETACHMENT%', 'wrong error: ' || sqlerrm;
      raise notice 'PASS refuse: a detachment that is not this faction''s';
  end;

  -- The one the pickers make unofferable, refused here too because the anon
  -- key is public: Take and Hold belongs to Army of Faith, not to Hallowed
  -- Martyrs, and both the faction and the detachment are right.
  begin
    perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
      jsonb_build_object('one', jsonb_build_object(
        'factionId', 'adepta-sororitas', 'detachment', 'Hallowed Martyrs',
        'disposition', 'Take and Hold')));
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%RESULT_BAD_DISPOSITION%', 'wrong error: ' || sqlerrm;
      raise notice 'PASS refuse: a disposition belonging to another detachment';
  end;

  begin
    perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
      jsonb_build_object('one', jsonb_build_object(
        'factionId', 'adepta-sororitas', 'primaryScore', 60)));
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%RESULT_VP_RANGE%' or sqlerrm like '%game_result_armies_primary%',
        'wrong error for a primary over 50: ' || sqlerrm;
      raise notice 'PASS refuse: a primary score over fifty';
  end;

  -- ---------------------------------------------------- only one score filled
  perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
    jsonb_build_object('one', jsonb_build_object(
      'factionId', 'adepta-sororitas', 'primaryScore', 45)));
  a := pg_temp.army('booking', v_book, 'one');
  assert a.total_vp is null, 'the total guessed at a missing secondary';
  raise notice 'PASS partial: one score alone leaves the total blank';

  -- ------------------------------------------------------- nothing said, none
  perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
    jsonb_build_object('one', '{}'::jsonb));
  assert pg_temp.army('booking', v_book, 'one') is null,
    'an empty army left a row behind';
  raise notice 'PASS empty: nothing said leaves no row to count';

  -- ------------------------------------------- a label instead of an id
  -- A league table stores a typed faction name, so the same writer has to take
  -- one. What it stores is the catalogue's own spelling either way, or the
  -- rollups would count two factions where there is one.
  perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
    jsonb_build_object('one', jsonb_build_object(
      'factionId', 'ADEPTA SORORITAS', 'detachment', 'hallowed-martyrs')));
  a := pg_temp.army('booking', v_book, 'one');
  assert a.faction_id = 'adepta-sororitas', 'a label did not resolve: ' || a.faction_id;
  assert a.faction_label = 'Adepta Sororitas', 'wrong label: ' || a.faction_label;
  assert a.detachment = 'Hallowed Martyrs',
    'a detachment id was stored rather than its name: ' || a.detachment;
  raise notice 'PASS naming: a faction by name or by id is stored one way';

  -- ------------------------------------------- a table taken off an LFG post
  perform pg_temp.accept(v_book, w.owner);
  perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
    jsonb_build_object('two', jsonb_build_object('factionId', 'adepta-sororitas')));
  a := pg_temp.army('booking', v_book, 'two');
  assert a.profile_id = w.owner,
    'the game was filed under nobody rather than whoever accepted it';
  assert a.player_name = 'Owner Eight', 'wrong name: ' || a.player_name;
  raise notice 'PASS seat: whoever took the table is who the game is filed under';

  -- ------------------------------------------------------ clearing takes them
  perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
    jsonb_build_object('one', jsonb_build_object(
      'factionId', 'adepta-sororitas', 'factionLabel', 'Adepta Sororitas')));
  assert pg_temp.armies('booking', v_book) >= 1, 'nothing to clear';
  perform public.clear_booking_result(v_book);
  assert pg_temp.armies('booking', v_book) = 0,
    'clearing the result left its armies behind';
  raise notice 'PASS clear: unrecording a game unrecords what was played';

  -- ------------------------------------------------------ a club with it off
  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, false, null);
  perform pg_temp.be(w.member);
  begin
    perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
      jsonb_build_object('one', jsonb_build_object('factionId', 'adepta-sororitas')));
    -- No pinned version, so nothing to validate against and nothing refused:
    -- the row records what was typed and the tracker can say it was unpinned.
    raise notice 'PASS off: a club with the builder off still records a result';
  exception
    when others then raise exception 'a club with it off could not record: %', sqlerrm;
  end;

  raise notice 'ALL PASS · stage 8 result armies';
end $$;

rollback;
