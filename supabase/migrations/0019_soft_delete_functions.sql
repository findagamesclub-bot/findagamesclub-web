-- Removing a post or a reply moves through a function, not an UPDATE.
--
-- The two policies 0017 wrote could never both be satisfied:
--
--   select ... using      (removed_at is null)
--   update ... with check (removed_at is not null)
--
-- A successful soft delete produces a row the SELECT policy forbids. Postgres
-- applies SELECT policies to the new row of an UPDATE that returns anything,
-- and PostgREST always asks for the updated row, so every removal failed with
-- "new row violates row-level security policy" — including the author removing
-- their own reply.
--
-- Relaxing the SELECT policy would fix it by making removed content readable
-- again, which is the opposite of what removal is for. So the write happens in
-- a definer function instead: authorisation lives in one place, the SELECT
-- policy stays strict, and removed rows stay genuinely unreadable.

create or replace function public.remove_discussion_post(target bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  row_club bigint;
  row_author uuid;
begin
  if actor is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;

  select club_id, author_profile_id into row_club, row_author
    from public.club_discussion_posts
   where id = target and removed_at is null
   for update;

  if row_club is null then
    raise exception 'NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- The author takes their own thread down; the club takes anyone's down.
  if row_author <> actor and not public.can_manage_club(row_club) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  update public.club_discussion_posts
     set removed_at = now(), removed_by = actor, updated_at = now()
   where id = target;

  return target;
end;
$$;

create or replace function public.remove_discussion_reply(target bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  row_post bigint;
  row_author uuid;
  row_club bigint;
begin
  if actor is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;

  select r.post_id, r.author_profile_id, p.club_id
    into row_post, row_author, row_club
    from public.club_discussion_replies r
    join public.club_discussion_posts p on p.id = r.post_id
   where r.id = target and r.removed_at is null
   for update of r;

  if row_post is null then
    raise exception 'NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if row_author <> actor and not public.can_manage_club(row_club) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  update public.club_discussion_replies
     set removed_at = now(), removed_by = actor
   where id = target;

  return row_post;
end;
$$;

revoke all on function public.remove_discussion_post(bigint) from public, anon;
revoke all on function public.remove_discussion_reply(bigint) from public, anon;
grant execute on function public.remove_discussion_post(bigint) to authenticated;
grant execute on function public.remove_discussion_reply(bigint) to authenticated;

-- The direct write is now unreachable and unnecessary.
drop policy if exists club_discussion_posts_remove   on public.club_discussion_posts;
drop policy if exists club_discussion_replies_remove on public.club_discussion_replies;

revoke update on public.club_discussion_posts   from authenticated;
revoke update on public.club_discussion_replies from authenticated;
