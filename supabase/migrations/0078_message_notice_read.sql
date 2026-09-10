-- 0078 · Reading the message clears the notice about it
--
-- The rail said two, the admin read both messages, and the rail still said
-- two. A notice is a pointer to something waiting; once the thing itself has
-- been read the pointer is stale, and a count that stays up after the work is
-- done is a count people stop looking at.
--
-- A trigger rather than a line in the service, for the reason 0027 gives for
-- writing notices from triggers in the first place: a thread is marked read
-- from the account area and from the console today, and the next surface that
-- opens one would have to remember to do this too.

create or replace function public.clear_message_notice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- The pair columns are sorted, so the other person is whichever of the two
  -- is not the reader.
  other uuid := case when new.pair_low = new.profile_id
                     then new.pair_high else new.pair_low end;
begin
  update public.notifications
     set read_at = now()
   where profile_id = new.profile_id
     and entity_type = 'thread'
     -- The key notify_on_message deduped on: the club, or 0 for the site.
     and entity_id = coalesce(new.club_id::text, '0') || ':' || other
     and read_at is null;
  return new;
end;
$$;

drop trigger if exists club_message_reads_clear_notice on public.club_message_reads;
create trigger club_message_reads_clear_notice
  after insert or update on public.club_message_reads
  for each row execute function public.clear_message_notice();

-- Threads read before this existed. The watermark has to be at or after the
-- notice: an older one means the thread was read and then written to again,
-- which is exactly the case the notice is still standing for.
update public.notifications n
   set read_at = now()
  from public.club_message_reads r
 where n.read_at is null
   and n.entity_type = 'thread'
   and r.profile_id = n.profile_id
   and r.read_at >= n.created_at
   and n.entity_id = coalesce(r.club_id::text, '0') || ':' ||
       case when r.pair_low = r.profile_id then r.pair_high else r.pair_low end;

-- The badge is drawn by the shell, which renders before the page below it
-- marks the thread read, so it cannot learn about this on its own. Published
-- so the browser can hear the write and recount. RLS still applies: the select
-- policy on this table is the reader's own rows and nothing else.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'club_message_reads'
  ) then
    execute 'alter publication supabase_realtime add table public.club_message_reads';
  end if;
end $$;
