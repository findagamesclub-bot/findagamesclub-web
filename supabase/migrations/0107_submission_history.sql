-- 0107 · What was asked, every time it was asked
--
-- `review_note` is one column and every "send it back" overwrites it, so a
-- listing that went round three times shows the third note and nothing else.
-- An admin opening it cannot see what they asked for the first two times, which
-- is the one thing worth knowing on a listing that keeps coming back: whether
-- the club is working through the list or going in circles. The club cannot see
-- it either, so "you have already been told this twice" is a thing only one
-- side could ever know, and neither side could.
--
-- A column cannot hold that. This is a log: one row per thing that happened,
-- kept forever, never edited. `review_note` stays as the current ask, because
-- the builder and the "back for another look" chip both read it and it is
-- genuinely a different question from "what has happened here".
--
-- Written by a trigger rather than by the three review functions, for the same
-- reason the loyalty awards and the booking notices are: the status moves in
-- five places today and will move in more, and a log with a hole in it is worse
-- than no log because it reads as complete.
--
-- Checked on a throwaway Postgres: submitting, sending back, resubmitting,
-- sending back again and declining leaves five rows in order with the right
-- words on each; approving and cancelling are logged too; starting again is
-- logged against the new listing; a member reads only their own; an admin reads
-- every one; nobody can write, edit or delete a row, including an admin.

create table if not exists public.club_submission_events (
  id            bigint generated always as identity primary key,

  submission_id bigint not null
                  references public.club_submissions (id) on delete cascade,

  -- What happened, in the vocabulary of the status it moved to. `restarted` is
  -- the one that is not a status: it marks a listing begun from one that ended.
  kind          text not null,

  -- The admin's own words where there were any. Empty for the moves that carry
  -- none, like sending it in.
  body          text not null default '',

  -- Who did it. Null for anything the system does on its own.
  actor_id      uuid references public.profiles (id) on delete set null,

  created_at    timestamptz not null default now(),

  constraint club_submission_events_kind_check check (kind in (
    'submitted', 'changes_requested', 'approved', 'declined', 'cancelled', 'restarted'
  ))
);

comment on table public.club_submission_events is
  'Everything that has happened to a listing, in order. Append only.';

-- Always read as one listing's history, oldest first.
create index if not exists club_submission_events_story_idx
  on public.club_submission_events (submission_id, id);

alter table public.club_submission_events enable row level security;

-- Nobody writes. The trigger below is the only writer and it is a definer, so
-- it does not need a grant of its own.
revoke insert, update, delete on public.club_submission_events from authenticated, anon;
grant select on public.club_submission_events to authenticated;

-- The same reach as the listing itself: its owner, or an admin. A history is
-- not more public than the thing it is about.
drop policy if exists club_submission_events_read on public.club_submission_events;
create policy club_submission_events_read on public.club_submission_events
  for select to authenticated
  using (exists (
    select 1 from public.club_submissions s
     where s.id = submission_id
       and (s.owner_id = (select auth.uid()) or public.is_admin())
  ));

/**
 * Log what just happened.
 *
 * On insert, only a listing started again from one that ended is worth a line:
 * a blank draft is not an event, it is somebody opening a form.
 */
create or replace function public.club_submissions_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := '';
begin
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

  -- The words belong to the move that carried them, so they are read from the
  -- row as it is now rather than from whatever is there next time.
  if new.status = 'changes_requested' then
    v_body := coalesce(new.review_note, '');
  elsif new.status = 'declined' then
    v_body := coalesce(new.decline_reason, '');
  end if;

  insert into public.club_submission_events (submission_id, kind, body, actor_id)
  values (new.id,
          case when new.status = 'review_pending' then 'submitted' else new.status end,
          v_body,
          (select auth.uid()));

  return new;
end;
$$;

revoke all on function public.club_submissions_log() from public, anon, authenticated;

drop trigger if exists club_submissions_logged on public.club_submissions;
create trigger club_submissions_logged
  after insert or update of status on public.club_submissions
  for each row execute function public.club_submissions_log();

-- Everything that happened before this migration, as far as the columns can
-- say. One line per listing rather than a story, because a single `review_note`
-- cannot be unwound into the three it replaced. Honest about being partial: it
-- is what is knowable, not a reconstruction.
insert into public.club_submission_events (submission_id, kind, body, actor_id, created_at)
select s.id,
       case when s.status = 'review_pending' then 'submitted' else s.status end,
       case when s.status = 'changes_requested' then coalesce(s.review_note, '')
            when s.status = 'declined' then coalesce(s.decline_reason, '')
            else '' end,
       s.reviewed_by,
       coalesce(s.reviewed_at, s.submitted_at, s.updated_at)
  from public.club_submissions s
 where s.status <> 'draft'
   and not exists (select 1 from public.club_submission_events e
                    where e.submission_id = s.id);

do $$
declare v_bad boolean;
begin
  select bool_or(column_name is null) into v_bad
  from (select null::text as column_name from information_schema.role_table_grants
         where table_name = 'club_submission_events' and grantee in ('authenticated', 'anon')
           and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
        union all
        select column_name from information_schema.role_column_grants
         where table_name = 'club_submission_events' and grantee in ('authenticated', 'anon')
           and privilege_type in ('INSERT', 'UPDATE', 'DELETE')) g;

  if v_bad is not null then
    raise exception 'club_submission_events must not be writable by authenticated or anon';
  end if;
end $$;
