-- 0132 · An event board that still works at a thousand threads
--
-- The club board learned this in 0037 and the event board never did. It fetched
-- up to 200 threads with every reply embedded in each one and then paged them
-- in the browser: a hundred threads of two hundred replies is twenty thousand
-- rows in one payload to draw eight of them, and the two hundred and first
-- thread silently did not exist, because a `limit` is a cap and not a pager.
--
-- Same fix as 0037, same shape, same reasoning: the sort key has to exist in
-- SQL before paging can happen there. Nothing here is new thinking, which is
-- the point.
--
-- Checked on a throwaway Postgres built from every migration: the backfill
-- matches what the app was computing, a reply moves its thread up, a removed
-- reply does not move it back down, and a reply on somebody else's thread still
-- cannot be used to touch a column members have no grant on.

alter table public.club_event_board_posts
  add column if not exists last_activity_at timestamptz not null default now();

-- Backfill from what the reader was computing: the newest live reply, or the
-- thread itself when nobody has answered.
update public.club_event_board_posts p
   set last_activity_at = greatest(
     p.created_at,
     coalesce((select max(r.created_at)
                 from public.club_event_board_replies r
                where r.post_id = p.id and r.removed_at is null), p.created_at)
   );

-- The list's own order, and the only index it needs: live threads on one
-- event, newest activity first.
create index if not exists club_event_board_posts_activity_idx
  on public.club_event_board_posts (event_id, last_activity_at desc)
  where removed_at is null;

-- A thread page reads its own replies in order, so they get their own.
create index if not exists club_event_board_replies_post_idx
  on public.club_event_board_replies (post_id, created_at)
  where removed_at is null;

-- Definer for the reason 0037 gives: members have no update grant on this
-- column and should not have one. Replying is the only thing that may move a
-- thread up the board.
create or replace function public.touch_event_post_activity()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.club_event_board_posts
     set last_activity_at = greatest(last_activity_at, coalesce(new.created_at, now()))
   where id = new.post_id;
  return new;
end $$;

drop trigger if exists club_event_board_replies_touch on public.club_event_board_replies;
create trigger club_event_board_replies_touch
  after insert on public.club_event_board_replies
  for each row execute function public.touch_event_post_activity();

revoke all on function public.touch_event_post_activity() from public, anon;
