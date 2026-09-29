-- 0140 · A club records against the last PUBLISHED version, not the draft
--
-- `army_builder_for` answered with `army_editions.catalogue_version`, which is
-- the version being edited. The moment a site admin presses "Start a new
-- draft" that column moves to a version no snapshot exists for, and every club
-- pointing at that edition breaks at once:
--
--   * the result dialog fetches the catalogue, gets a 404 and says it would
--     not load, at every club, for as long as the draft is open;
--   * `club_catalogue_version` hands the draft version to
--     `resolve_result_army`, which finds no snapshot, so **every army a member
--     tries to record is refused with RESULT_BAD_FACTION** -- a faction that
--     is plainly in the catalogue they can see.
--
-- Editing the catalogue is a site admin's housekeeping and cannot take result
-- recording down at forty clubs while they do it. A club follows the last
-- version that was actually frozen, and a new draft is invisible to everybody
-- until it is published, which is what publishing is for.
--
-- Found by testing the admin screens: the catalogue page offers the button, so
-- somebody was always going to press it.
--
-- The same test found a second one. `publish_army_catalogue` sets the edition
-- active and THEN retires the others, so publishing a second edition of a
-- system trips `army_editions_one_active` before it ever reaches the retire:
-- "duplicate key value violates unique constraint". A 12th edition could never
-- have been published while an 11th was live. The two statements swap over.
--
-- Checked on a throwaway Postgres built from every migration: a club reads the
-- published version, opening a draft does not move it, publishing the draft
-- does, a club pinned to an edition with nothing published reads as off rather
-- than as an error, and a second edition of one system publishes and retires
-- the first.

/**
 * The version of this edition a club should be recording against.
 *
 * The edition's own version when that one is frozen, which is the ordinary
 * case, and the last one that was frozen while a draft is open. Ordering by
 * `published_at` alone is not enough to answer it: two publishes inside one
 * transaction share a timestamp, and "whichever came back first" is not a rule
 * anybody can reason about.
 */
create or replace function public.army_published_version(
  p_edition text, p_working text
) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select snap.catalogue_version from public.army_catalogue_snapshots snap
      where snap.edition_id = p_edition and snap.catalogue_version = p_working),
    (select snap.catalogue_version from public.army_catalogue_snapshots snap
      where snap.edition_id = p_edition
      order by snap.published_at desc, snap.catalogue_version desc
      limit 1));
$$;

create or replace function public.army_builder_for(p_club bigint)
returns table (enabled boolean, edition_id text, catalogue_version text)
language sql stable security definer set search_path = public as $$
  select coalesce(s.enabled, false), ed.id, pub.catalogue_version
    from (select 1) one
    left join public.club_army_builder_settings s on s.club_id = p_club
    left join public.army_editions ed
      on ed.id = coalesce(s.edition_id,
                          (select id from public.army_editions
                            where status = 'active' limit 1))
    left join lateral public.army_published_version(ed.id, ed.catalogue_version)
      as pub(catalogue_version) on true
$$;

create or replace function public.army_builders_for(p_clubs bigint[])
returns table (club_id bigint, enabled boolean, edition_id text,
               catalogue_version text)
language sql stable security definer set search_path = public as $$
  select c.id, coalesce(s.enabled, false), ed.id, pub.catalogue_version
    from unnest(coalesce(p_clubs, '{}'::bigint[])) as c(id)
    left join public.club_army_builder_settings s on s.club_id = c.id
    left join public.army_editions ed
      on ed.id = coalesce(s.edition_id,
                          (select id from public.army_editions
                            where status = 'active' limit 1))
    left join lateral public.army_published_version(ed.id, ed.catalogue_version)
      as pub(catalogue_version) on true
$$;

revoke all on function public.army_published_version(text, text) from public, anon;
grant execute on function public.army_published_version(text, text) to authenticated, anon;

/**
 * Freeze the draft.
 *
 * Unchanged from 0139 but for the order of the last two statements: retire
 * whatever is active before making this one active, or the partial unique
 * index refuses the publish outright.
 */
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

  -- Retire first. One active per system is a partial unique index, and setting
  -- this one active while the old one still is trips it before the retire can
  -- run.
  update public.army_editions
     set status = 'retired', updated_at = now()
   where system_id = v_system and id <> p_edition and status = 'active';
  update public.army_editions
     set status = 'active', updated_at = now() where id = p_edition;

  return v_version;
end $$;

/**
 * A league table's army, with the player named when it will not go in.
 *
 * The table is saved whole, so one bad row refuses twenty. The trigger raised
 * `RESULT_BAD_FACTION` and the screen turned that into "Could not save the
 * table. Try again.", which is true and useless: a club with a legacy spelling
 * like "Custodes" in one row had no way of knowing which row, or why, or that
 * the catalogue was involved at all. Re-raised with the name attached.
 */
create or replace function public.competition_standing_army()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_club bigint; v_cat record;
begin
  if tg_op = 'DELETE' then
    delete from public.game_result_armies
     where source_type = 'competition' and source_id = old.id;
    return old;
  end if;

  select c.club_id into v_club from public.club_competitions c
   where c.id = new.competition_id;
  if v_club is null then return new; end if;

  select * into v_cat from public.club_catalogue_version(v_club);

  begin
    perform public.put_result_army('competition', new.id, 'one', v_club,
      public.london_today(), new.profile_id, new.member_name,
      jsonb_build_object(
        'factionId', lower(btrim(coalesce(new.faction, ''))),
        'factionLabel', btrim(coalesce(new.faction, '')),
        'detachment', btrim(coalesce(new.detachment, '')),
        'disposition', btrim(coalesce(new.disposition, ''))),
      v_cat.edition_id, v_cat.catalogue_version);
  exception
    when others then
      -- The code stays at the front so the service can still match on it.
      raise exception '% for %', sqlerrm, coalesce(nullif(btrim(new.member_name), ''), 'a player');
  end;

  return new;
end $$;
