-- 0160 · Somewhere to put a photo before the club exists
--
-- 0087 built the bucket and allowed exactly one shape of path,
-- `clubs/<club id>/<kind>/<uuid>`, with the policy reading the id out of
-- folder 2 and asking `club_can(..., 'listing.edit')`. That is right for a
-- club that exists. A listing being written has no club and no id, so there
-- was nowhere at all a photo could go, and the builder said so in words:
-- "Photos are added once your club is live." An admin then approved a listing
-- having never seen a picture of it, which is the half the client minded.
--
-- Everything downstream was already built for this. `contentReading` reads the
-- photo fields, `submissions.service` carries them in the payload, and 0100
-- inserts `club_images` from `payload -> 'images'` with their storage paths.
-- Its own comment says the rows "point there until the action that called this
-- moves the objects across and rewrites the paths". The path it names is this
-- one. The policy that would have let anybody write it was never added.
--
-- Paths are `submissions/<submission id>/<kind>/<uuid>.<ext>`, so folder 1 is
-- "submissions" and folder 2 is the submission. Anything else in the bucket
-- still matches no policy and cannot be written.

-- The submission id out of the path, or null for a path that is not shaped
-- like one, which makes every policy below refuse it. Mirrors
-- `club_media_club` in 0087 rather than inventing a second shape.
create or replace function public.submission_media_id(name text)
returns bigint
language sql
immutable
as $$
  select case
    when (storage.foldername(name))[1] = 'submissions'
     and (storage.foldername(name))[2] ~ '^[0-9]+$'
    then ((storage.foldername(name))[2])::bigint
  end;
$$;

/**
 * Whether the caller may put a file against this submission.
 *
 * The same question `club_submissions_edit` asks, in the same words: theirs,
 * and before they send it or after an admin sends it back. A submission in the
 * queue is deliberately frozen, because photos that change under the person
 * reviewing them are a review of something else.
 *
 * Invoker, so the subquery runs under `club_submissions_select` and an owner
 * reading their own row is what makes it true. That is not the trap 0122 hit:
 * this decides whether a write is allowed, it does not perform one.
 */
create or replace function public.submission_media_writable(name text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from public.club_submissions s
     where s.id = public.submission_media_id(name)
       and s.owner_id = (select auth.uid())
       and s.status in ('draft', 'changes_requested')
  );
$$;

drop policy if exists submission_media_insert on storage.objects;
create policy submission_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-media'
    and public.submission_media_writable(name)
  );

drop policy if exists submission_media_update on storage.objects;
create policy submission_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club-media'
    and public.submission_media_writable(name)
  );

-- Taking a photo off a listing takes the file with it, the same as 0087. Without
-- this a removed photo leaves a file nobody can see and nobody can delete.
drop policy if exists submission_media_delete on storage.objects;
create policy submission_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-media'
    and public.submission_media_writable(name)
  );

-- No read policy, because 0087 already grants one for the whole bucket. So a
-- listing's photos are public from the moment they are uploaded, which is how
-- the admin sees them on the review screen without a signed URL per picture.
-- They are photographs somebody is asking us to put in a public directory, and
-- the file name is a uuid, so this is the same exposure as an approved club's.

revoke all on function public.submission_media_id(text) from public, anon;
revoke all on function public.submission_media_writable(text) from public, anon;
grant execute on function public.submission_media_id(text) to authenticated, anon;
grant execute on function public.submission_media_writable(text) to authenticated, anon;

-- ----------------------------------------------------------------- the logo

/**
 * Set or clear a club's logo.
 *
 * `ClubLogo` draws one in about twenty places and has since Stage 1, reading
 * `clubs.logo_url` — the absolute URL eleven clubs were imported with. 0087
 * added `clubs.logo_path` for one we host and granted the owner update on it,
 * and then nothing ever wrote it: there was no logo control in the builder at
 * all, which is what the client found.
 *
 * A function rather than the column grant 0087 left, because clearing a logo
 * has to retire the legacy URL in the same breath. Otherwise an imported club
 * removes its logo, the row's `logo_path` goes empty, the mapper falls back to
 * `logo_url`, and the logo they just deleted is still on every card. Granting
 * `update (logo_url)` instead would let a club point its logo at any address
 * on the internet, which is a tracking pixel on a public page.
 *
 * Once a club has touched its logo here, ours is the only answer.
 */
create or replace function public.set_club_logo(p_club bigint, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.club_can(p_club, 'listing.edit') and not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  update public.clubs
     set logo_path = nullif(btrim(coalesce(p_path, '')), ''),
         -- Retired the moment a club manages its own, whether that is a new
         -- file or none at all.
         logo_url  = null
   where id = p_club;

  if not found then
    raise exception 'CLUB_NOT_FOUND' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.set_club_logo(bigint, text) from public, anon;
grant execute on function public.set_club_logo(bigint, text) to authenticated;

-- The column grant 0087 left behind is now the wrong way in: it would let a
-- club set a path into somebody else's folder, which the function refuses by
-- never taking a club id it has not checked.
revoke update (logo_path) on public.clubs from authenticated;
