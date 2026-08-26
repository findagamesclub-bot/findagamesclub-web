-- Messages arrive without a reload.
--
-- Realtime respects RLS on postgres_changes: a subscriber is only sent a row
-- their SELECT policy would return. club_messages_select is already
-- sender_id = auth.uid() or recipient_id = auth.uid(), so publishing the table
-- does not widen who can read what — it only changes when they learn about it.
alter publication supabase_realtime add table public.club_messages;

-- Default replica identity carries the whole new row on INSERT, which is all
-- the client needs. FULL would only matter for UPDATE and DELETE payloads and
-- costs WAL volume on every write.
alter table public.club_messages replica identity default;
