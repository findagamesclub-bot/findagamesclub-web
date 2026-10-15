-- 0192 · deleting a detachment, and giving a faction its dispositions.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Fixtures are read AND written as postgres. The suite runs as
-- `authenticated`, which has no grant on `game_result_armies` or the army list
-- tables by design, since everything that writes them is a definer function.
-- A test that cannot seed a row is not a test about what the row proves.
create or replace function pg_temp.det(p_slug text)
returns public.army_detachments language sql security definer as $fn$
  select * from public.army_detachments
   where edition_id = 'warhammer-40k-11th' and slug = p_slug $fn$;

create or replace function pg_temp.det_count() returns int
language sql security definer as $fn$
  select count(*)::int from public.army_detachments
   where edition_id = 'warhammer-40k-11th' $fn$;

create or replace function pg_temp.seed_result(p_club bigint) returns void
language sql security definer as $fn$
  insert into public.game_result_armies
    (source_type, source_id, side, club_id, played_on, player_name,
     faction_id, faction_label, detachment, disposition,
     edition_id, catalogue_version)
  values ('booking', 900192, 'one', p_club, current_date - 7, 'Somebody',
          'adepta-sororitas', 'Adepta Sororitas', 'Typo Lance', 'Disruption',
          'warhammer-40k-11th', 'v1') $fn$;

create or replace function pg_temp.seed_list(p_club bigint, p_profile uuid)
returns bigint language plpgsql security definer as $fn$
declare v_list bigint;
begin
  insert into public.army_lists
    (club_id, profile_id, name, system_id, edition_id, faction_id, faction_label)
  values (p_club, p_profile, 'Test list', 'warhammer-40k', 'warhammer-40k-11th',
          'adepta-sororitas', 'Adepta Sororitas')
  returning id into v_list;
  insert into public.army_list_versions
    (list_id, version_number, name, faction_id, detachment_selections,
     edition_id, catalogue_version)
  values (v_list, 1, 'Test list', 'adepta-sororitas',
          '[{"detachment":"typo lance","disposition":"Disruption"}]'::jsonb,
          'warhammer-40k-11th', 'v1');
  return v_list;
end $fn$;

create or replace function pg_temp.result_kept() returns boolean
language sql security definer as $fn$
  select exists (select 1 from public.game_result_armies
                  where source_id = 900192 and detachment = 'Typo Lance') $fn$;

create or replace function pg_temp.list_kept(p_list bigint) returns boolean
language sql security definer as $fn$
  select exists (select 1 from public.army_list_versions
                  where list_id = p_list
                    and detachment_selections::text like '%typo lance%') $fn$;

-- A raw delete as postgres, round the function and round the grants. This is
-- the only way to measure what 0138's trigger does, and the trigger is what
-- makes "a deletion forces a new version" true for any writer at all rather
-- than only for a screen.
create or replace function pg_temp.raw_delete(p_slug text) returns void
language plpgsql security definer as $fn$
begin
  delete from public.army_detachments
   where edition_id = 'warhammer-40k-11th' and slug = p_slug;
end $fn$;

create or replace function pg_temp.snapshot_dispositions() returns int
language sql security definer as $fn$
  select jsonb_array_length(
      s.catalogue -> 'systems' -> 0 -> 'factions' -> 0
        -> 'detachmentOptions' -> 0 -> 'dispositions')
    from public.army_catalogue_snapshots s
   where s.edition_id = 'warhammer-40k-11th' $fn$;

set local role authenticated;

do $$
declare
  w record; v_club bigint;
  d public.army_detachments; n int; u record; v_list bigint;
begin
  select * into w from who;
  select id into v_club from c;

  -- ------------------------------------------------------------- the draft
  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['1000','2000'], 'warhammer-40k-11th', '11th', 'v1');
  perform public.save_army_faction('warhammer-40k-11th', 'adepta-sororitas',
    'Adepta Sororitas', 0);
  perform public.save_army_faction('warhammer-40k-11th', 'adeptus-custodes',
    'Adeptus Custodes', 1);
  -- One disposition each, which is exactly what the imported catalogue holds
  -- and the whole of what the client reported on 22b.
  perform public.save_army_detachment('warhammer-40k-11th', 'adepta-sororitas',
    'hallowed-martyrs', 'Hallowed Martyrs', array['Priority Assets'], 0);
  perform public.save_army_detachment('warhammer-40k-11th', 'adepta-sororitas',
    'army-of-faith', 'Army of Faith', array['Take and Hold'], 1);
  perform public.save_army_detachment('warhammer-40k-11th', 'adepta-sororitas',
    'typo-lance', 'Typo Lance', array['Disruption'], 2);
  -- Another faction, so the bulk add can be proved not to reach past its own.
  perform public.save_army_detachment('warhammer-40k-11th', 'adeptus-custodes',
    'shield-host', 'Shield Host', array['Purge the Foe'], 0);

  -- 1 · The edition's own vocabulary, for seeding the bulk box.
  if public.army_edition_dispositions('warhammer-40k-11th')
     <> array['Disruption','Priority Assets','Purge the Foe','Take and Hold'] then
    raise exception 'FAIL 1: the edition reads its dispositions as %',
      public.army_edition_dispositions('warhammer-40k-11th')::text;
  end if;

  -- 2 · A member cannot delete a detachment, and cannot bulk-add either.
  perform pg_temp.be(w.member);
  begin
    perform public.delete_army_detachment('warhammer-40k-11th',
      (pg_temp.det('typo-lance')).id);
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'FAIL 2a: wrong error for a member: %', sqlerrm;
  end;
  begin
    perform public.add_faction_dispositions('warhammer-40k-11th',
      'adepta-sororitas', array['Reconnaissance']);
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'FAIL 2b: wrong error for a member: %', sqlerrm;
  end;

  -- 3 · A member cannot reach the usage count either. It walks every club's
  --     lists and results, which is not a member's question about anything.
  begin
    perform public.army_detachment_usage('warhammer-40k-11th',
      (pg_temp.det('typo-lance')).id);
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then null;
    when others then raise exception 'FAIL 3: wrong error for a member: %', sqlerrm;
  end;
  raise notice 'PASS gate: a member is refused all three';

  -- ---------------------------------------------------------- the bulk add
  perform pg_temp.be(w.admin);

  -- 4 · An empty list is refused rather than saving nothing quietly.
  begin
    perform public.add_faction_dispositions('warhammer-40k-11th',
      'adepta-sororitas', array['', '   ']);
    raise exception 'NOT_REACHED';
  exception
    when others then
      if sqlerrm not like '%DISPOSITIONS_NEEDED%' then
        raise exception 'FAIL 4: wrong error for an empty list: %', sqlerrm;
      end if;
  end;

  -- 5 · It adds without removing, and says how many it touched. Hallowed
  --     Martyrs already names Priority Assets, so it gains three of the four.
  n := public.add_faction_dispositions('warhammer-40k-11th', 'adepta-sororitas',
    array['Take and Hold','Purge the Foe','Priority Assets','Reconnaissance']);
  if n <> 3 then
    raise exception 'FAIL 5: the bulk add touched % detachments, not 3', n;
  end if;

  d := pg_temp.det('hallowed-martyrs');
  if cardinality(d.dispositions) <> 4 then
    raise exception 'FAIL 6: Hallowed Martyrs holds % dispositions, not 4: %',
      cardinality(d.dispositions), d.dispositions::text;
  end if;
  -- 7 · And one the bulk list does NOT name survives. Typo Lance holds
  --     Disruption, which is not in the four going on, so a version that
  --     replaced rather than added loses it and reads 4 instead of 5. The
  --     first draft of this assertion checked Hallowed Martyrs' own
  --     disposition instead, and a replace passed it: `array_agg(distinct)`
  --     sorts, and Priority Assets happened to come back first either way.
  d := pg_temp.det('typo-lance');
  if cardinality(d.dispositions) <> 5
     or not ('Disruption' = any (d.dispositions)) then
    raise exception 'FAIL 7: the bulk add rewrote what was already named: %',
      d.dispositions::text;
  end if;

  -- 8 · And it did not reach into the other faction.
  d := pg_temp.det('shield-host');
  if cardinality(d.dispositions) <> 1 then
    raise exception 'FAIL 8: a faction-wide add reached another faction: %',
      d.dispositions::text;
  end if;

  -- 9 · Running it again changes nothing, including on case.
  n := public.add_faction_dispositions('warhammer-40k-11th', 'adepta-sororitas',
    array['take and hold','PRIORITY ASSETS','Reconnaissance']);
  if n <> 0 then
    raise exception 'FAIL 9: a second run touched % detachments', n;
  end if;
  d := pg_temp.det('hallowed-martyrs');
  if cardinality(d.dispositions) <> 4 then
    raise exception 'FAIL 10: a second run doubled a disposition: %',
      d.dispositions::text;
  end if;
  raise notice 'PASS bulk: a faction gains dispositions, keeps its own, twice is once';

  -- 9b · 0193: a BLANK faction is every faction in the edition. Shield Host
  --      sits in the other faction and still holds its one, so this is the
  --      assertion that tells "all of them" apart from "none of them": a
  --      version that narrowed on the empty string would touch nothing and
  --      report 0, which reads as a quiet success.
  n := public.add_faction_dispositions('warhammer-40k-11th', '',
    array['Take and Hold','Purge the Foe','Priority Assets','Reconnaissance']);
  if n <> 1 then
    raise exception 'FAIL 9b: an edition-wide add touched % detachments, not 1', n;
  end if;
  d := pg_temp.det('shield-host');
  if cardinality(d.dispositions) <> 4
     or not ('Purge the Foe' = any (d.dispositions)) then
    raise exception 'FAIL 9c: the other faction reads % after an edition-wide add',
      d.dispositions::text;
  end if;
  -- And it did not disturb the faction that was already done.
  d := pg_temp.det('typo-lance');
  if cardinality(d.dispositions) <> 5 then
    raise exception 'FAIL 9d: an edition-wide add changed a settled faction: %',
      d.dispositions::text;
  end if;
  raise notice 'PASS edition: a blank faction reaches every detachment, once';

  -- -------------------------------------------------------- what names it
  -- A recorded game and an army list version, both naming Typo Lance by its
  -- label, because that is what they store: neither has a foreign key here.
  perform pg_temp.seed_result(v_club);
  v_list := pg_temp.seed_list(v_club, w.member);

  -- 11 · Both are counted, and the match is on the label folded, not the id.
  select * into u from public.army_detachment_usage('warhammer-40k-11th',
    (pg_temp.det('typo-lance')).id);
  if u.label <> 'Typo Lance' then
    raise exception 'FAIL 11: the usage read names it %', u.label;
  end if;
  if u.results <> 1 or u.lists <> 1 then
    raise exception 'FAIL 12: usage reads % results and % lists, not 1 and 1',
      u.results, u.lists;
  end if;

  -- 13 · A detachment nobody has played reads nought rather than failing.
  select * into u from public.army_detachment_usage('warhammer-40k-11th',
    (pg_temp.det('army-of-faith')).id);
  if u.results <> 0 or u.lists <> 0 then
    raise exception 'FAIL 13: an unplayed detachment reads % and %',
      u.results, u.lists;
  end if;

  -- 14 · A detachment that is not in this edition is said so by name.
  begin
    perform public.army_detachment_usage('warhammer-40k-11th', 0);
    raise exception 'NOT_REACHED';
  exception
    when others then
      if sqlerrm not like '%DETACHMENT_NOT_FOUND%' then
        raise exception 'FAIL 14: wrong error for a missing detachment: %', sqlerrm;
      end if;
  end;
  raise notice 'PASS usage: a game and a list are counted before anybody deletes';

  -- ------------------------------------------------------------ the delete
  n := pg_temp.det_count();
  perform public.delete_army_detachment('warhammer-40k-11th',
    (pg_temp.det('typo-lance')).id);
  if pg_temp.det_count() <> n - 1 then
    raise exception 'FAIL 15: the delete left % detachments, not %',
      pg_temp.det_count(), n - 1;
  end if;

  -- 16 · AND NOTHING RECORDED WENT WITH IT. This is the client's own sentence
  --      ("data is not lost") and the reason the counts above are a warning
  --      rather than a refusal.
  if not pg_temp.result_kept() then
    raise exception 'FAIL 16: deleting a detachment took a recorded game with it';
  end if;
  if not pg_temp.list_kept(v_list) then
    raise exception 'FAIL 17: deleting a detachment took an army list with it';
  end if;
  raise notice 'PASS delete: it goes from the draft and nothing recorded moves';

  -- --------------------------------------------------- and a published one
  perform public.publish_army_catalogue('warhammer-40k-11th', 'first cut');

  -- 18 · THE HALF THE CLIENT ASKED FOR. A delete on a published version is
  --      refused, so taking a detachment out means starting a new draft,
  --      which is what mints the version a result keeps pointing at.
  begin
    perform public.delete_army_detachment('warhammer-40k-11th',
      (pg_temp.det('army-of-faith')).id);
    raise exception 'NOT_REACHED';
  exception
    when others then
      if sqlerrm not like '%CATALOGUE_PUBLISHED%' then
        raise exception 'FAIL 18: wrong error on a published version: %', sqlerrm;
      end if;
  end;

  -- 18b · AND IT IS THE TABLE THAT REFUSES IT, not only the function. Written
  --       the other way round this assertion proved nothing: 0138's trigger
  --       raises the same `CATALOGUE_PUBLISHED`, so a delete with its own
  --       admin-only guard and no freeze check still passed 18. A raw delete
  --       as postgres is the only reading that tells the two apart.
  begin
    perform pg_temp.raw_delete('army-of-faith');
    raise exception 'NOT_REACHED';
  exception
    when others then
      if sqlerrm not like '%CATALOGUE_PUBLISHED%' then
        raise exception 'FAIL 18b: a raw delete on a published version said: %', sqlerrm;
      end if;
  end;

  -- 19 · The bulk add is refused on a published version for the same reason.
  begin
    perform public.add_faction_dispositions('warhammer-40k-11th',
      'adepta-sororitas', array['Reconnaissance']);
    raise exception 'NOT_REACHED';
  exception
    when others then
      if sqlerrm not like '%CATALOGUE_PUBLISHED%' then
        raise exception 'FAIL 19: wrong error on a published version: %', sqlerrm;
      end if;
  end;

  -- 20 · And the version that was published carries the four dispositions, so
  --      the result dialog reading that snapshot now has four to offer where
  --      it had one. That is 22b end to end.
  if pg_temp.snapshot_dispositions() <> 4 then
    raise exception 'FAIL 20: the published snapshot carries % dispositions, not 4',
      pg_temp.snapshot_dispositions();
  end if;
  raise notice 'PASS frozen: a published version refuses both, and holds the four';

  perform set_config('request.jwt.claims', '', true);
end $$;

reset role;
\echo '0192 detachments: all pass'
