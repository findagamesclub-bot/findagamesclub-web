-- 0139 · The import can freeze what it imported
--
-- 0138 let the service key fill a draft and stopped there, so
-- `scripts/import-army-catalogue.mjs --publish` still answered NOT_PERMITTED
-- on its last call: 1409 units in the database and no version anybody could
-- pin a result to. A catalogue that cannot be published is a catalogue nothing
-- can use.
--
-- The argument for leaving publishing to a person was `published_by`: a record
-- everything pins to ought to say who froze it. It stays nullable and an
-- import leaves it null, which reads as "the importer" and is the truth. The
-- argument against is stronger: the judgement was made when somebody chose to
-- import a file, there is nothing to weigh afterwards, and a fresh deployment
-- has no admin account yet.
--
-- `start_army_catalogue_draft` goes with it, because re-importing an edition
-- that is already published needs a new version first and an import that can
-- only run once is an import nobody can correct.
--
-- Checked on a throwaway Postgres built from every migration: an import
-- publishes, the snapshot it wrote carries no publisher rather than a wrong
-- one, a member is still refused, and a published version is still frozen.

create or replace function public.publish_army_catalogue(
  p_edition text, p_note text default ''
) returns text
language plpgsql security definer set search_path = public as $$
declare v_version text; v_system text; v_catalogue jsonb;
begin
  if not (public.is_admin() or public.is_service_request()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select catalogue_version, system_id into v_version, v_system
    from public.army_editions where id = p_edition;
  if v_version is null then raise exception 'EDITION_NOT_FOUND'; end if;

  if exists (select 1 from public.army_catalogue_snapshots
              where edition_id = p_edition and catalogue_version = v_version) then
    raise exception 'ALREADY_PUBLISHED';
  end if;

  select jsonb_build_object(
    'editionId', p_edition,
    'catalogueVersion', v_version,
    'systems', jsonb_build_array(jsonb_build_object(
      'id', s.id,
      'label', s.label,
      'pointsOptions', to_jsonb(s.points_options),
      'factions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', f.id,
          'label', f.label,
          'detachments', coalesce((
            select jsonb_agg(d.label order by d.position, d.label)
              from public.army_detachments d
             where d.edition_id = f.edition_id and d.faction_id = f.id), '[]'::jsonb),
          'detachmentOptions', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', d.slug, 'label', d.label, 'dispositions', to_jsonb(d.dispositions))
              order by d.position, d.label)
              from public.army_detachments d
             where d.edition_id = f.edition_id and d.faction_id = f.id), '[]'::jsonb),
          'units', coalesce((
            select jsonb_agg(jsonb_build_object(
              'name', u.name, 'points', u.base_points::text,
              'options', u.options, 'copyCostRules', u.copy_cost_rules)
              order by u.position, u.name)
              from public.army_units u
             where u.edition_id = f.edition_id and u.faction_id = f.id), '[]'::jsonb))
          order by f.position, f.label)
        from public.army_factions f where f.edition_id = p_edition), '[]'::jsonb)))
  ) into v_catalogue
    from public.army_systems s where s.id = v_system;

  -- Null for an import, which is what it was. A name would be a guess.
  insert into public.army_catalogue_snapshots
    (edition_id, catalogue_version, catalogue, note, published_by)
  values (p_edition, v_version, v_catalogue, left(coalesce(p_note, ''), 500),
          (select auth.uid()));

  update public.army_editions
     set status = 'active', updated_at = now() where id = p_edition;
  -- One active per system, so anything else retires.
  update public.army_editions
     set status = 'retired', updated_at = now()
   where system_id = v_system and id <> p_edition and status = 'active';

  return v_version;
end $$;

create or replace function public.start_army_catalogue_draft(
  p_edition text, p_version text
) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_service_request()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if btrim(coalesce(p_version, '')) = '' then raise exception 'VERSION_NEEDS_NAME'; end if;
  if exists (select 1 from public.army_catalogue_snapshots
              where edition_id = p_edition and catalogue_version = btrim(p_version)) then
    raise exception 'ALREADY_PUBLISHED';
  end if;

  update public.army_editions
     set catalogue_version = btrim(p_version), updated_at = now()
   where id = p_edition;
  return btrim(p_version);
end $$;
