-- 0138 · a published catalogue version cannot be edited by anybody.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- What PostgREST sets for a request made with the service key: a verified
-- claim, no subject.
create or replace function pg_temp.be_service() returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'service_role')::text, true);
end $$;

set local role authenticated;

do $$
declare w record; n int; v_club bigint; v_seen text;
begin
  select * into w from who;
  select id into v_club from c;

  -- --------------------------------------------- a member is still refused
  perform pg_temp.be(w.member);
  begin
    perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
      array['2000'], 'warhammer-40k-11th', '11th', 'v1');
    raise exception 'NOT_REACHED';
  exception
    when insufficient_privilege then
      raise notice 'PASS guard: a member cannot write the catalogue';
    when others then raise exception 'wrong error for a member: %', sqlerrm;
  end;

  -- ------------------------------------------------ the importer can write
  perform pg_temp.be_service();
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['2000'], 'warhammer-40k-11th', '11th', 'v1');
  perform public.save_army_faction('warhammer-40k-11th', 'adepta-sororitas',
    'Adepta Sororitas', 0);
  perform public.save_army_detachment('warhammer-40k-11th', 'adepta-sororitas',
    'hallowed-martyrs', 'Hallowed Martyrs', array['Priority Assets'], 0);
  perform public.save_army_unit('warhammer-40k-11th', 'adepta-sororitas',
    'Castigator', 165, '[]'::jsonb, '[]'::jsonb, 0);
  raise notice 'PASS service: an import on the service key fills the draft';

  -- ------------------------------------------------- and freeze what it wrote
  -- 0139. An import that fills a draft and cannot publish it leaves 1409 units
  -- nothing can pin a result to.
  perform public.publish_army_catalogue('warhammer-40k-11th', 'Imported');
  assert (select published_by from public.army_catalogue_snapshots
           where edition_id = 'warhammer-40k-11th' and catalogue_version = 'v1') is null,
    'an import claimed a publisher it does not have';
  raise notice 'PASS service: and freezes it, with no publisher rather than a wrong one';

  -- ------------------------------------------------------ then it is frozen
  perform pg_temp.be(w.admin);

  begin
    perform public.save_army_unit('warhammer-40k-11th', 'adepta-sororitas',
      'Castigator', 999, '[]'::jsonb, '[]'::jsonb, 0);
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%CATALOGUE_PUBLISHED%', 'wrong error: ' || sqlerrm;
      raise notice 'PASS frozen: an admin cannot edit a published version';
  end;

  -- The one this migration exists for: a writer that never calls the function.
  set local role postgres;
  begin
    update public.army_units set base_points = 999 where name = 'Castigator';
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%CATALOGUE_PUBLISHED%', 'wrong error: ' || sqlerrm;
      raise notice 'PASS frozen: nor can a direct write, which is the point';
  end;
  set local role authenticated;

  begin
    delete from public.army_units where name = 'Castigator';
    raise exception 'NOT_REACHED';
  exception
    when others then
      assert sqlerrm like '%CATALOGUE_PUBLISHED%' or sqlerrm like '%denied%',
        'wrong error on delete: ' || sqlerrm;
      raise notice 'PASS frozen: and a published unit cannot be deleted';
  end;

  -- --------------------------------------------- a new draft opens it again
  perform pg_temp.be(w.admin);
  perform public.start_army_catalogue_draft('warhammer-40k-11th', 'v2');
  perform public.save_army_unit('warhammer-40k-11th', 'adepta-sororitas',
    'Castigator', 175, '[]'::jsonb, '[]'::jsonb, 0);
  raise notice 'PASS draft: a new version is editable again';

  -- And the published snapshot is untouched by it, which is the whole promise
  -- a pinned result rests on.
  select (s.catalogue -> 'systems' -> 0 -> 'factions' -> 0 -> 'units' -> 0 ->> 'points')::int
    into n from public.army_catalogue_snapshots s
   where s.edition_id = 'warhammer-40k-11th' and s.catalogue_version = 'v1';
  assert n = 165, 'the published snapshot moved with the draft: ' || n;
  raise notice 'PASS pinned: what was published in v1 still reads as v1';

  -- ----------------------------------- and a draft is invisible to a club
  -- 0140. The club pinned this edition; opening a draft on it must not take
  -- its result recording down until somebody publishes again.
  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');

  select catalogue_version into v_seen from public.army_builder_for(v_club);
  assert v_seen = 'v1', 'the club is not on the published version: ' || coalesce(v_seen, 'null');

  perform pg_temp.be(w.admin);
  perform public.start_army_catalogue_draft('warhammer-40k-11th', 'v3');
  select catalogue_version into v_seen from public.army_builder_for(v_club);
  assert v_seen = 'v1', 'a new draft moved the club onto it: ' || coalesce(v_seen, 'null');
  select catalogue_version into v_seen from public.army_builders_for(array[v_club]);
  assert v_seen = 'v1', 'the bulk answer disagreed with the single one';
  raise notice 'PASS pinned: opening a draft leaves every club where it was';

  perform public.publish_army_catalogue('warhammer-40k-11th', '');
  select catalogue_version into v_seen from public.army_builder_for(v_club);
  assert v_seen = 'v3', 'publishing did not move the club on: ' || coalesce(v_seen, 'null');
  raise notice 'PASS pinned: publishing is what moves them';

  raise notice 'ALL PASS · stage 8 frozen catalogue';
end $$;

rollback;
