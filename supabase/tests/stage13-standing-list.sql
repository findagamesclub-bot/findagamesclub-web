-- 0194 · a league table row names one of the member's own army lists.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Fixtures are written as postgres: `authenticated` has no grant on
-- `army_lists` or `army_list_versions`, because everything that writes them is
-- a definer function. A test that cannot seed a row is not a test about what
-- the row proves.
create or replace function pg_temp.seed_list(
  p_club bigint, p_profile uuid, p_name text, p_faction text,
  p_detachment text, p_disposition text
) returns bigint language plpgsql security definer as $fn$
declare v_list bigint; v_version bigint;
begin
  insert into public.army_lists
    (club_id, profile_id, name, system_id, edition_id, faction_id,
     faction_label, points_limit)
  values (p_club, p_profile, p_name, 'warhammer-40k', 'warhammer-40k-11th',
          lower(p_faction), p_faction, '2000')
  returning id into v_list;

  insert into public.army_list_versions
    (list_id, version_number, name, faction_id, faction_label,
     detachment_selections, units, points_limit, total_points,
     edition_id, catalogue_version)
  values (v_list, 1, p_name, lower(p_faction), p_faction,
          jsonb_build_array(jsonb_build_object(
            'detachment', p_detachment, 'disposition', p_disposition)),
          '[{"unitName":"Castigator","quantity":1,"linePoints":165}]'::jsonb,
          '2000', 165, 'warhammer-40k-11th', 'v1')
  returning id into v_version;

  update public.army_lists set current_version_id = v_version where id = v_list;
  return v_list;
end $fn$;

-- The second club and the competition are fixtures too, so they are written
-- as postgres for the same reason the lists are.
create or replace function pg_temp.seed_club() returns bigint
language sql security definer as $fn$
  insert into public.clubs (name, slug, city, status)
  values ('Other Club', 'other-club-0194', 'Oxford', 'active')
  returning id $fn$;

create or replace function pg_temp.seed_comp(p_club bigint) returns bigint
language sql security definer as $fn$
  insert into public.club_competitions (club_id, title, status)
  values (p_club, 'Autumn Ladder', 'running') returning id $fn$;

create or replace function pg_temp.army_of(p_standing bigint)
returns public.game_result_armies language sql security definer as $fn$
  select * from public.game_result_armies
   where source_type = 'competition' and source_id = p_standing $fn$;

create or replace function pg_temp.standing_id(p_name text) returns bigint
language sql security definer as $fn$
  select id from public.club_competition_standings where member_name = p_name $fn$;

set local role authenticated;

do $$
declare
  w record; v_club bigint; v_other bigint; v_comp bigint;
  v_mine bigint; v_theirs bigint; v_elsewhere bigint;
  v_standing bigint; a public.game_result_armies; n int;
begin
  select * into w from who;
  select id into v_club from c;

  -- A second club, so "a list from somewhere else" is a real row rather than
  -- an id nobody owns.
  v_other := pg_temp.seed_club();
  v_comp := pg_temp.seed_comp(v_club);

  v_mine := pg_temp.seed_list(v_club, w.member, 'My Sororitas shelf',
    'Adepta Sororitas', 'Hallowed Martyrs', 'Priority Assets');
  v_theirs := pg_temp.seed_list(v_club, w.stranger, 'Not yours', 'Orks',
    'Green Tide', 'Take and Hold');
  v_elsewhere := pg_temp.seed_list(v_other, w.member, 'Built elsewhere',
    'Aeldari', 'Battle Host', 'Disruption');

  perform pg_temp.be(w.owner);

  -- 1 · A list named beside a typed faction. The faction the club typed wins,
  --     because the list fills a gap rather than overruling somebody.
  insert into public.club_competition_standings
    (competition_id, rank, member_name, profile_id, played, wins, draws,
     losses, points, record_label, faction, detachment, disposition,
     army_list_id)
  values (v_comp, 1, 'The Member', w.member, 3, 2, 1, 0, 7, '2-1-0',
          'Adeptus Custodes', 'Shield Host', 'Purge the Foe', v_mine);

  v_standing := pg_temp.standing_id('The Member');
  a := pg_temp.army_of(v_standing);

  if a.list_id is distinct from v_mine then
    raise exception 'FAIL 1: the army row reads list % rather than %',
      a.list_id, v_mine;
  end if;
  if a.list_name <> 'My Sororitas shelf' or a.list_version_number <> 1 then
    raise exception 'FAIL 2: the list reads % v%', a.list_name, a.list_version_number;
  end if;
  if a.snapshot -> 'totalPoints' is null
     or jsonb_array_length(a.snapshot -> 'units') <> 1 then
    raise exception 'FAIL 3: the frozen snapshot reads %', a.snapshot::text;
  end if;
  -- THE TYPED FACTION SURVIVES. A list that overruled it would read
  -- "Adepta Sororitas" here.
  if a.faction_label <> 'Adeptus Custodes' or a.detachment <> 'Shield Host' then
    raise exception 'FAIL 4: naming a list overruled the typed faction: % / %',
      a.faction_label, a.detachment;
  end if;
  raise notice 'PASS named: the list lands and the typed faction is kept';

  -- 5 · A row naming ONLY a list. This is the ordering assertion: resolving
  --     the list after `put_result_army` would have deleted the empty army row
  --     and left the list with nothing to attach to.
  insert into public.club_competition_standings
    (competition_id, rank, member_name, profile_id, played, wins, draws,
     losses, points, record_label, faction, detachment, disposition,
     army_list_id)
  values (v_comp, 2, 'List Only', w.member, 1, 1, 0, 0, 3, '1-0-0',
          '', '', '', v_mine);

  a := pg_temp.army_of(pg_temp.standing_id('List Only'));
  if a.id is null then
    raise exception 'FAIL 5: naming a list with no faction left no army row at all';
  end if;
  if a.faction_label <> 'Adepta Sororitas' then
    raise exception 'FAIL 6: the faction did not come from the list, it reads %',
      a.faction_label;
  end if;
  if a.detachment <> 'Hallowed Martyrs' or a.disposition <> 'Priority Assets' then
    raise exception 'FAIL 7: the detachment and disposition read % / %',
      a.detachment, a.disposition;
  end if;
  raise notice 'PASS filled: a list on its own fills the faction it was built with';

  -- 8 · Somebody else's list is refused by name.
  begin
    insert into public.club_competition_standings
      (competition_id, rank, member_name, profile_id, played, wins, draws,
       losses, points, record_label, faction, detachment, disposition,
       army_list_id)
    values (v_comp, 3, 'Thief', w.member, 0, 0, 0, 0, 0, '0-0-0',
            'Orks', '', '', v_theirs);
    raise exception 'NOT_REACHED';
  exception
    when others then
      if sqlerrm not like 'ARMY_NOT_THEIRS for %' then
        raise exception 'FAIL 8: wrong error for somebody else''s list: %', sqlerrm;
      end if;
  end;

  -- 9 · A list built at another club is refused too.
  begin
    insert into public.club_competition_standings
      (competition_id, rank, member_name, profile_id, played, wins, draws,
       losses, points, record_label, faction, detachment, disposition,
       army_list_id)
    values (v_comp, 4, 'Wrong Club', w.member, 0, 0, 0, 0, 0, '0-0-0',
            'Aeldari', '', '', v_elsewhere);
    raise exception 'NOT_REACHED';
  exception
    when others then
      if sqlerrm not like 'ARMY_WRONG_CLUB for %' then
        raise exception 'FAIL 9: wrong error for another club''s list: %', sqlerrm;
      end if;
  end;

  -- 10 · A free-text name has no account, so it has no list to name either.
  begin
    insert into public.club_competition_standings
      (competition_id, rank, member_name, profile_id, played, wins, draws,
       losses, points, record_label, faction, detachment, disposition,
       army_list_id)
    values (v_comp, 5, 'Somebody At The Door', null, 0, 0, 0, 0, 0, '0-0-0',
            'Orks', '', '', v_mine);
    raise exception 'NOT_REACHED';
  exception
    when others then
      if sqlerrm not like 'ARMY_NOT_THEIRS for %' then
        raise exception 'FAIL 10: wrong error for an unlinked name: %', sqlerrm;
      end if;
  end;
  raise notice 'PASS refused: not theirs, not this club, and not a typed name';

  -- 11 · The read the screen uses.
  select count(*)::int into n
    from public.competition_standing_lists(array[v_comp]);
  if n <> 2 then
    raise exception 'FAIL 11: the lists read returned % rows, not 2', n;
  end if;

  -- 12 · Clearing the list empties the four columns and keeps the faction,
  --      because the club typed that and nobody asked for it to go.
  update public.club_competition_standings
     set army_list_id = null where id = v_standing;
  a := pg_temp.army_of(v_standing);
  if a.list_id is not null or a.list_name <> '' then
    raise exception 'FAIL 12: clearing the list left % / %', a.list_id, a.list_name;
  end if;
  if a.faction_label <> 'Adeptus Custodes' then
    raise exception 'FAIL 13: clearing the list took the faction with it';
  end if;
  raise notice 'PASS cleared: the link goes and the faction stays';

  -- 14 · And the row still goes when the standing does, which is 0136's own
  --      behaviour and has to survive this change.
  delete from public.club_competition_standings where id = v_standing;
  if (pg_temp.army_of(v_standing)).id is not null then
    raise exception 'FAIL 14: deleting a standing left its army row behind';
  end if;
  raise notice 'PASS delete: a removed row stops counting';

  perform set_config('request.jwt.claims', '', true);
end $$;

reset role;
\echo '0194 standing list: all pass'
