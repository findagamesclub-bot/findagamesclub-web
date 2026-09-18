-- 0103 · Telling the club what was decided
--
-- The emails for these exist. The bell does not, so somebody who asked to be
-- listed and then used the site normally had no sign anything had happened: the
-- card on their account said "Changes needed" only if they happened to look at
-- it, and the notification rail said nothing at all.
--
-- A trigger on the row rather than three more lines inside three functions.
-- `request_submission_changes`, `decline_club_submission` and
-- `approve_club_submission` all end in the same place, a status changing on this
-- table, and whatever answers a request next inherits this without anybody
-- remembering to call it. Same reasoning as 0095 for bookings.
--
-- Nobody is told about their own doing, and it runs both ways. An admin's
-- decision reaches the club; an owner taking a request back out of the queue
-- reaches the admins, because their queue just changed and nothing else would
-- say so. Submitting is the one owner action handled elsewhere, inside
-- `submit_club_submission` in 0102.
--
-- Checked on a throwaway Postgres: sending one back, approving it and declining
-- it each notify the owner once with the right words and the right link; an
-- admin answering does not notify themselves; submitting notifies nobody here;
-- and withdrawing from the queue tells the admins while stopping a draft that
-- was never sent tells nobody, because nobody was waiting on it.

create or replace function public.club_submissions_decided()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text := coalesce(nullif(btrim(new.club_name), ''), 'your club');
  v_slug  text;
  v_admin record;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- The owner acting on their own listing. Only one of those is worth telling
  -- anybody about: taking it back out of a queue somebody is working through.
  if new.owner_id = (select auth.uid()) then
    if new.status = 'cancelled'
       and old.status in ('review_pending', 'changes_requested') then
      for v_admin in
        select id from public.profiles
         where role = 'admin' and coalesce(is_active, true) and id <> new.owner_id
      loop
        perform public.notify_person(
          v_admin.id,
          'club-request-withdrawn',
          v_name || ' was taken back',
          'The club has withdrawn its request, so there is nothing left to answer.',
          '/admin/submissions',
          'club_submission', new.id::text);
      end loop;
    end if;

    return new;
  end if;

  if new.status = 'changes_requested' then
    perform public.notify_person(
      new.owner_id,
      'listing-changes-needed',
      'A couple of changes to ' || v_name,
      coalesce(nullif(btrim(new.review_note), ''),
               'Open it back up and we will tell you what to fix.'),
      '/list-your-club/' || new.id::text || '/review',
      'club_submission', new.id::text);

  elsif new.status = 'approved' then
    select slug into v_slug from public.clubs where id = new.club_id;

    perform public.notify_person(
      new.owner_id,
      'listing-approved',
      v_name || ' is live',
      'Your club is in the directory. The console is yours from here.',
      case when v_slug is not null
        then '/clubs/' || v_slug || '/manage' else '/my-clubs' end,
      'club_submission', new.id::text);

  elsif new.status = 'declined' then
    perform public.notify_person(
      new.owner_id,
      'listing-declined',
      'About your listing for ' || v_name,
      coalesce(nullif(btrim(new.decline_reason), ''),
               'We are not able to list this one.'),
      '/account/listings',
      'club_submission', new.id::text);
  end if;

  return new;
end;
$$;

revoke all on function public.club_submissions_decided() from public, anon, authenticated;

drop trigger if exists club_submissions_decided on public.club_submissions;
create trigger club_submissions_decided
  after update on public.club_submissions
  for each row execute function public.club_submissions_decided();
