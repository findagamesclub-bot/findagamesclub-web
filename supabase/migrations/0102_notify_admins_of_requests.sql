-- 0102 · Telling the admins a club is waiting
--
-- 0099's `submit_club_submission` files the request and nothing else. The
-- email to the platform contact address exists, but an email is a different
-- thing from a badge on the rail: an admin who lives in the console gets no
-- sign at all that somebody is waiting, and the queue is only found by
-- remembering to open it. That is how a listing sits for a fortnight.
--
-- Written here rather than in the service for the reason every other notice in
-- this app is: it fires inside the same transaction as the write, so a request
-- that reached the queue cannot fail to be announced, and any later way of
-- submitting one inherits it without anybody remembering to call something.
--
-- One notice per admin, keyed to the submission, so resubmitting after changes
-- updates the existing unread one rather than stacking a second. That is what
-- `notify_person`'s conflict target already does; this just uses it.
--
-- Checked on a throwaway Postgres: submitting notifies every admin and nobody
-- else; resubmitting the same listing leaves one unread notice rather than two;
-- and the submitter is not told about their own doing.

create or replace function public.submit_club_submission(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   public.club_submissions%rowtype;
  v_admin record;
begin
  select * into v_row from public.club_submissions
   where id = p_id and owner_id = (select auth.uid())
   for update;

  if v_row.id is null then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if v_row.status not in ('draft', 'changes_requested') then
    raise exception 'SUBMISSION_NOT_EDITABLE' using errcode = 'check_violation';
  end if;

  if btrim(coalesce(v_row.club_name, '')) = '' then
    raise exception 'SUBMISSION_NEEDS_NAME' using errcode = 'check_violation';
  end if;

  if btrim(coalesce(v_row.city, '')) = '' then
    raise exception 'SUBMISSION_NEEDS_CITY' using errcode = 'check_violation';
  end if;

  update public.club_submissions
     set status       = 'review_pending',
         submitted_at = now(),
         -- The note was about the last version. Leaving it would show the
         -- reviewer their own words back as though they still applied.
         review_note  = ''
   where id = p_id;

  -- Every admin, and only admins. A suspended one is not working today, so
  -- `is_active` keeps the notice off a rail nobody is reading.
  for v_admin in
    select id from public.profiles
     where role = 'admin' and coalesce(is_active, true)
       and id <> v_row.owner_id
  loop
    perform public.notify_person(
      v_admin.id,
      'club-request',
      v_row.club_name || ' is waiting to be listed',
      case when btrim(coalesce(v_row.city, '')) <> ''
        then 'In ' || v_row.city || '. Read it and approve, send it back, or decline it.'
        else 'Read it and approve, send it back, or decline it.'
      end,
      '/admin/submissions/' || p_id::text,
      'club_submission',
      p_id::text);
  end loop;

  return 'review_pending';
end;
$$;

revoke all on function public.submit_club_submission(bigint) from public, anon;
grant execute on function public.submit_club_submission(bigint) to authenticated;
