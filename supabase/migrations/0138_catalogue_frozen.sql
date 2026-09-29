-- 0138 · A published version is frozen at the table, not only in the function
--
-- Two things 0133 got half right.
--
-- **It says a trigger refuses writes to a published version, and there is no
-- trigger.** The guard lives inside `army_catalogue_writable`, which every save
-- function calls, so it holds for anything coming from a screen and for nothing
-- else. A result pins `(edition_id, catalogue_version)` precisely so that a
-- republish cannot rewrite what somebody played last April, and that promise is
-- only worth what the weakest writer can do to it. This is the trigger.
--
-- **Nothing but a browser could ever fill the catalogue.** The guards ask
-- `is_admin()`, which reads `auth.uid()`; an import running on the service key
-- has none, so `scripts/import-army-catalogue.mjs` could not write a single
-- row. The service role already bypasses RLS on every table in the database, so
-- admitting it here grants it nothing it did not have. What it buys is that the
-- importer goes through the same writers the admin screens do and cannot drift
-- from them.
--
-- Checked on a throwaway Postgres built from every migration: a draft takes
-- writes, the same edition refuses them once published, the refusal names
-- itself, and a member is still refused before either question is asked.

/**
 * Is this request the service key rather than a person?
 *
 * PostgREST verifies the JWT and puts its claims in this GUC, so the role in it
 * cannot be chosen by whoever is calling. The same GUC `auth.uid()` reads, so
 * it behaves the same way in the local harness.
 */
create or replace function public.is_service_request()
returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    '') = 'service_role';
$$;

create or replace function public.army_catalogue_writable(p_edition text)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_service_request()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if public.army_version_published(p_edition) then
    raise exception 'CATALOGUE_PUBLISHED';
  end if;
end $$;

create or replace function public.save_army_edition(
  p_system text, p_system_label text, p_points text[],
  p_edition text, p_edition_label text, p_version text
) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_service_request()) then
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

/**
 * Whatever the writer, a published version is a record and not a draft.
 *
 * `army_version_published` asks whether a snapshot exists for the edition's
 * CURRENT version, so starting a new draft opens the tables again and the
 * published snapshot is untouched either way: it is a jsonb copy, not these
 * rows.
 */
create or replace function public.army_catalogue_frozen()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_edition text := coalesce(new.edition_id, old.edition_id);
begin
  if public.army_version_published(v_edition) then
    raise exception 'CATALOGUE_PUBLISHED';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists army_factions_frozen on public.army_factions;
create trigger army_factions_frozen
  before insert or update or delete on public.army_factions
  for each row execute function public.army_catalogue_frozen();

drop trigger if exists army_detachments_frozen on public.army_detachments;
create trigger army_detachments_frozen
  before insert or update or delete on public.army_detachments
  for each row execute function public.army_catalogue_frozen();

drop trigger if exists army_units_frozen on public.army_units;
create trigger army_units_frozen
  before insert or update or delete on public.army_units
  for each row execute function public.army_catalogue_frozen();

revoke all on function public.is_service_request() from public, anon;
revoke all on function public.army_catalogue_frozen() from public, anon;
grant execute on function public.is_service_request() to authenticated;
