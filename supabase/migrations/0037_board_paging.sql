-- 0037 · A board that still works at a thousand threads
--
-- The board sorted by "last thing said in this thread", which was worked out in
-- the app after fetching every row. That is fine at four threads and wrong at a
-- thousand: paging cannot be done in SQL if the sort key does not exist there.
--
-- So the key becomes a column, kept up to date by a trigger on replies.

alter table public.club_discussion_posts
  add column if not exists last_activity_at timestamptz not null default now();

-- Backfill from what the app was computing: the newest live reply, or the post.
update public.club_discussion_posts p
   set last_activity_at = greatest(
     p.created_at,
     coalesce((select max(r.created_at)
                 from public.club_discussion_replies r
                where r.post_id = p.id and r.removed_at is null), p.created_at)
   );

create index if not exists club_discussion_posts_activity_idx
  on public.club_discussion_posts (club_id, last_activity_at desc);

-- Security definer because members have no update grant on this column, and
-- should not: replying is the only thing that may move a thread up the board.
create or replace function public.touch_post_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.club_discussion_posts
     set last_activity_at = greatest(last_activity_at, coalesce(new.created_at, now()))
   where id = new.post_id;
  return new;
end;
$$;

drop trigger if exists club_discussion_replies_touch on public.club_discussion_replies;
create trigger club_discussion_replies_touch
  after insert on public.club_discussion_replies
  for each row execute function public.touch_post_activity();

-- Search reads title and body with ILIKE. Trigram indexes make that an index
-- scan rather than a sequential one on every keystroke.
create extension if not exists pg_trgm;

create index if not exists club_discussion_posts_title_trgm
  on public.club_discussion_posts using gin (title gin_trgm_ops);
create index if not exists club_discussion_posts_content_trgm
  on public.club_discussion_posts using gin (content gin_trgm_ops);
