-- 0136 and 0137 · a league table's armies, and asking several clubs at once.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Read as postgres. `game_result_armies_select` hides a club's rows from
-- anybody who is not in it, so counting from an ordinary session reads zero
-- whether the trigger wrote or not. Third time this suite has needed it.
create or replace function pg_temp.army(p_source text, p_id bigint)
returns public.game_result_armies language sql security definer as $fn$
  select * from public.game_result_armies
   where source_type = p_source and source_id = p_id and side = 'one' $fn$;

set local role authenticated;

do $$
declare
  v_club bigint; w record; v_comp bigint; v_one bigint; v_two bigint;
  a public.game_result_armies; b record; n int;
begin
  select * into w from who;
  select id into v_club from c;

  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['2000'], 'warhammer-40k-11th', '11th', 'v1');
  perform public.save_army_faction('warhammer-40k-11th', 'adepta-sororitas',
    'Adepta Sororitas', 0);
  perform public.save_army_detachment('warhammer-40k-11th', 'adepta-sororitas',
    'hallowed-martyrs', 'Hallowed Martyrs', array['Priority Assets'], 0);
  perform public.publish_army_catalogue('warhammer-40k-11th', '');

  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');

  insert into public.club_competitions (club_id, title, status)
  values (v_club, 'Winter League', 'active') returning id into v_comp;

  -- ------------------------------------------------- a row carries its army
  insert into public.club_competition_standings
    (competition_id, profile_id, member_name, rank, wins, faction, detachment,
     disposition)
  values (v_comp, w.member, 'Member Eight', 1, 3,
          'Adepta Sororitas', 'Hallowed Martyrs', 'Priority Assets')
  returning id into v_one;

  a := pg_temp.army('competition', v_one);
  assert a.id is not null, 'the standing wrote no army row';
  assert a.faction_id = 'adepta-sororitas', 'wrong faction: ' || coalesce(a.faction_id, 'null');
  assert a.disposition = 'Priority Assets', 'the disposition did not travel';
  assert a.club_id = v_club, 'the army landed at the wrong club';
  raise notice 'PASS standing: saving a table records what each player took';

  -- ------------------------------------------------------ editing follows it
  update public.club_competition_standings
     set detachment = '', disposition = '' where id = v_one;
  a := pg_temp.army('competition', v_one);
  assert a.detachment = '', 'the detachment was not cleared';
  raise notice 'PASS standing: correcting a row corrects what it counts';

  -- ------------------------------ the whole table is replaced on every save
  -- Which is the reason this is a trigger. The old row goes and a new one
  -- takes its place, and the armies have to follow rather than pile up.
  delete from public.club_competition_standings where competition_id = v_comp;
  assert pg_temp.army('competition', v_one) is null,
    'a removed standing left its army counting';

  insert into public.club_competition_standings
    (competition_id, profile_id, member_name, rank, wins, faction, detachment)
  values (v_comp, w.member, 'Member Eight', 1, 4,
          'Adepta Sororitas', 'Hallowed Martyrs')
  returning id into v_two;

  select count(*)::int into n from public.game_result_armies
   where source_type = 'competition';
  assert n = 1, 'rewriting the table left ' || n || ' armies behind';
  assert (pg_temp.army('competition', v_two)).id is not null,
    'the replacement row recorded nothing';
  raise notice 'PASS standing: rewriting a table moves its armies with it';

  -- ------------------------------ a refusal says whose row it is (0140)
  begin
    insert into public.club_competition_standings
      (competition_id, member_name, rank, faction)
    values (v_comp, 'Joe Matthews', 2, 'Custodes');
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like 'RESULT_BAD_FACTION%', 'the code is not at the front: ' || sqlerrm;
      assert sqlerrm like '%Joe Matthews%', 'the refusal did not name the row: ' || sqlerrm;
      raise notice 'PASS refusal: a bad army names the player it belongs to';
  end;

  -- ------------------------------------------------- an empty army, no row
  update public.club_competition_standings
     set faction = '', detachment = '' where id = v_two;
  assert pg_temp.army('competition', v_two) is null,
    'a row with no army filed a blank';
  raise notice 'PASS standing: a player with no army recorded is not counted';

  -- ------------------------------------------- several clubs in one question
  select * into b from public.army_builders_for(array[v_club]);
  assert b.enabled, 'the club that runs the builder came back off';
  assert b.edition_id = 'warhammer-40k-11th', 'wrong edition: ' || coalesce(b.edition_id, 'null');
  assert b.catalogue_version is not null, 'no version came back with the edition';

  select count(*)::int into n
    from public.army_builders_for(array[v_club, 999999::bigint]);
  assert n = 2, 'a club with no settings row went missing rather than reading off';
  raise notice 'PASS builders: one question answers for every club on the page';

  -- The edition and the version must belong to each other, and the version has
  -- to be one that was actually frozen. A club pinned to an edition nobody has
  -- published yet reads as off rather than pointing at a catalogue that is not
  -- there: `getBuilderFor` needs both halves before it draws an army field.
  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['2000'], 'warhammer-40k-12th', '12th', 'v9');

  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-12th');

  select * into b from public.army_builders_for(array[v_club]);
  assert b.edition_id = 'warhammer-40k-12th',
    'the club pinned an edition and got another: ' || coalesce(b.edition_id, 'null');
  assert b.catalogue_version is null,
    'an unpublished draft was handed out as a version: ' || coalesce(b.catalogue_version, 'null');
  raise notice 'PASS builders: an edition with nothing published reads as off';

  perform pg_temp.be(w.admin);
  perform public.publish_army_catalogue('warhammer-40k-12th', '');
  select * into b from public.army_builders_for(array[v_club]);
  assert b.catalogue_version = 'v9',
    'publishing did not reach the club: ' || coalesce(b.catalogue_version, 'null');
  assert b.catalogue_version = (select catalogue_version from public.army_editions
                                 where id = b.edition_id),
    'the edition and the version came from different rows';
  raise notice 'PASS builders: the edition and its version come from one row';

  raise notice 'ALL PASS · stage 8 standings armies';
end $$;

rollback;
