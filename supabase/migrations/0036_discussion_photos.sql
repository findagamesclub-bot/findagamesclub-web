-- 0036 · Photos on discussion posts
--
-- Two at most, which is the client's limit and a sensible one: a board post is
-- a conversation, not an album, and the club gallery already exists for the
-- other thing.
--
-- The files live in Supabase Storage rather than the database. Only the paths
-- are stored here, so a post carries no bytes and the list query stays cheap.

alter table public.club_discussion_posts
  add column if not exists images jsonb not null default '[]'::jsonb;

-- Two, enforced where it cannot be got round. The form limits it as well, but
-- a limit that only exists in a form is a suggestion.
alter table public.club_discussion_posts
  drop constraint if exists club_discussion_posts_image_limit;
alter table public.club_discussion_posts
  add constraint club_discussion_posts_image_limit
  check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 2);

-- ------------------------------------------------------------------ storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'discussion-photos',
  'discussion-photos',
  -- Public read. The board itself is members-only, but the images are served
  -- straight from storage by the browser, and signing every URL would put an
  -- expiry on a photo that is meant to sit in a thread for years.
  true,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone signed in may put a file under their own folder, and nobody else's.
-- The path is <profile id>/<file>, so the first segment is the owner.
drop policy if exists discussion_photos_insert on storage.objects;
create policy discussion_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'discussion-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists discussion_photos_update on storage.objects;
create policy discussion_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'discussion-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Deleting your own, so a photo attached by mistake can be taken back.
drop policy if exists discussion_photos_delete on storage.objects;
create policy discussion_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'discussion-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists discussion_photos_read on storage.objects;
create policy discussion_photos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'discussion-photos');

-- ------------------------------------------------------------------- grants

-- 0017 granted insert column by column, so a new column is refused until it is
-- named here. Nothing else about the row becomes writable.
grant insert (images) on public.club_discussion_posts to authenticated;
