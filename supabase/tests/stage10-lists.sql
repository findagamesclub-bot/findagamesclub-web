-- 0143/0144 · pricing, signing and saving an army list.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- As postgres, because the select policies hide another club's lists and a
-- count from an ordinary session cannot tell a missing row from a hidden one.
create or replace function pg_temp.versions(p_list bigint)
returns setof public.army_list_versions language sql security definer as $fn$
  select * from public.army_list_versions where list_id = p_list order by version_number $fn$;

-- The tier the seed's members hold, carrying the benefit stage 10 added. A
-- tier row with no benefit at all is the ARMY_TIER case, exercised below.
insert into public.club_membership_tiers (club_id, tier_key, label, benefits, is_basic)
  select id, 'basic', 'Basic Membership', '{"armyBuilderAccess": true}'::jsonb, true from c;

-- Flipping a benefit needs the table, which authenticated cannot write.
create or replace function pg_temp.allow_tier(p_club bigint, p_allow boolean)
returns void language sql security definer as $fn$
  update public.club_membership_tiers
     set benefits = jsonb_build_object('armyBuilderAccess', p_allow)
   where club_id = p_club and tier_key = 'basic' $fn$;

set local role authenticated;

do $$
declare
  w record; v_club bigint; v_priced jsonb; v_out jsonb;
  v_list bigint; v_bad boolean;
  v_units jsonb; v_draft jsonb;
begin
  select * into w from who;
  select id into v_club from c;

  -- ------------------------------------------------------------- catalogue
  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['2000', '1000'], 'warhammer-40k-11th', '11th', 'v1');
  perform public.save_army_faction('warhammer-40k-11th', 'adeptus-custodes',
    'Adeptus Custodes', 0);
  perform public.save_army_detachment('warhammer-40k-11th', 'adeptus-custodes',
    'shield-host', 'Shield Host', array['Auric Champions', 'Lions of the Emperor'], 0);
  -- Castigator: copies 1 and 2 at 165, copy 3 and up at 175.
  perform public.save_army_unit('warhammer-40k-11th', 'adeptus-custodes',
    'Castigator', 165,
    '[{"label":"Default","modelCount":1,"points":"165"},
      {"label":"Twin autocannon","modelCount":1,"points":"165"}]'::jsonb,
    '[{"fromCopy":3,"toCopy":null,
       "options":[{"label":"Default","modelCount":1,"points":"175"},
                  {"label":"Twin autocannon","modelCount":1,"points":"175"}]}]'::jsonb, 0);
  perform public.save_army_unit('warhammer-40k-11th', 'adeptus-custodes',
    'Custodian Guard', 160,
    '[{"label":"Default","modelCount":4,"points":"160"}]'::jsonb, '[]'::jsonb, 1);
  perform public.publish_army_catalogue('warhammer-40k-11th', '');

  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');

  -- ---------------------------------------------- pricing, copies per NAME
  v_priced := public.price_army_list('warhammer-40k-11th', 'v1',
    'adeptus-custodes', '[{"unitName":"Castigator","quantity":3}]'::jsonb);
  if (v_priced ->> 'total')::int <> 505 then
    raise exception 'one line of three should be 505, got %', v_priced ->> 'total';
  end if;

  -- The bug this whole rule exists to stop: splitting a line must not be a way
  -- to pay less.
  v_priced := public.price_army_list('warhammer-40k-11th', 'v1', 'adeptus-custodes',
    '[{"unitName":"Castigator","quantity":2},{"unitName":"Castigator","quantity":1}]'::jsonb);
  if (v_priced ->> 'total')::int <> 505 then
    raise exception 'two lines of the same unit should be 505, got %', v_priced ->> 'total';
  end if;
  if jsonb_array_length(v_priced -> 'lines') <> 1 then
    raise exception 'same unit and option should merge to one line';
  end if;
  if (v_priced -> 'lines' -> 0 ->> 'quantity')::int <> 3 then
    raise exception 'merged line should carry three';
  end if;
  -- Copies no longer agree, so there is no per-unit price to print.
  if (v_priced -> 'lines' -> 0 ->> 'unitPoints')::int <> 0 then
    raise exception 'a line whose copies differ has no unit price';
  end if;

  -- Different options are different lines and still share one escalation.
  v_priced := public.price_army_list('warhammer-40k-11th', 'v1', 'adeptus-custodes',
    '[{"unitName":"Castigator","optionLabel":"Default","quantity":2},
      {"unitName":"Castigator","optionLabel":"Twin autocannon","quantity":1}]'::jsonb);
  if (v_priced ->> 'total')::int <> 505 then
    raise exception 'two options of one unit should still escalate, got %',
      v_priced ->> 'total';
  end if;
  if jsonb_array_length(v_priced -> 'lines') <> 2 then
    raise exception 'two options are two lines';
  end if;

  -- Dropped in silence, and named so a screen can say what went.
  v_priced := public.price_army_list('warhammer-40k-11th', 'v1', 'adeptus-custodes',
    '[{"unitName":"Not A Unit","quantity":2},
      {"unitName":"Custodian Guard","quantity":0},
      {"unitName":"Custodian Guard","quantity":1}]'::jsonb);
  if (v_priced ->> 'total')::int <> 160 then
    raise exception 'unknown units and zero quantities should not price';
  end if;
  if not (v_priced -> 'dropped') ? 'Not A Unit' then
    raise exception 'a dropped unit should be named';
  end if;

  -- Sorted by name then option, not by the order typed.
  v_priced := public.price_army_list('warhammer-40k-11th', 'v1', 'adeptus-custodes',
    '[{"unitName":"Custodian Guard","quantity":1},{"unitName":"Castigator","quantity":1}]'::jsonb);
  if v_priced -> 'lines' -> 0 ->> 'unitName' <> 'Castigator' then
    raise exception 'lines should be sorted, got %', v_priced -> 'lines' -> 0 ->> 'unitName';
  end if;
  if (v_priced -> 'lines' -> 0 ->> 'optionModelCount')::int <> 1 then
    raise exception 'the model count should ride along from the option';
  end if;

  -- A faction named rather than keyed, the same leniency the result writer needs.
  v_priced := public.price_army_list('warhammer-40k-11th', 'v1', 'Adeptus Custodes',
    '[{"unitName":"Castigator","quantity":1}]'::jsonb);
  if v_priced ->> 'factionId' <> 'adeptus-custodes' then
    raise exception 'a faction should resolve by label as well as by id';
  end if;

  -- --------------------------------------------------------- the signature
  -- Pinned against the exact string src/utils/army-signature.ts pins, because
  -- two readings of one rule that are never compared are two readings that
  -- will drift.
  if public.army_list_canonical('{
      "editionId":"warhammer-40k-11th","catalogueVersion":"11th-test-2026-07-27",
      "listType":"army-list","systemId":"warhammer-40k","pointsLimit":"2000",
      "factionId":"adeptus-custodes",
      "detachmentSelections":[{"detachment":"Shield Host","disposition":"Auric Champions"}],
      "units":[{"unitName":"Castigator","optionLabel":"Default","quantity":3}]}'::jsonb)
    <> '{"catalogueVersion":"11th-test-2026-07-27","detachmentSelections":'
       || '[{"detachment":"shield host","disposition":"auric champions"}],'
       || '"editionId":"warhammer-40k-11th","factionId":"adeptus-custodes",'
       || '"listType":"army-list","pointsLimit":"2000","systemId":"warhammer-40k",'
       || '"units":[{"optionLabel":"default","quantity":3,"unitName":"castigator"}]}'
  then
    raise exception 'the canonical string has drifted from the TypeScript one: %',
      public.army_list_canonical('{"editionId":"warhammer-40k-11th"}'::jsonb);
  end if;

  -- ------------------------------------------------------------- the saves
  v_units := '[{"unitName":"Castigator","optionLabel":"Default","quantity":3}]'::jsonb;
  v_draft := jsonb_build_object(
    'name', 'League list', 'listType', 'army-list', 'pointsLimit', '2000',
    'factionId', 'adeptus-custodes',
    'detachments', '[{"detachment":"Shield Host","disposition":"Auric Champions"}]'::jsonb,
    'units', v_units);

  perform pg_temp.be(w.member);
  v_out := public.save_army_list(null, v_club, v_draft, '');
  v_list := (v_out ->> 'listId')::bigint;
  if not (v_out ->> 'createdVersion')::boolean or (v_out ->> 'versionNumber')::int <> 1 then
    raise exception 'a new list should be v1';
  end if;
  if (v_out ->> 'totalPoints')::int <> 505 then
    raise exception 'the save should price it, got %', v_out ->> 'totalPoints';
  end if;
  if (select change_summary from pg_temp.versions(v_list) limit 1) <> 'Initial version' then
    raise exception 'the first version says Initial version';
  end if;

  -- Saving the same army again changes nothing, so there is nothing to version.
  v_out := public.save_army_list(v_list, v_club, v_draft, 'Should not be used');
  if (v_out ->> 'createdVersion')::boolean then
    raise exception 'an unchanged save must not make a version';
  end if;

  -- A rename is not a new version of the army.
  v_out := public.save_army_list(v_list, v_club,
    v_draft || '{"name":"Autumn league list"}'::jsonb, '');
  if (v_out ->> 'createdVersion')::boolean then
    raise exception 'renaming must not make a version';
  end if;
  if (select count(*) from pg_temp.versions(v_list)) <> 1 then
    raise exception 'two no-op saves should leave one version';
  end if;
  -- But the current version carries the new name, so restoring it restores it.
  if (select name from pg_temp.versions(v_list) limit 1) <> 'Autumn league list' then
    raise exception 'the current version should carry the new name';
  end if;

  -- A quantity change is.
  v_out := public.save_army_list(v_list, v_club,
    v_draft || jsonb_build_object('name', 'Autumn league list', 'units',
      '[{"unitName":"Castigator","optionLabel":"Default","quantity":2}]'::jsonb),
    'Adjusted Castigator');
  if not (v_out ->> 'createdVersion')::boolean or (v_out ->> 'versionNumber')::int <> 2 then
    raise exception 'a quantity change should be v2';
  end if;
  if (select change_summary from pg_temp.versions(v_list)
       where version_number = 2) <> 'Adjusted Castigator' then
    raise exception 'the summary the caller wrote should be stored';
  end if;

  -- ----------------------------------------------------------- the refusals
  begin
    perform public.save_army_list(v_list, v_club,
      v_draft || jsonb_build_object('units',
        '[{"unitName":"Castigator","quantity":13}]'::jsonb), '');
    raise exception 'a list over its limit should be refused';
  exception when others then
    if sqlerrm <> 'ARMY_OVER_LIMIT' then raise; end if;
  end;

  begin
    perform public.save_army_list(null, v_club, v_draft || '{"name":"  "}'::jsonb, '');
    raise exception 'a nameless list should be refused';
  exception when others then
    if sqlerrm <> 'ARMY_NAME' then raise; end if;
  end;

  begin
    perform public.save_army_list(null, v_club,
      v_draft || '{"pointsLimit":"1750"}'::jsonb, '');
    raise exception 'a points value the catalogue does not offer should be refused';
  exception when others then
    if sqlerrm <> 'ARMY_BAD_POINTS' then raise; end if;
  end;

  begin
    perform public.save_army_list(null, v_club,
      v_draft || '{"detachments":[]}'::jsonb, '');
    raise exception 'an army list with no detachment should be refused';
  exception when others then
    if sqlerrm <> 'ARMY_NO_DETACHMENT' then raise; end if;
  end;

  begin
    perform public.save_army_list(null, v_club,
      v_draft || '{"units":[{"unitName":"Not A Unit","quantity":2}]}'::jsonb, '');
    raise exception 'a list of nothing the catalogue has should be refused';
  exception when others then
    if sqlerrm <> 'ARMY_NO_UNITS' then raise; end if;
  end;

  -- A collection has no limit and no detachment, so neither can refuse it.
  v_out := public.save_army_list(null, v_club, v_draft || jsonb_build_object(
    'name', 'The shelf', 'listType', 'collection', 'pointsLimit', '',
    'detachments', '[]'::jsonb,
    'units', '[{"unitName":"Castigator","quantity":13}]'::jsonb), '');
  if not (v_out ->> 'createdVersion')::boolean then
    raise exception 'a collection should save';
  end if;

  -- ------------------------------------------------------- somebody else's
  perform pg_temp.be(w.owner);
  begin
    perform public.save_army_list(v_list, v_club, v_draft, '');
    raise exception 'an owner must not be able to write a members list';
  exception when others then
    if sqlerrm <> 'ARMY_NOT_YOURS' then raise; end if;
  end;
  -- But they can read it, which is what scouting a clubmate is.
  if not exists (select 1 from public.army_lists where id = v_list) then
    raise exception 'a clubmate should be able to read the list';
  end if;

  -- ---------------------------------------------------------- the ladder
  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, false, 'warhammer-40k-11th');
  perform pg_temp.be(w.member);
  begin
    perform public.save_army_list(null, v_club, v_draft, '');
    raise exception 'a club with the builder off should refuse';
  exception when others then
    if sqlerrm <> 'ARMY_NOT_ENABLED' then raise; end if;
  end;
  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');

  -- A tier that does not carry the benefit is the rung below.
  perform pg_temp.allow_tier(v_club, false);
  perform pg_temp.be(w.member);
  begin
    perform public.save_army_list(null, v_club, v_draft, '');
    raise exception 'a tier without the benefit should refuse';
  exception when others then
    if sqlerrm <> 'ARMY_TIER' then raise; end if;
  end;
  -- But the club's own team passes rung three and is never asked about a tier.
  perform pg_temp.be(w.owner);
  v_out := public.save_army_list(null, v_club,
    v_draft || '{"name":"The owners own list"}'::jsonb, '');
  if not (v_out ->> 'createdVersion')::boolean then
    raise exception 'a manager should pass the ladder without a tier';
  end if;
  perform pg_temp.allow_tier(v_club, true);

  -- ------------------------------------------------------------- deleting
  perform pg_temp.be(w.member);
  perform public.delete_army_list(v_list);
  if exists (select 1 from public.army_lists where id = v_list) then
    raise exception 'a deleted list should be hidden by its own policy';
  end if;
  -- Soft, so the version a result names still exists.
  if not exists (select 1 from pg_temp.versions(v_list)) then
    raise exception 'deleting must not take the versions with it';
  end if;

  raise notice 'stage10-lists: all pass';
end $$;
