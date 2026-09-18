-- 0105 · A notice about something already dealt with is noise
--
-- The bell says how many things are waiting on you. Everything about a club
-- request breaks that promise the moment somebody acts:
--
--   · An admin approves a request and their own "waiting to be listed" notice
--     stays unread until they go and click it. Two admins, and the one who did
--     not act is carrying a red dot for work that is finished.
--   · A club makes the changes we asked for and "a couple of changes to X" is
--     still sitting on their bell, asking for something they have just done.
--
-- So when a submission leaves the queue, the notices that asked somebody to
-- look at it are marked read; and when it goes back into the queue, the notice
-- that asked the club to fix it is marked read. Read, not deleted, because
-- /account/notifications is the record of what happened.
--
-- Only the two "please look at this" kinds are cleared on the way out, never
-- the decision notices, which is what keeps this from undoing 0103's work in
-- the same statement: 0103 writes 'listing-changes-needed' and
-- 'club-request-withdrawn' on the same update this trigger fires on, and
-- neither is in the list.
--
-- Checked on a throwaway Postgres: approving clears both admins' unread
-- requests and leaves the owner's approval notice alone; sending one back
-- clears the admins' and leaves the owner's new one unread; resubmitting
-- clears the owner's changes notice and leaves the admin's fresh one; a notice
-- about a different submission is never touched.

create or replace function public.club_submissions_answered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'review_pending' then
    -- The club has done what was asked. Leaving it up asks again.
    update public.notifications
       set read_at = now()
     where profile_id = new.owner_id
       and kind = 'listing-changes-needed'
       and entity_type = 'club_submission'
       and entity_id = new.id::text
       and read_at is null;

  else
    -- It has left the queue, whoever moved it. Nobody needs to look now.
    update public.notifications
       set read_at = now()
     where kind in ('club-request', 'club-request-updated')
       and entity_type = 'club_submission'
       and entity_id = new.id::text
       and read_at is null;
  end if;

  return new;
end;
$$;

revoke all on function public.club_submissions_answered() from public, anon, authenticated;

drop trigger if exists club_submissions_answered on public.club_submissions;
create trigger club_submissions_answered
  after update of status on public.club_submissions
  for each row execute function public.club_submissions_answered();
