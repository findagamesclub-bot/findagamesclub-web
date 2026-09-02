-- 0060 · The event board without a reload
--
-- An event board is a conversation on the day: somebody asks when round two
-- starts and wants the answer, not a page they have to keep refreshing.
--
-- Realtime respects RLS on postgres_changes, so a subscriber is only sent a
-- row their SELECT policy would return. Those policies are
-- can_access_event_board(), added in 0059, so publishing these tables does not
-- widen who can read what. It only changes when they find out.
alter publication supabase_realtime add table public.club_event_board_posts;
alter publication supabase_realtime add table public.club_event_board_replies;

-- Default replica identity carries the whole new row on INSERT, which is all
-- the client needs to know something happened. A removal is an UPDATE, and the
-- default identity still sends the key, which is enough to trigger a refetch.
alter table public.club_event_board_posts   replica identity default;
alter table public.club_event_board_replies replica identity default;
