-- 0087 · Somewhere to put a club's photos
--
-- Uploaded straight from the browser to storage, like the board's photos in
-- 0036, and for the same reason: a Server Action body is capped at 1MB and a
-- phone photo is several times that before it is downscaled.
--
-- The difference is who may write. A board photo goes under the member's own
-- id, so the policy asks whether the first folder is theirs. A club photo goes
-- under the club's, so the policy has to ask whether they run that club, which
-- is `club_can(..., 'listing.edit')` reading the id out of the path.
--
-- Paths are `clubs/<club id>/<kind>/<uuid>.<ext>`, so folder 1 is always
-- "clubs" and folder 2 is the club. Anything else in the bucket matches no
-- policy and cannot be written at all.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'club-media',
  'club-media',
  -- Public read. These are the pictures on a public club page; signing them
  -- would put an expiry on the header art of a listing meant to sit there for
  -- years, and the directory would have to sign a URL per card.
  true,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- A helper rather than the same expression four times. `foldername` returns
-- the path's folders, so [2] is the club id; a path that is not shaped like a
-- club's comes back null and every policy below refuses it.
create or replace function public.club_media_club(name text)
returns bigint
language sql
immutable
as $$
  select case
    when (storage.foldername(name))[1] = 'clubs'
     and (storage.foldername(name))[2] ~ '^[0-9]+$'
    then ((storage.foldername(name))[2])::bigint
  end;
$$;

drop policy if exists club_media_insert on storage.objects;
create policy club_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-media'
    and public.club_can(public.club_media_club(name), 'listing.edit')
  );

drop policy if exists club_media_update on storage.objects;
create policy club_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club-media'
    and public.club_can(public.club_media_club(name), 'listing.edit')
  );

-- Removing a photo removes the file. Without this a deleted photo leaves an
-- orphan nobody can see and nobody can delete.
drop policy if exists club_media_delete on storage.objects;
create policy club_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-media'
    and public.club_can(public.club_media_club(name), 'listing.edit')
  );

drop policy if exists club_media_read on storage.objects;
create policy club_media_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'club-media');

-- ------------------------------------------------------------------- images

-- Beside the legacy `src`, not instead of it. Eleven clubs were imported with
-- absolute URLs to files nobody here owns, and rewriting those is not this
-- stage's job. One mapper resolves whichever is set.
alter table public.club_images
  add column if not exists storage_path text;

alter table public.clubs
  add column if not exists logo_path text;

grant insert (storage_path), update (storage_path) on public.club_images to authenticated;
grant update (logo_path) on public.clubs to authenticated;

-- Ten photos, counted in the database rather than in the form. The form is
-- where somebody is told; this is what makes it true.
create or replace function public.club_images_cap()
returns trigger
language plpgsql
as $$
declare
  held integer;
begin
  select count(*) into held from public.club_images where club_id = new.club_id;
  if held >= 10 then
    raise exception 'TOO_MANY_IMAGES';
  end if;
  return new;
end;
$$;

drop trigger if exists club_images_cap on public.club_images;
create trigger club_images_cap
  before insert on public.club_images
  for each row execute function public.club_images_cap();

revoke all on function public.club_media_club(text) from public, anon;
grant execute on function public.club_media_club(text) to authenticated, anon;
