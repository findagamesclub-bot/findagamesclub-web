-- 0154 · The published versions an admin can look back at
--
-- Every publish has always been kept. `army_catalogue_snapshots` freezes the
-- whole catalogue as jsonb against `(edition_id, catalogue_version)` with the
-- date, the note and who pressed the button, and 0133's trigger refuses any
-- write to a version that is in there. That is what makes a game recorded last
-- April still read the way it was played.
--
-- What was missing was a way to look. `/admin/catalogue` shows the edition's
-- current version and nothing else, so an admin who published twice had no
-- route back to the first, and the client asked the obvious question: where did
-- it go. Nowhere. It just had no screen.
--
-- Two reads, both admin only. One lists the versions with how much is pinned to
-- each, because "can I retire this" is the question an admin actually has. The
-- other hands back one frozen catalogue so it can be read.
--
-- Counting rather than joining the jsonb out: a snapshot is about 936 KB, and a
-- list of six versions must not be six megabytes to answer "when was this
-- published".
--
-- Checked on a throwaway Postgres built from every migration: a published
-- version is listed with its own faction and unit counts read out of the
-- snapshot, a list and a result pinned to it are counted, the edition's current
-- version is flagged, a draft is not listed at all, and a member gets nothing
-- from either function.

/**
 * Every published version, newest first, with what is pinned to it.
 *
 * `is_current` rather than making the caller compare: the edition's own
 * `catalogue_version` is what new work pins to, and an admin reading this list
 * wants to know which row that is without holding two values in their head.
 */
create or replace function public.admin_catalogue_versions()
returns table (
  edition_id        text,
  edition_label     text,
  catalogue_version text,
  note              text,
  published_at      timestamptz,
  published_by      text,
  factions          integer,
  units             integer,
  lists             bigint,
  results           bigint,
  is_current        boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    s.edition_id,
    e.label,
    s.catalogue_version,
    s.note,
    s.published_at,
    coalesce(nullif(btrim(p.full_name), ''), 'An administrator'),
    -- Counted out of the snapshot, so the figures describe the version rather
    -- than whatever the draft has grown to since.
    coalesce(jsonb_array_length(s.catalogue -> 'systems' -> 0 -> 'factions'), 0),
    coalesce((
      select sum(jsonb_array_length(f -> 'units'))::integer
        from jsonb_array_elements(s.catalogue -> 'systems' -> 0 -> 'factions') f), 0),
    (select count(*) from public.army_list_versions v
      where v.edition_id = s.edition_id and v.catalogue_version = s.catalogue_version),
    (select count(*) from public.game_result_armies g
      where g.edition_id = s.edition_id and g.catalogue_version = s.catalogue_version),
    e.catalogue_version = s.catalogue_version
  from public.army_catalogue_snapshots s
  join public.army_editions e on e.id = s.edition_id
  left join public.profiles p on p.id = s.published_by
  order by s.published_at desc, s.catalogue_version desc;
end;
$$;

/** One frozen catalogue, for reading. The whole jsonb, so ask for it by name. */
create or replace function public.admin_catalogue_snapshot(
  p_edition text, p_version text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_catalogue jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select catalogue into v_catalogue
    from public.army_catalogue_snapshots
   where edition_id = p_edition and catalogue_version = p_version;

  return v_catalogue;
end;
$$;

revoke all on function public.admin_catalogue_versions() from public, anon;
revoke all on function public.admin_catalogue_snapshot(text, text) from public, anon;
grant execute on function public.admin_catalogue_versions() to authenticated;
grant execute on function public.admin_catalogue_snapshot(text, text) to authenticated;
