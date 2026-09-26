-- 0115 · The history has to know about waiting to pay
--
-- 0112 added `payment_pending` to the statuses a listing can hold. 0107's
-- append-only log did not hear about it: its `kind` check lists six words and
-- its trigger passes `new.status` straight through as the kind for anything
-- that is not `review_pending`. So the first thing a club did after billing was
-- switched on was fail.
--
-- It failed all the way. The insert is inside the same transaction as the
-- status update, so the refusal took the whole submission with it: no listing,
-- no subscription, and "Could not save that. Try again." every time they
-- pressed the button. With billing on, nobody could list a club at all.
--
-- Two fixes, and the second is the one that matters. Adding the word stops
-- today's failure. Mapping the kind explicitly stops the next one: a status the
-- log has never heard of now writes no row instead of raising, because a gap in
-- a history is a bad day and a club that cannot list is a lost customer. The
-- log is there to record what happened, and it has no business deciding whether
-- what happened is allowed.
--
-- Checked on a throwaway Postgres: submitting with billing on lands in
-- payment_pending and writes one `payment_pending` event; paying moves it to
-- review_pending and writes `submitted`; a status outside the list writes
-- nothing and does not raise; and the five older kinds are unchanged.

alter table public.club_submission_events
  drop constraint if exists club_submission_events_kind_check;

alter table public.club_submission_events
  add constraint club_submission_events_kind_check check (kind in (
    'submitted', 'payment_pending', 'changes_requested', 'approved',
    'declined', 'cancelled', 'restarted'
  ));

create or replace function public.club_submissions_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := '';
  v_kind text;
begin
  -- 0107's insert branch, unchanged: a listing started again names the one it
  -- came from, and nothing else about a new row is news.
  if tg_op = 'INSERT' then
    if new.restarted_from is not null then
      insert into public.club_submission_events (submission_id, kind, body, actor_id)
      values (new.id, 'restarted',
              'Started again from listing #' || new.restarted_from::text,
              (select auth.uid()));
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Named one at a time. `new.status` went in raw before, which made every
  -- status the log did not know about a refusal, and a refusal here rolls back
  -- the move that caused it.
  v_kind := case new.status
              when 'review_pending'    then 'submitted'
              when 'payment_pending'   then 'payment_pending'
              when 'changes_requested' then 'changes_requested'
              when 'approved'          then 'approved'
              when 'declined'          then 'declined'
              when 'cancelled'         then 'cancelled'
              else null
            end;

  if v_kind is null then return new; end if;

  -- The words belong to the move that carried them, so they are read from the
  -- row as it is now rather than from whatever is there next time.
  if new.status = 'changes_requested' then
    v_body := coalesce(new.review_note, '');
  elsif new.status = 'declined' then
    v_body := coalesce(new.decline_reason, '');
  end if;

  insert into public.club_submission_events (submission_id, kind, body, actor_id)
  values (new.id, v_kind, v_body, (select auth.uid()));

  return new;
end;
$$;

revoke all on function public.club_submissions_log() from public, anon, authenticated;
