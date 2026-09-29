-- 0133 · The army catalogue an admin maintains
--
-- The client's words: "Army Builder, with the catalogue an admin maintains for
-- faction, detachments, dispositions and units plus unit point costs".
--
-- Relational for editing and snapshotted for reading, which is the whole shape:
-- an admin edits rows on a draft, publishing freezes the lot into one jsonb,
-- and every list and every result pins the version it was written against. A
-- catalogue that could be edited underneath a recorded game would quietly
-- rewrite what somebody played last April.
--
-- Measured from ../app/data/game-editions/warhammer-40k/11th/catalogue.json:
-- one system, four points options, 30 factions, 346 detachments and 1409
-- units. Five distinct dispositions across all 346, and each detachment owns
-- its own list, which the legacy manifest states in its own words. So a
-- disposition belongs to a detachment here too, and one from another
-- detachment is not offerable rather than merely refused.
--
-- Checked on a throwaway Postgres built from every migration: a member cannot
-- write any of it, an admin can, a published version refuses every write, and
-- publishing twice under the same version is refused rather than silently
-- replacing the record of what was published.

create table public.army_systems (
  id            text primary key,
  label         text not null,
  -- Legacy's own list, as strings, because that is what the file holds and
  -- what the builder offers: 1000, 1500, 2000, 3000.
  points_options text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create table public.army_editions (
  id           text primary key,
  system_id    text not null references public.army_systems (id) on delete cascade,
  label        text not null,
  -- The version being edited. Publishing snapshots it; starting a new draft
  -- moves it on. Two editions of one system can exist, one active.
  catalogue_version text not null,
  status       text not null default 'draft',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint army_editions_status check (status in ('draft', 'active', 'retired'))
);

create unique index army_editions_one_active
  on public.army_editions (system_id) where status = 'active';

create table public.army_factions (
  edition_id text not null references public.army_editions (id) on delete cascade,
  -- Legacy's slug, because the import, the alias folding and every rollup key
  -- on it: `adepta-sororitas`, never a generated id.
  id         text not null,
  label      text not null,
  position   integer not null default 0,
  primary key (edition_id, id)
);

create table public.army_detachments (
  id         bigint generated always as identity primary key,
  edition_id text not null,
  faction_id text not null,
  slug       text not null,
  label      text not null,
  -- The detachment's own, which is the legacy manifest's stated policy.
  dispositions text[] not null default '{}',
  position   integer not null default 0,
  foreign key (edition_id, faction_id)
    references public.army_factions (edition_id, id) on delete cascade
);

create unique index army_detachments_one_slug
  on public.army_detachments (edition_id, faction_id, slug);
create index army_detachments_faction_idx
  on public.army_detachments (edition_id, faction_id, position);

create table public.army_units (
  id          bigint generated always as identity primary key,
  edition_id  text not null,
  faction_id  text not null,
  name        text not null,
  base_points integer not null default 0,
  -- [{ label, modelCount, points }], legacy's own shape.
  options     jsonb not null default '[]',
  -- [{ fromCopy, toCopy, options[] }] with a null toCopy meaning "and every
  -- copy after". Castigator: copies 1 and 2 at 165, copy 3 and up at 175, so
  -- three of them is 505 and not 495.
  copy_cost_rules jsonb not null default '[]',
  position    integer not null default 0,
  foreign key (edition_id, faction_id)
    references public.army_factions (edition_id, id) on delete cascade
);

create unique index army_units_one_name
  on public.army_units (edition_id, faction_id, lower(btrim(name)));
create index army_units_faction_idx
  on public.army_units (edition_id, faction_id, position);
-- 1409 units and a search box, so the search is an index scan.
create extension if not exists pg_trgm;
create index army_units_name_trgm
  on public.army_units using gin (name gin_trgm_ops);

/**
 * A published version, frozen.
 *
 * The one thing every list and result points at. Nothing may edit a row whose
 * version is in here, which is what makes "what I played in April" still read
 * the way it was recorded.
 */
create table public.army_catalogue_snapshots (
  edition_id        text not null references public.army_editions (id) on delete cascade,
  catalogue_version text not null,
  catalogue         jsonb not null,
  note              text not null default '',
  published_by      uuid references public.profiles (id) on delete set null,
  published_at      timestamptz not null default now(),
  primary key (edition_id, catalogue_version)
);

-- ------------------------------------------------------------------ grants

-- Supabase hands out a whole-table grant on creation, so this comes first or
-- the column grants below are inert.
revoke insert, update, delete on public.army_systems from authenticated, anon;
revoke insert, update, delete on public.army_editions from authenticated, anon;
revoke insert, update, delete on public.army_factions from authenticated, anon;
revoke insert, update, delete on public.army_detachments from authenticated, anon;
revoke insert, update, delete on public.army_units from authenticated, anon;
revoke insert, update, delete on public.army_catalogue_snapshots from authenticated, anon;

-- Nothing is granted back. Every write goes through a definer function below,
-- because the whole point of a catalogue is that one person maintains it.
grant select on public.army_systems to authenticated, anon;
grant select on public.army_editions to authenticated, anon;
grant select on public.army_factions to authenticated, anon;
grant select on public.army_detachments to authenticated, anon;
grant select on public.army_units to authenticated, anon;
grant select on public.army_catalogue_snapshots to authenticated, anon;

alter table public.army_systems enable row level security;
alter table public.army_editions enable row level security;
alter table public.army_factions enable row level security;
alter table public.army_detachments enable row level security;
alter table public.army_units enable row level security;
alter table public.army_catalogue_snapshots enable row level security;

-- Public, because a member building a list reads it and a visitor reading the
-- meta tracker reads it. There is nothing private in a points value.
create policy army_systems_select on public.army_systems
  for select to authenticated, anon using (true);
create policy army_editions_select on public.army_editions
  for select to authenticated, anon using (true);
create policy army_factions_select on public.army_factions
  for select to authenticated, anon using (true);
create policy army_detachments_select on public.army_detachments
  for select to authenticated, anon using (true);
create policy army_units_select on public.army_units
  for select to authenticated, anon using (true);
create policy army_catalogue_snapshots_select on public.army_catalogue_snapshots
  for select to authenticated, anon using (true);

do $$
declare v_bad boolean; v_table text;
begin
  foreach v_table in array array['army_systems', 'army_editions', 'army_factions',
                                 'army_detachments', 'army_units',
                                 'army_catalogue_snapshots']
  loop
    select bool_or(column_name is null) into v_bad from (
      select null::text as column_name from information_schema.role_table_grants
       where table_name = v_table and grantee = 'authenticated'
         and privilege_type = 'INSERT'
      union all
      select column_name from information_schema.role_column_grants
       where table_name = v_table and grantee = 'authenticated'
         and privilege_type = 'INSERT') g;
    if coalesce(v_bad, false) then
      raise exception '% still carries a whole-table insert grant', v_table;
    end if;
  end loop;
end $$;

-- --------------------------------------------------------------- functions

/** Is this edition's current version already published, and so frozen? */
create or replace function public.army_version_published(p_edition text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.army_catalogue_snapshots s
      join public.army_editions e on e.id = s.edition_id
     where e.id = p_edition and s.catalogue_version = e.catalogue_version);
$$;

/**
 * The guard every write shares.
 *
 * An admin, and a draft. Written once rather than at the top of six functions,
 * because six copies is six chances for one of them to drift.
 */
create or replace function public.army_catalogue_writable(p_edition text)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if public.army_version_published(p_edition) then
    raise exception 'CATALOGUE_PUBLISHED';
  end if;
end $$;

/** Add or rename a faction on a draft. */
create or replace function public.save_army_faction(
  p_edition text, p_id text, p_label text, p_position integer default 0
) returns text
language plpgsql security definer set search_path = public as $$
begin
  perform public.army_catalogue_writable(p_edition);
  if btrim(coalesce(p_label, '')) = '' then raise exception 'FACTION_NEEDS_LABEL'; end if;

  insert into public.army_factions (edition_id, id, label, position)
  values (p_edition, lower(btrim(p_id)), btrim(p_label), coalesce(p_position, 0))
  on conflict (edition_id, id) do update
    set label = excluded.label, position = excluded.position;

  return lower(btrim(p_id));
end $$;

/**
 * One detachment, with its own dispositions.
 *
 * The dispositions ride with it rather than sitting on the faction, because
 * that is the legacy manifest's stated policy and it is what makes a
 * disposition from another detachment unofferable rather than merely refused.
 */
create or replace function public.save_army_detachment(
  p_edition text, p_faction text, p_slug text, p_label text,
  p_dispositions text[] default '{}', p_position integer default 0
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform public.army_catalogue_writable(p_edition);
  if btrim(coalesce(p_label, '')) = '' then raise exception 'DETACHMENT_NEEDS_LABEL'; end if;

  insert into public.army_detachments
    (edition_id, faction_id, slug, label, dispositions, position)
  values (p_edition, lower(btrim(p_faction)), lower(btrim(p_slug)), btrim(p_label),
          coalesce(p_dispositions, '{}'), coalesce(p_position, 0))
  on conflict (edition_id, faction_id, slug) do update
    set label = excluded.label, dispositions = excluded.dispositions,
        position = excluded.position
  returning id into v_id;

  return v_id;
end $$;

/** One unit, with its options and its copy-cost rules. */
create or replace function public.save_army_unit(
  p_edition text, p_faction text, p_name text, p_points integer,
  p_options jsonb default '[]', p_rules jsonb default '[]',
  p_position integer default 0
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform public.army_catalogue_writable(p_edition);
  if btrim(coalesce(p_name, '')) = '' then raise exception 'UNIT_NEEDS_NAME'; end if;
  -- A unit at nought points is a mistyped unit, not a free one. Legacy has
  -- none, and `Number("")` being 0 is how a price shipped as free in stage 5.
  if coalesce(p_points, 0) <= 0 then raise exception 'UNIT_NEEDS_POINTS'; end if;

  insert into public.army_units
    (edition_id, faction_id, name, base_points, options, copy_cost_rules, position)
  values (p_edition, lower(btrim(p_faction)), btrim(p_name), p_points,
          coalesce(p_options, '[]'), coalesce(p_rules, '[]'), coalesce(p_position, 0))
  on conflict (edition_id, faction_id, lower(btrim(name))) do update
    set base_points = excluded.base_points, options = excluded.options,
        copy_cost_rules = excluded.copy_cost_rules, position = excluded.position
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.delete_army_unit(p_edition text, p_unit bigint)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform public.army_catalogue_writable(p_edition);
  delete from public.army_units where id = p_unit and edition_id = p_edition;
  return true;
end $$;

/**
 * Freeze the draft.
 *
 * Builds the snapshot in legacy's own shape, so the public API and the
 * importer speak the same language and a file exported from here could be read
 * by the old app. Refused if that version is already published: a record of
 * what was published is not something to overwrite.
 */
create or replace function public.publish_army_catalogue(
  p_edition text, p_note text default ''
) returns text
language plpgsql security definer set search_path = public as $$
declare v_version text; v_system text; v_catalogue jsonb;
begin
  if not public.is_admin() then
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

/** Start editing again, on a new version, leaving the published one alone. */
create or replace function public.start_army_catalogue_draft(
  p_edition text, p_version text
) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
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

/** Everything a system needs to exist. Admin only, and idempotent. */
create or replace function public.save_army_edition(
  p_system text, p_system_label text, p_points text[],
  p_edition text, p_edition_label text, p_version text
) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  insert into public.army_systems (id, label, points_options)
  values (p_system, p_system_label, coalesce(p_points, '{}'))
  on conflict (id) do update
    set label = excluded.label, points_options = excluded.points_options;

  insert into public.army_editions (id, system_id, label, catalogue_version)
  values (p_edition, p_system, p_edition_label, p_version)
  on conflict (id) do update
    set label = excluded.label, updated_at = now();

  return p_edition;
end $$;

revoke all on function public.army_version_published(text) from public, anon;
revoke all on function public.army_catalogue_writable(text) from public, anon;
revoke all on function public.save_army_faction(text, text, text, integer) from public, anon;
revoke all on function public.save_army_detachment(text, text, text, text, text[], integer)
  from public, anon;
revoke all on function public.save_army_unit(text, text, text, integer, jsonb, jsonb, integer)
  from public, anon;
revoke all on function public.delete_army_unit(text, bigint) from public, anon;
revoke all on function public.publish_army_catalogue(text, text) from public, anon;
revoke all on function public.start_army_catalogue_draft(text, text) from public, anon;
revoke all on function public.save_army_edition(text, text, text[], text, text, text)
  from public, anon;

grant execute on function public.army_version_published(text) to authenticated;
grant execute on function public.save_army_faction(text, text, text, integer) to authenticated;
grant execute on function public.save_army_detachment(text, text, text, text, text[], integer)
  to authenticated;
grant execute on function public.save_army_unit(text, text, text, integer, jsonb, jsonb, integer)
  to authenticated;
grant execute on function public.delete_army_unit(text, bigint) to authenticated;
grant execute on function public.publish_army_catalogue(text, text) to authenticated;
grant execute on function public.start_army_catalogue_draft(text, text) to authenticated;
grant execute on function public.save_army_edition(text, text, text[], text, text, text)
  to authenticated;
-- `army_catalogue_writable` stays ungranted: it is the guard the others share,
-- not a thing to call.
