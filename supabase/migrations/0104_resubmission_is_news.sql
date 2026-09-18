-- 0104 · A club answering is not the same news as a club arriving
--
-- 0102 notifies every admin when a request is submitted, keyed to the
-- submission so that a club sending the same one twice does not stack two
-- notices. That is right, and it swallowed the case it should not have: a club
-- that was sent back, made the changes and sent it again updated the admin's
-- existing unread notice in place. The count did not move, the wording did not
-- change, and from the admin's side nothing had happened.
--
-- So a resubmission gets its own kind. It is different news: the first one says
-- somebody wants to be listed, the second says somebody has done what you asked
-- and it is your turn again. Separate kinds mean separate unread rows, so the
-- badge moves even when the first notice was never read.
--
-- It also stops wiping `review_note` on the way through. See the comment at
-- the update.
--
-- Checked on a throwaway Postgres: a first submission notifies as a new
-- request; sending it back and resubmitting notifies again as an answer, on
-- its own row rather than by rewriting the first; answering twice does not
-- stack; a notice already read does not swallow the next answer; a suspended
-- admin and an ordinary member are told nothing; the note survives; and a
-- stranger still cannot submit somebody else's listing.

create or replace function public.submit_club_submission(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     public.club_submissions%rowtype;
  v_admin   record;
  v_answer  boolean;
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

  -- Read before the update, because afterwards there is no way to tell whether
  -- this club is arriving or answering.
  v_answer := v_row.status = 'changes_requested';

  -- The note is kept, unlike 0102, which wiped it here. Both owner-side
  -- readers already gate on `changes_requested`, so it was never what showed
  -- them a stale ask; clearing it only took away the reviewer's own list of
  -- what they asked for, at the moment they open it to check it was done.
  update public.club_submissions
     set status       = 'review_pending',
         submitted_at = now()
   where id = p_id;

  -- Every admin, and only admins. A suspended one is not working today, so
  -- `is_active` keeps the notice off a rail nobody is reading.
  for v_admin in
    select id from public.profiles
     where role = 'admin' and coalesce(is_active, true)
       and id <> v_row.owner_id
  loop
    if v_answer then
      perform public.notify_person(
        v_admin.id,
        'club-request-updated',
        v_row.club_name || ' has made the changes you asked for',
        'It is back in the queue and ready to look at again.',
        '/admin/submissions/' || p_id::text,
        'club_submission', p_id::text);
    else
      perform public.notify_person(
        v_admin.id,
        'club-request',
        v_row.club_name || ' is waiting to be listed',
        case when btrim(coalesce(v_row.city, '')) <> ''
          then 'In ' || v_row.city || '. Read it and approve, send it back, or decline it.'
          else 'Read it and approve, send it back, or decline it.'
        end,
        '/admin/submissions/' || p_id::text,
        'club_submission', p_id::text);
    end if;
  end loop;

  return 'review_pending';
end;
$$;

revoke all on function public.submit_club_submission(bigint) from public, anon;
grant execute on function public.submit_club_submission(bigint) to authenticated;
