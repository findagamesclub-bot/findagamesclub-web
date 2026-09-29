-- 0144 · Pricing, signing and saving an army list
--
-- Points are money here, so the rule the ticket desk already follows applies:
-- the browser never names a total. The wizard prices as you type so the bar can
-- move without a round trip, and this prices again on the way in. Both read the
-- same published snapshot and `supabase/tests/stage10-pricing.sql` runs one
-- fixture set through both, because two readings of one rule that are never
-- compared are two readings that will drift.
--
-- Legacy's pricing rule (`_normalise_army_list_payload`, club_store.py:17555
-- and `_find_army_catalog_unit_option`, 17163): copies are counted per unit
-- NAME across every line, and the nth copy is priced from whichever copy-cost
-- rule covers n. Splitting a line must not be a way to pay less.
--
-- Checked on a throwaway Postgres built from every migration: three Castigators
-- cost 505 however they are typed in, an unknown unit is dropped and named, a
-- list over its limit is refused, a save with an unmoved signature makes no new
-- version, a rename makes no new version, and nobody can save onto somebody
-- else's list.

-- ------------------------------------------------------------- the ladder

/**
 * Who may write a list at this club.
 *
 * Five rungs in legacy's order (`_validate_army_builder_access`,
 * club_store.py:17188), raised as codes rather than sentences: the sentences
 * live in `src/utils/army-access.ts` so the screen and the refusal cannot use
 * different words for the same rung.
 *
 * `perform`, never `select`, wherever this is called. 0117 shipped a stable
 * guard whose result nothing read, the planner dropped it, and a stranger read
 * a club's takings.
 */
create or replace function public.army_builder_allowed(p_club bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_enabled boolean; v_tier text; v_allows boolean;
begin
  select enabled into v_enabled from public.army_builder_for(p_club);
  if not coalesce(v_enabled, false) then
    raise exception 'ARMY_NOT_ENABLED' using errcode = 'insufficient_privilege';
  end if;
  if auth.uid() is null then
    raise exception 'ARMY_SIGN_IN' using errcode = 'insufficient_privilege';
  end if;
  if public.can_manage_club(p_club) or public.is_admin() then return; end if;

  select m.tier_key into v_tier
    from public.club_memberships m
   where m.club_id = p_club and m.profile_id = auth.uid() and m.status = 'approved'
   limit 1;
  if v_tier is null then
    raise exception 'ARMY_NOT_MEMBER' using errcode = 'insufficient_privilege';
  end if;

  -- `benefits` is an object of flags on a real club and an empty array on a
  -- tier nobody configured, so a missing key and a wrong shape both read as no.
  select coalesce((t.benefits ->> 'armyBuilderAccess')::boolean, false) into v_allows
    from public.club_membership_tiers t
   where t.club_id = p_club and t.tier_key = v_tier;
  if not coalesce(v_allows, false) then
    raise exception 'ARMY_TIER' using errcode = 'insufficient_privilege';
  end if;
end $$;

-- ------------------------------------------------------------- the pricing

/** What the nth copy of one unit costs, from the snapshot's own shape. */
create or replace function public.army_copy_points(
  p_unit jsonb, p_copy int, p_label text
) returns int language plpgsql immutable set search_path = public as $$
declare
  v_set jsonb := coalesce(p_unit -> 'options', '[]'::jsonb);
  v_rule jsonb; v_opt jsonb; v_points text;
  v_label text := lower(btrim(coalesce(p_label, '')));
begin
  -- The first rule whose range covers this copy wins, and only replaces the
  -- option set when it actually carries one.
  for v_rule in select value from jsonb_array_elements(
                  coalesce(p_unit -> 'copyCostRules', '[]'::jsonb)) loop
    if p_copy >= coalesce(nullif(v_rule ->> 'fromCopy', '')::int, 1)
       and (nullif(v_rule ->> 'toCopy', '') is null
            or p_copy <= (v_rule ->> 'toCopy')::int) then
      if jsonb_array_length(coalesce(v_rule -> 'options', '[]'::jsonb)) > 0 then
        v_set := v_rule -> 'options';
      end if;
      exit;
    end if;
  end loop;

  if v_label <> '' then
    for v_opt in select value from jsonb_array_elements(v_set) loop
      if lower(btrim(coalesce(v_opt ->> 'label', ''))) = v_label then
        v_points := v_opt ->> 'points'; exit;
      end if;
    end loop;
  end if;
  -- A label the effective set does not carry falls back to the first rather
  -- than being refused, so a list survives a catalogue that renamed an option.
  if v_points is null and jsonb_array_length(v_set) > 0 then
    v_points := v_set -> 0 ->> 'points';
  end if;
  if v_points is null then v_points := p_unit ->> 'points'; end if;

  return coalesce(
    nullif(regexp_replace(coalesce(v_points, ''), '[^0-9]', '', 'g'), '')::int, 0);
end $$;

/**
 * A whole list, merged, sorted, priced and with what was dropped named.
 *
 * Mirrors `normaliseLines` in `src/utils/army-list.ts` line for line. The four
 * jobs in one pass: price each copy from the copy it actually is, merge lines
 * naming the same unit and option, drop what the catalogue does not have, and
 * sort what is left by name then option.
 */
create or replace function public.price_army_list(
  p_edition text, p_version text, p_faction text, p_units jsonb
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_catalogue jsonb; v_faction jsonb; v_units jsonb := '{}'::jsonb;
  v_unit jsonb; v_line jsonb; v_key text; v_name text; v_label text;
  v_used jsonb := '{}'::jsonb; v_merged jsonb := '{}'::jsonb;
  v_dropped text[] := '{}';
  v_from int; v_qty int; v_copy int; v_points int;
  v_line_points int; v_same boolean; v_first int;
  v_current jsonb; v_lines jsonb;
begin
  select s.catalogue into v_catalogue from public.army_catalogue_snapshots s
   where s.edition_id = p_edition and s.catalogue_version = p_version;
  if v_catalogue is null then
    raise exception 'ARMY_NO_CATALOGUE' using errcode = 'no_data_found';
  end if;

  -- By id or by label, the same leniency `resolve_result_army` already needs:
  -- a faction arrives as an id from a picker and as a name from everywhere else.
  select f into v_faction
    from jsonb_array_elements(v_catalogue -> 'systems' -> 0 -> 'factions') f
   where lower(btrim(f ->> 'id')) = lower(btrim(coalesce(p_faction, '')))
      or lower(btrim(f ->> 'label')) = lower(btrim(coalesce(p_faction, '')))
   limit 1;
  if v_faction is null then
    raise exception 'ARMY_BAD_FACTION' using errcode = 'no_data_found';
  end if;

  for v_unit in select value from jsonb_array_elements(
                  coalesce(v_faction -> 'units', '[]'::jsonb)) loop
    v_units := jsonb_set(v_units,
      array[lower(btrim(v_unit ->> 'name'))], v_unit, true);
  end loop;

  for v_line in select value from jsonb_array_elements(
                  coalesce(p_units, '[]'::jsonb)) loop
    v_name := btrim(coalesce(v_line ->> 'unitName', ''));
    v_unit := v_units -> lower(v_name);
    v_qty := floor(coalesce(nullif(v_line ->> 'quantity', '')::numeric, 0))::int;

    if v_unit is null or v_qty <= 0 then
      if v_name <> '' and v_unit is null then
        v_dropped := v_dropped || v_name;
      end if;
      continue;
    end if;

    v_from := coalesce((v_used ->> lower(v_name))::int, 0) + 1;
    v_used := jsonb_set(v_used, array[lower(v_name)],
                        to_jsonb(v_from + v_qty - 1), true);

    v_line_points := 0; v_same := true; v_first := null;
    for v_copy in v_from .. (v_from + v_qty - 1) loop
      v_points := public.army_copy_points(v_unit, v_copy, v_line ->> 'optionLabel');
      if v_first is null then v_first := v_points;
      elsif v_points <> v_first then v_same := false;
      end if;
      v_line_points := v_line_points + v_points;
    end loop;

    v_label := btrim(coalesce(
      public.army_option_label(v_unit, v_from, v_line ->> 'optionLabel'),
      v_line ->> 'optionLabel', 'Default'));
    if v_label = '' then v_label := 'Default'; end if;

    v_key := lower(v_name) || '::' || lower(v_label);
    v_current := v_merged -> v_key;
    if v_current is null then
      v_merged := jsonb_set(v_merged, array[v_key], jsonb_build_object(
        'unitName', v_unit ->> 'name',
        'optionLabel', v_label,
        'optionModelCount', public.army_option_models(v_unit, v_from, v_label),
        'quantity', v_qty,
        'unitPoints', case when v_same then v_first else 0 end,
        'linePoints', v_line_points), true);
    else
      v_merged := jsonb_set(v_merged, array[v_key], jsonb_build_object(
        'unitName', v_current ->> 'unitName',
        'optionLabel', v_current ->> 'optionLabel',
        'optionModelCount', v_current -> 'optionModelCount',
        'quantity', (v_current ->> 'quantity')::int + v_qty,
        'unitPoints', case
          when v_same and (v_current ->> 'unitPoints')::int = v_first then v_first
          else 0 end,
        'linePoints', (v_current ->> 'linePoints')::int + v_line_points), true);
    end if;
  end loop;

  select coalesce(jsonb_agg(value order by key), '[]'::jsonb) into v_lines
    from jsonb_each(v_merged);

  return jsonb_build_object(
    'lines', v_lines,
    'total', coalesce((select sum((value ->> 'linePoints')::int)
                         from jsonb_array_elements(v_lines)), 0),
    'dropped', to_jsonb(v_dropped),
    'factionId', v_faction ->> 'id',
    'factionLabel', v_faction ->> 'label');
end $$;

/** The label a copy is priced under, which is what the merge keys on. */
create or replace function public.army_option_label(
  p_unit jsonb, p_copy int, p_label text
) returns text language plpgsql immutable set search_path = public as $$
declare
  v_set jsonb := coalesce(p_unit -> 'options', '[]'::jsonb);
  v_rule jsonb; v_opt jsonb;
  v_label text := lower(btrim(coalesce(p_label, '')));
begin
  for v_rule in select value from jsonb_array_elements(
                  coalesce(p_unit -> 'copyCostRules', '[]'::jsonb)) loop
    if p_copy >= coalesce(nullif(v_rule ->> 'fromCopy', '')::int, 1)
       and (nullif(v_rule ->> 'toCopy', '') is null
            or p_copy <= (v_rule ->> 'toCopy')::int) then
      if jsonb_array_length(coalesce(v_rule -> 'options', '[]'::jsonb)) > 0 then
        v_set := v_rule -> 'options';
      end if;
      exit;
    end if;
  end loop;
  if v_label <> '' then
    for v_opt in select value from jsonb_array_elements(v_set) loop
      if lower(btrim(coalesce(v_opt ->> 'label', ''))) = v_label then
        return v_opt ->> 'label';
      end if;
    end loop;
  end if;
  if jsonb_array_length(v_set) > 0 then return v_set -> 0 ->> 'label'; end if;
  return null;
end $$;

/** And its model count, which the line prints beside the name. */
create or replace function public.army_option_models(
  p_unit jsonb, p_copy int, p_label text
) returns int language sql immutable set search_path = public as $$
  select nullif(regexp_replace(coalesce(o ->> 'modelCount', ''), '[^0-9]', '', 'g'), '')::int
    from jsonb_array_elements(coalesce(p_unit -> 'options', '[]'::jsonb)) o
   where lower(btrim(coalesce(o ->> 'label', '')))
         = lower(btrim(coalesce(p_label, '')))
   limit 1
$$;

-- ----------------------------------------------------------- the signature

/**
 * The canonical string a version is identified by.
 *
 * Built by hand rather than by casting jsonb, because **jsonb orders an
 * object's keys by length and then bytes**, not alphabetically, so
 * `payload::text` here and `JSON.stringify` in the browser would disagree
 * about the same list and every save would look like a change.
 *
 * It mirrors `canonicalPayload` in `src/utils/army-signature.ts`, which pins
 * this exact string in its test. Legacy's own hash is not preserved and does
 * not need to be: army lists start clean, so the only thing that matters is
 * that our two readings agree with each other.
 *
 * Not in it: the list's name, and every points figure. Renaming is not a new
 * version of the army and a re-price against the same catalogue is not either.
 */
create or replace function public.army_list_canonical(p jsonb)
returns text language sql immutable set search_path = public as $$
  select '{"catalogueVersion":' || to_jsonb(btrim(coalesce(p ->> 'catalogueVersion', '')))::text
    || ',"detachmentSelections":[' || coalesce((
         select string_agg(
           '{"detachment":' || to_jsonb(lower(btrim(coalesce(d ->> 'detachment', ''))))::text
           || ',"disposition":' || to_jsonb(lower(btrim(coalesce(d ->> 'disposition', ''))))::text
           || '}', ',' order by ord)
           from jsonb_array_elements(coalesce(p -> 'detachmentSelections', '[]'::jsonb))
                with ordinality t(d, ord)), '')
    || '],"editionId":' || to_jsonb(btrim(coalesce(p ->> 'editionId', '')))::text
    || ',"factionId":' || to_jsonb(lower(btrim(coalesce(p ->> 'factionId', ''))))::text
    || ',"listType":' || to_jsonb(case when btrim(coalesce(p ->> 'listType', '')) = 'collection'
                                       then 'collection' else 'army-list' end)::text
    || ',"pointsLimit":' || to_jsonb(btrim(coalesce(p ->> 'pointsLimit', '')))::text
    || ',"systemId":' || to_jsonb(lower(btrim(coalesce(p ->> 'systemId', ''))))::text
    || ',"units":[' || coalesce((
         select string_agg(
           '{"optionLabel":' || to_jsonb(lower(btrim(coalesce(u ->> 'optionLabel', ''))))::text
           || ',"quantity":' || floor(coalesce(nullif(u ->> 'quantity', '')::numeric, 0))::int::text
           || ',"unitName":' || to_jsonb(lower(btrim(coalesce(u ->> 'unitName', ''))))::text
           || '}', ',' order by ord)
           from jsonb_array_elements(coalesce(p -> 'units', '[]'::jsonb))
                with ordinality t(u, ord)), '')
    || ']}'
$$;

create or replace function public.army_list_signature(p jsonb)
returns text language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(public.army_list_canonical(p), 'UTF8')), 'hex')
$$;

-- --------------------------------------------------------------- the save

/**
 * Save a list, and make a version only if the army actually changed.
 *
 * `p_summary` is written by `describeChange` in `src/utils/army-diff.ts`
 * rather than computed here, because that wording is legacy's and lives in one
 * tested place. It is a label, not a permission: the worst a hand-rolled call
 * can do with it is mislabel its own history.
 *
 * A save whose signature has not moved rewrites the current version in place
 * rather than stacking a duplicate, which is legacy's behaviour
 * (`update_army_list`, club_store.py:6990) and is what makes a rename free.
 */
create or replace function public.save_army_list(
  p_list bigint, p_club bigint, p_payload jsonb, p_summary text default ''
) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_edition text; v_version text; v_catalogue jsonb;
  v_priced jsonb; v_lines jsonb; v_total int;
  v_name text; v_type text; v_limit text; v_limit_n int;
  v_detachments jsonb; v_signature text; v_canonical jsonb;
  v_list public.army_lists%rowtype; v_current public.army_list_versions%rowtype;
  v_number int; v_version_id bigint; v_made boolean := false;
begin
  perform public.army_builder_allowed(p_club);

  select edition_id, catalogue_version into v_edition, v_version
    from public.army_builder_for(p_club);
  if coalesce(v_version, '') = '' then
    raise exception 'ARMY_NO_CATALOGUE' using errcode = 'no_data_found';
  end if;

  v_name := btrim(coalesce(p_payload ->> 'name', ''));
  if v_name = '' then raise exception 'ARMY_NAME'; end if;

  v_type := case when btrim(coalesce(p_payload ->> 'listType', '')) = 'collection'
                 then 'collection' else 'army-list' end;
  v_limit := case when v_type = 'collection' then ''
                  else btrim(coalesce(p_payload ->> 'pointsLimit', '')) end;
  v_detachments := case when v_type = 'collection' then '[]'::jsonb
                        else coalesce(p_payload -> 'detachments', '[]'::jsonb) end;

  select s.catalogue into v_catalogue from public.army_catalogue_snapshots s
   where s.edition_id = v_edition and s.catalogue_version = v_version;

  if v_type <> 'collection' and not exists (
       select 1 from jsonb_array_elements_text(
              coalesce(v_catalogue -> 'systems' -> 0 -> 'pointsOptions', '[]'::jsonb)) o
        where btrim(o) = v_limit) then
    raise exception 'ARMY_BAD_POINTS';
  end if;
  if v_type <> 'collection' and jsonb_array_length(v_detachments) = 0 then
    raise exception 'ARMY_NO_DETACHMENT';
  end if;

  v_priced := public.price_army_list(v_edition, v_version,
                coalesce(p_payload ->> 'factionId', ''),
                coalesce(p_payload -> 'units', '[]'::jsonb));
  v_lines := v_priced -> 'lines';
  v_total := (v_priced ->> 'total')::int;

  if jsonb_array_length(v_lines) = 0 then raise exception 'ARMY_NO_UNITS'; end if;
  v_limit_n := coalesce(nullif(v_limit, '')::int, 0);
  if v_type <> 'collection' and v_limit_n > 0 and v_total > v_limit_n then
    raise exception 'ARMY_OVER_LIMIT';
  end if;

  -- Signed from the PRICED lines, never from what was posted: the merge and
  -- the sort are part of what makes two lists the same list.
  v_canonical := jsonb_build_object(
    'editionId', v_edition, 'catalogueVersion', v_version,
    'listType', v_type, 'systemId', coalesce(v_catalogue -> 'systems' -> 0 ->> 'id', ''),
    'pointsLimit', v_limit, 'factionId', v_priced ->> 'factionId',
    'detachmentSelections', v_detachments, 'units', v_lines);
  v_signature := public.army_list_signature(v_canonical);

  if p_list is null then
    insert into public.army_lists (club_id, profile_id, name, list_type, system_id,
                                   edition_id, faction_id, faction_label, points_limit)
    values (p_club, auth.uid(), v_name, v_type,
            coalesce(v_catalogue -> 'systems' -> 0 ->> 'id', ''),
            v_edition, v_priced ->> 'factionId', v_priced ->> 'factionLabel', v_limit)
    returning * into v_list;
    v_number := 1; v_made := true;
  else
    select * into v_list from public.army_lists
     where id = p_list and deleted_at is null for update;
    if v_list.id is null then raise exception 'ARMY_LIST_NOT_FOUND'; end if;
    if v_list.profile_id <> auth.uid() then
      raise exception 'ARMY_NOT_YOURS' using errcode = 'insufficient_privilege';
    end if;
    if v_list.club_id <> p_club then raise exception 'ARMY_LIST_NOT_FOUND'; end if;

    select * into v_current from public.army_list_versions
     where id = v_list.current_version_id;
    v_made := v_current.id is null or coalesce(v_current.signature, '') <> v_signature;
    if v_made then
      select coalesce(max(version_number), 0) + 1 into v_number
        from public.army_list_versions where list_id = v_list.id;
    else
      v_number := v_current.version_number;
    end if;

    update public.army_lists
       set name = v_name, list_type = v_type, points_limit = v_limit,
           faction_id = v_priced ->> 'factionId',
           faction_label = v_priced ->> 'factionLabel',
           edition_id = v_edition
     where id = v_list.id;
  end if;

  if v_made then
    insert into public.army_list_versions (
      list_id, version_number, name, list_type, faction_id, faction_label,
      detachment_selections, units, points_limit, total_points,
      edition_id, catalogue_version, change_summary, signature)
    values (v_list.id, v_number, v_name, v_type,
            v_priced ->> 'factionId', v_priced ->> 'factionLabel',
            v_detachments, v_lines, v_limit, v_total, v_edition, v_version,
            case when v_number = 1 then 'Initial version'
                 else nullif(btrim(coalesce(p_summary, '')), '') end,
            v_signature)
    returning id into v_version_id;
  else
    update public.army_list_versions
       set name = v_name, list_type = v_type,
           faction_id = v_priced ->> 'factionId',
           faction_label = v_priced ->> 'factionLabel',
           detachment_selections = v_detachments, units = v_lines,
           points_limit = v_limit, total_points = v_total,
           edition_id = v_edition, catalogue_version = v_version
     where id = v_current.id
    returning id into v_version_id;
  end if;

  update public.army_lists set current_version_id = v_version_id where id = v_list.id;

  return jsonb_build_object(
    'listId', v_list.id, 'versionId', v_version_id,
    'versionNumber', v_number, 'createdVersion', v_made,
    'totalPoints', v_total, 'dropped', v_priced -> 'dropped');
end $$;

/** Soft, so a result that names a version still has one to name. */
create or replace function public.delete_army_list(p_list bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_list public.army_lists%rowtype;
begin
  select * into v_list from public.army_lists where id = p_list and deleted_at is null;
  if v_list.id is null then raise exception 'ARMY_LIST_NOT_FOUND'; end if;
  perform public.army_builder_allowed(v_list.club_id);
  if v_list.profile_id <> auth.uid() then
    raise exception 'ARMY_NOT_YOURS' using errcode = 'insufficient_privilege';
  end if;
  update public.army_lists set deleted_at = now() where id = p_list;
end $$;

revoke all on function public.army_builder_allowed(bigint) from public, anon;
revoke all on function public.army_copy_points(jsonb, int, text) from public, anon;
revoke all on function public.army_option_label(jsonb, int, text) from public, anon;
revoke all on function public.army_option_models(jsonb, int, text) from public, anon;
revoke all on function public.price_army_list(text, text, text, jsonb) from public, anon;
revoke all on function public.army_list_canonical(jsonb) from public, anon;
revoke all on function public.army_list_signature(jsonb) from public, anon;
revoke all on function public.save_army_list(bigint, bigint, jsonb, text) from public, anon;
revoke all on function public.delete_army_list(bigint) from public, anon;

grant execute on function public.army_builder_allowed(bigint) to authenticated;
grant execute on function public.price_army_list(text, text, text, jsonb) to authenticated;
grant execute on function public.save_army_list(bigint, bigint, jsonb, text) to authenticated;
grant execute on function public.delete_army_list(bigint) to authenticated;
