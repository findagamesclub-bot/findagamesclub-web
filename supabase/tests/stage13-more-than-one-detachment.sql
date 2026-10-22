-- 0217 · a result brings more than one detachment, and one disposition.
--
-- The client's words: "we only allow one detachment to be selected, which is
-- incorrect. This should follow the same process as the army list builder,
-- where multiple detachments can be selected but only one disposition."
--
-- The assertion that matters is 3: the disposition is checked against what the
-- chosen detachments offer BETWEEN them. A union, so adding a second
-- detachment widens what the army may play; still a closed set, so a
-- disposition from a detachment nobody brought is refused.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Read as postgres. The army rows are behind RLS and a fixture the test
-- cannot see reads exactly like a fixture that was never written, which is a
-- trap these suites have paid for four times.
create or replace function pg_temp.army(p_source text, p_id bigint, p_side text)
returns public.game_result_armies language sql security definer as $fn$
  select * from public.game_result_armies
   where source_type = p_source and source_id = p_id and side = p_side $fn$;

create or replace function pg_temp.booking_army(p_id bigint) returns text
language sql security definer as $fn$
  select booked_by_army from public.club_bookings where id = p_id $fn$;

-- The seed books the next Thursday, because the insert guard refuses a past
-- date and a night that does not run. `meta_rows` then excludes it, since a
-- game nobody has played is not in the tracker. Backdated here rather than
-- seeded in the past, which is what `stage10-links.sql` already does.
create or replace function pg_temp.backdate(p_id bigint) returns void
language sql security definer as $fn$
  update public.game_result_armies set played_on = public.london_today() - 7
   where source_type = 'booking' and source_id = p_id $fn$;

set local role authenticated;

do $$
declare
  v_club bigint; w record; v_book bigint; v_event bigint; v_comp bigint;
  v_placing bigint; v_standing bigint; v_err text; v_n int;
  a public.game_result_armies; r record; v_label text;
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_book from bk;

  -- A catalogue whose two detachments offer DIFFERENT dispositions. That is
  -- the whole fixture: with the same list on both, a union and an
  -- intersection give the same answer and this suite would prove nothing.
  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['2000'], 'warhammer-40k-11th', '11th', 'v1');
  perform public.save_army_faction('warhammer-40k-11th', 'adepta-sororitas',
    'Adepta Sororitas', 0);
  perform public.save_army_detachment('warhammer-40k-11th', 'adepta-sororitas',
    'hallowed-martyrs', 'Hallowed Martyrs', array['Priority Assets'], 0);
  perform public.save_army_detachment('warhammer-40k-11th', 'adepta-sororitas',
    'army-of-faith', 'Army of Faith', array['Take and Hold'], 1);
  perform public.save_army_faction('warhammer-40k-11th', 'adeptus-custodes',
    'Adeptus Custodes', 1);
  perform public.save_army_detachment('warhammer-40k-11th', 'adeptus-custodes',
    'shield-host', 'Shield Host', array['Reconnaissance'], 0);
  perform public.publish_army_catalogue('warhammer-40k-11th', '');

  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');

  -- 1 ------------------------------------------- two detachments on a booking
  perform pg_temp.be(w.member);
  -- Wrapped, so a refusal here reports the round it died on rather than the
  -- guard's own code: a break test whose message names the guard says nothing
  -- about which assertion stopped being true.
  begin
    perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
      jsonb_build_object(
        'one', jsonb_build_object(
          'factionId', 'adepta-sororitas', 'factionLabel', 'Adepta Sororitas',
          'detachments', jsonb_build_array('Hallowed Martyrs', 'Army of Faith'),
          -- Offered by the SECOND one. Before this migration the picker could
          -- not have reached it and the database would have refused it.
          'disposition', 'Take and Hold',
          'primaryScore', 45, 'secondaryScore', 30, 'painted', true),
        'two', jsonb_build_object(
          'factionId', 'adeptus-custodes', 'factionLabel', 'Adeptus Custodes',
          'detachments', jsonb_build_array('Shield Host'),
          'disposition', 'Reconnaissance')),
      null);
  exception
    when others then
      get stacked diagnostics v_err = message_text;
      raise exception 'FAIL 0: two detachments and their union were refused (%)', v_err;
  end;

  a := pg_temp.army('booking', v_book, 'one');
  if a.detachments <> array['Hallowed Martyrs', 'Army of Faith'] then
    raise exception 'FAIL 1: the army recorded %, not both detachments',
      a.detachments;
  end if;
  if a.disposition <> 'Take and Hold' then
    raise exception 'FAIL 2: the second detachment''s disposition was lost (%)',
      a.disposition;
  end if;
  raise notice 'PASS 1: a result carries every detachment and one disposition';

  -- 2 ------------------------------------------------ the lead one is canonical
  -- Everything that came before this reads `detachment`: the three Meta
  -- Tracker rollups, the event breakdown, `result_army_label`, and every
  -- repository select. It holds the first of the list, so none of them had to
  -- learn anything.
  if a.detachment <> 'Hallowed Martyrs' then
    raise exception 'FAIL 3: the lead detachment is %, not the first', a.detachment;
  end if;
  raise notice 'PASS 2: the column every reader already had holds the first';

  -- 3 ------------------------------ the disposition is the union, not the whole faction
  begin
    perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
      jsonb_build_object('one', jsonb_build_object(
        'factionId', 'adepta-sororitas',
        'detachments', jsonb_build_array('Hallowed Martyrs'),
        -- Army of Faith's, and Army of Faith is not in this army any more.
        'disposition', 'Take and Hold')),
      null);
    raise exception 'FAIL 4: a disposition no chosen detachment offers was taken';
  exception
    when others then
      get stacked diagnostics v_err = message_text;
      if position('RESULT_BAD_DISPOSITION' in v_err) = 0 then
        raise exception 'FAIL 5: wrong refusal for a stray disposition: %', v_err;
      end if;
  end;
  raise notice 'PASS 3: a disposition from a detachment nobody brought is refused';

  -- 4 --------------------------------------------- a detachment that is not theirs
  begin
    perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
      jsonb_build_object('one', jsonb_build_object(
        'factionId', 'adepta-sororitas',
        -- The second belongs to another faction.
        'detachments', jsonb_build_array('Hallowed Martyrs', 'Shield Host'))),
      null);
    raise exception 'FAIL 6: a detachment from another faction was taken';
  exception
    when others then
      get stacked diagnostics v_err = message_text;
      if position('RESULT_BAD_DETACHMENT' in v_err) = 0 then
        raise exception 'FAIL 7: wrong refusal for a stray detachment: %', v_err;
      end if;
  end;
  raise notice 'PASS 4: a detachment the faction does not have is still refused';

  -- 5 --------------------------------------- the same one twice is one, folded
  perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
    jsonb_build_object('one', jsonb_build_object(
      'factionId', 'adepta-sororitas',
      -- Two spellings of one detachment. A caller that could widen an army by
      -- saying the same thing twice would widen the rollups with it.
      'detachments', jsonb_build_array('Hallowed Martyrs', 'hallowed-martyrs'),
      'disposition', 'Priority Assets')),
    null);
  a := pg_temp.army('booking', v_book, 'one');
  if a.detachments <> array['Hallowed Martyrs'] then
    raise exception 'FAIL 8: one detachment said twice came back as %', a.detachments;
  end if;
  raise notice 'PASS 5: the same detachment twice is one, in the catalogue''s spelling';

  -- 6 ------------------------------------------------ the label a booking keeps
  perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
    jsonb_build_object('one', jsonb_build_object(
      'factionId', 'adepta-sororitas', 'factionLabel', 'Adepta Sororitas',
      'detachments', jsonb_build_array('Hallowed Martyrs', 'Army of Faith'),
      'disposition', 'Take and Hold')),
    null);
  v_label := pg_temp.booking_army(v_book);
  if v_label <> 'Adepta Sororitas · Hallowed Martyrs, Army of Faith' then
    raise exception 'FAIL 9: the booking''s own line reads "%"', v_label;
  end if;
  raise notice 'PASS 6: several detachments read as "A, B" inside the dots';

  -- 7 ----------------------------------------- a caller that has not been updated
  -- Every screen posts `detachments` now. A tab left open across the deploy
  -- posts `detachment`, and a result is not worth refusing over that.
  begin
    perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '', '',
      jsonb_build_object('one', jsonb_build_object(
        'factionId', 'adepta-sororitas',
        'detachment', 'Army of Faith', 'disposition', 'Take and Hold')),
      null);
  exception
    when others then
      get stacked diagnostics v_err = message_text;
      raise exception 'FAIL 10: the single field was refused outright (%)', v_err;
  end;
  a := pg_temp.army('booking', v_book, 'one');
  if a.detachments <> array['Army of Faith'] or a.detachment <> 'Army of Faith' then
    raise exception 'FAIL 10: the single field did not land as a list of one (%, %)',
      a.detachments, a.detachment;
  end if;
  raise notice 'PASS 7: the one field the old shape posts still records an army';

  -- 8 --------------------------------------------- the tracker still counts it
  -- Nothing downstream was taught anything, which is the point of keeping the
  -- lead column. A rollup that had stopped counting would mean the migration
  -- had moved the fact rather than widened it.
  -- As the club, which is what settles a result: a submitted one is not in
  -- the tracker at all (0141), so counting it would be counting nothing.
  perform pg_temp.be(w.owner);
  perform public.record_booking_result(v_book, 85, 62, '', '', '', '', '',
    'admin-confirmed',
    jsonb_build_object(
      'one', jsonb_build_object(
        'factionId', 'adepta-sororitas',
        'detachments', jsonb_build_array('Hallowed Martyrs', 'Army of Faith'),
        'disposition', 'Take and Hold'),
      'two', jsonb_build_object(
        'factionId', 'adeptus-custodes',
        'detachments', jsonb_build_array('Shield Host'),
        'disposition', 'Reconnaissance')),
    null);
  perform pg_temp.backdate(v_book);
  select count(*) into v_n from public.meta_detachments(v_club)
   where detachment = 'Hallowed Martyrs';
  if v_n <> 1 then
    raise exception 'FAIL 11: the tracker found % rows for the lead detachment', v_n;
  end if;
  raise notice 'PASS 8: the Meta Tracker groups on the lead detachment as before';

  -- 9 ----------------------------------------------------------- a placing
  perform pg_temp.be(w.owner);
  insert into public.club_events (club_id, legacy_id, title, start_date, status)
  values (v_club, 'det-rtt', 'RTT', public.london_today() - 7, 'published')
  returning id into v_event;

  v_placing := public.save_event_placing(v_event, null, 1, 'Member Eight',
    w.member, 'Adepta Sororitas',
    array['Hallowed Martyrs', 'Army of Faith'], 'Take and Hold');

  a := pg_temp.army('event_podium', v_placing, 'one');
  if a.detachments <> array['Hallowed Martyrs', 'Army of Faith'] then
    raise exception 'FAIL 12: a placing recorded %', a.detachments;
  end if;

  -- And onto the placing's own jsonb, which is what the podium card reads.
  -- Both keys: `detachment` is still what an imported result carries and what
  -- every reader of that column already means.
  select r2.army into r from public.club_event_results r2 where r2.id = v_placing;
  if (r.army ->> 'detachment') <> 'Hallowed Martyrs' then
    raise exception 'FAIL 13: the placing jsonb lost its lead detachment: %', r.army;
  end if;
  if jsonb_array_length(r.army -> 'detachments') <> 2 then
    raise exception 'FAIL 14: the placing jsonb carries % detachments',
      jsonb_array_length(r.army -> 'detachments');
  end if;
  raise notice 'PASS 9: a podium carries both, in the row and in the jsonb';

  -- 10 ------------------------------------------------------ a league standing
  insert into public.club_competitions (club_id, title, type, status)
  values (v_club, 'Autumn Ladder', 'league', 'active') returning id into v_comp;

  begin
    insert into public.club_competition_standings
      (competition_id, rank, member_name, profile_id, played, wins, draws, losses,
       points, record_label, faction, detachments, disposition)
    values (v_comp, 1, 'Member Eight', w.member, 3, 2, 0, 1, 6, '2-0-1',
            'Adepta Sororitas', array['Hallowed Martyrs', 'Army of Faith'],
            'Take and Hold')
    returning id into v_standing;
  exception
    when others then
      get stacked diagnostics v_err = message_text;
      raise exception 'FAIL 15b: a league row with two detachments was refused (%)',
        v_err;
  end;

  a := pg_temp.army('competition', v_standing, 'one');
  if a.detachments <> array['Hallowed Martyrs', 'Army of Faith'] then
    raise exception 'FAIL 15: a standing mirrored %', a.detachments;
  end if;
  if a.disposition <> 'Take and Hold' then
    raise exception 'FAIL 16: a standing lost the union''s disposition';
  end if;
  raise notice 'PASS 10: a league row carries every detachment through the trigger';

  -- 11 ------------------------------------------- what the screens read back
  select count(*) into v_n
    from public.competition_standing_lists(array[v_comp]) l
   where l.standing_id = v_standing
     and l.detachments = array['Hallowed Martyrs', 'Army of Faith'];
  if v_n <> 1 then
    raise exception 'FAIL 17: the standings read did not carry the list';
  end if;

  select count(*) into v_n
    from public.result_armies_for('event_podium', array[v_placing]) x
   where x.detachments = array['Hallowed Martyrs', 'Army of Faith'];
  if v_n <> 1 then
    raise exception 'FAIL 18: the result armies read did not carry the list';
  end if;

  select count(*) into v_n
    from public.game_armies_for(array['booking'], array[v_book]) x
   where x.side = 'one'
     and x.detachments = array['Hallowed Martyrs', 'Army of Faith'];
  if v_n <> 1 then
    raise exception 'FAIL 19: the game armies read did not carry the list';
  end if;
  raise notice 'PASS 11: every read a screen uses hands back the whole list';

  raise notice 'ALL PASS · 0217 more than one detachment';
end $$;

rollback;
