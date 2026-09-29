-- 0133 to 0136 · the catalogue and the structured result.
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

set local role authenticated;

do $$
declare v_club bigint; w record; n int; v_book bigint; a public.game_result_armies;
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_book from bk;

  -- ------------------------------------------------------- only an admin edits
  perform pg_temp.be(w.member);
  begin
    perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
      array['1000','2000'], 'warhammer-40k-11th', '11th', 'v1');
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then raise notice 'PASS gate: a member cannot make an edition';
    when others then raise exception 'wrong error for a member: %', sqlerrm;
  end;

  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['1000','1500','2000','3000'], 'warhammer-40k-11th', '11th', 'v1');
  perform public.save_army_faction('warhammer-40k-11th', 'adepta-sororitas',
    'Adepta Sororitas', 0);
  perform public.save_army_detachment('warhammer-40k-11th', 'adepta-sororitas',
    'hallowed-martyrs', 'Hallowed Martyrs', array['Priority Assets'], 0);
  perform public.save_army_detachment('warhammer-40k-11th', 'adepta-sororitas',
    'army-of-faith', 'Army of Faith', array['Take and Hold'], 1);
  perform public.save_army_unit('warhammer-40k-11th', 'adepta-sororitas',
    'Castigator', 165, '[{"label":"1 model","modelCount":1,"points":"165"}]'::jsonb,
    '[{"fromCopy":1,"toCopy":2,"options":[{"points":"165"}]},
      {"fromCopy":3,"toCopy":null,"options":[{"points":"175"}]}]'::jsonb, 0);
  raise notice 'PASS build: an admin makes an edition, a faction, detachments and a unit';

  -- A unit at nought points is a mistyped unit, not a free one.
  begin
    perform public.save_army_unit('warhammer-40k-11th', 'adepta-sororitas',
      'Free Thing', 0, '[]'::jsonb, '[]'::jsonb, 1);
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%UNIT_NEEDS_POINTS%', 'wrong error for nought points: ' || sqlerrm;
      raise notice 'PASS points: a unit at nought points is refused';
  end;

  -- ------------------------------------------------------------- publishing
  perform public.publish_army_catalogue('warhammer-40k-11th', 'first cut');
  assert public.army_version_published('warhammer-40k-11th'),
    'the version did not read as published';

  -- And now the draft is frozen.
  begin
    perform public.save_army_unit('warhammer-40k-11th', 'adepta-sororitas',
      'Castigator', 999, '[]'::jsonb, '[]'::jsonb, 0);
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%CATALOGUE_PUBLISHED%',
        'a published version accepted a write: ' || sqlerrm;
      raise notice 'PASS frozen: a published version refuses every write';
  end;

  -- Publishing the same version twice would overwrite the record of what was
  -- published, so it is refused.
  begin
    perform public.publish_army_catalogue('warhammer-40k-11th', 'again');
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%ALREADY_PUBLISHED%', 'wrong error: ' || sqlerrm;
      raise notice 'PASS once: a version is published once';
  end;

  -- The snapshot carries legacy's own shape, so the API and the importer speak
  -- the same language.
  select count(*) into n from public.army_catalogue_snapshots s,
    lateral jsonb_array_elements(s.catalogue -> 'systems' -> 0 -> 'factions') f
   where s.edition_id = 'warhammer-40k-11th'
     and f -> 'detachmentOptions' @> '[{"id":"hallowed-martyrs"}]'::jsonb;
  assert n = 1, 'the snapshot does not carry the detachment options';
  raise notice 'PASS snapshot: it is frozen in legacy''s own shape';

  raise notice 'ALL PASS · stage 8 catalogue';
end $$;

rollback;
