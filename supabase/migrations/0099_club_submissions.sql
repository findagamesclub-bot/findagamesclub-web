-- 0099 · Somebody listing a club that does not exist yet
--
-- Legacy has `create_listing_submission`: one call that builds the whole club
-- record from a form payload and files it as `payment_pending` when billing is
-- on and `review_pending` when it is not. There is no draft. The guided builder
-- holds its five steps in the browser's memory and submits at the end, so
-- closing the tab loses everything typed so far.
--
-- Two deliberate departures, both agreed with the client before this stage:
--
-- 1. **A draft that survives.** The person this flow is for is a club secretary
--    filling it in on a phone between games. Losing the lot because a call came
--    in is the worst outcome this stage has, and the row has to exist anyway.
--    `last_step` is where they were, so the resume card can say "step 3 of 5".
--
-- 2. **Sending one back.** Legacy's admin can only approve. `rejected` exists in
--    its status labels with no code that ever sets it, so a submission that is
--    nearly right sits in the queue forever. `changes_requested` carries a note
--    and hands editing back to the owner; `declined` carries a reason and ends
--    it.
--
-- Statuses otherwise match legacy's, including `cancelled`. `payment_pending`
-- is deliberately absent until Stage 5 builds billing, so nothing can currently
-- land in a state nothing can move it out of.
--
-- The payload is stored in **database shape**, not form shape: the same parse
-- that writes a live club writes this, and approving is then a mapping rather
-- than a second interpretation of what the club meant.
--
-- Checked on a throwaway Postgres: an owner drafts, edits and submits; a
-- stranger reads and writes nothing; an owner cannot edit their own submission
-- once it is with the admins, and cannot move its status by naming the column;
-- an admin reads every row.

create table if not exists public.club_submissions (
  id             bigint generated always as identity primary key,

  owner_id       uuid not null default auth.uid()
                   references public.profiles (id) on delete cascade,

  status         text not null default 'draft',

  -- Denormalised out of the payload so the admin queue can list and search
  -- without reading a jsonb blob per row. Kept in step by the same write.
  club_name      text not null default '',
  city           text not null default '',

  payload        jsonb not null default '{}'::jsonb,

  -- Which step they were on, so the resume card can name it.
  last_step      text not null default 'profile',

  -- Stage 5 fills these. Here now because the submission is what a subscription
  -- hangs off in legacy, and adding them later means rewriting approve.
  billing_required boolean not null default false,
  plan_interval    text not null default '',

  -- Set on approval. The club this became.
  club_id        bigint references public.clubs (id) on delete set null,

  submitted_at   timestamptz,
  reviewed_at    timestamptz,
  reviewed_by    uuid references public.profiles (id) on delete set null,

  -- What the admin said. A note asks for changes, a reason ends it.
  review_note    text not null default '',
  decline_reason text not null default '',

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint club_submissions_status_check check (status in (
    'draft', 'review_pending', 'changes_requested', 'approved', 'declined', 'cancelled'
  ))
);

comment on table public.club_submissions is
  'A club listing being written or reviewed. Legacy club-submissions.json.';

-- The queue, oldest first, which is the only order an admin works in.
create index if not exists club_submissions_queue_idx
  on public.club_submissions (status, submitted_at);

-- "Pick up where you left off" reads the newest draft this person has.
create index if not exists club_submissions_owner_idx
  on public.club_submissions (owner_id, updated_at desc);

-- ------------------------------------------------------------------ stamping

create or replace function public.club_submissions_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.club_submissions_stamp() from public, anon, authenticated;

drop trigger if exists club_submissions_stamped on public.club_submissions;
create trigger club_submissions_stamped
  before update on public.club_submissions
  for each row execute function public.club_submissions_stamp();

-- ------------------------------------------------------------------- access

alter table public.club_submissions enable row level security;

revoke insert, update, delete on public.club_submissions from authenticated, anon;

grant select on public.club_submissions to authenticated;

-- Everything else moves through the functions below. `status`, `club_id`,
-- `submitted_at` and the review columns are absent from both lists on purpose:
-- a status somebody can name is a status they can grant themselves.
grant insert (club_name, city, payload, last_step) on public.club_submissions to authenticated;
grant update (club_name, city, payload, last_step) on public.club_submissions to authenticated;

drop policy if exists club_submissions_read on public.club_submissions;
create policy club_submissions_read on public.club_submissions
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());

drop policy if exists club_submissions_start on public.club_submissions;
create policy club_submissions_start on public.club_submissions
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'draft');

-- Editable while it is theirs to edit, which is before they send it and again
-- after an admin sends it back. Not while it is in the queue: a submission that
-- changes under the person reviewing it is a review of something else.
drop policy if exists club_submissions_edit on public.club_submissions;
create policy club_submissions_edit on public.club_submissions
  for update to authenticated
  using (owner_id = (select auth.uid()) and status in ('draft', 'changes_requested'))
  with check (owner_id = (select auth.uid()) and status in ('draft', 'changes_requested'));

-- No delete policy. A draft is cancelled rather than removed, so an admin
-- looking at a queue entry that vanished has something to read.

-- ---------------------------------------------------------------- the owner

/**
 * Send it to the admins.
 *
 * From a draft or from one that came back. Named fields rather than the whole
 * row, because everything else here is the admin's to write.
 */
create or replace function public.submit_club_submission(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.club_submissions%rowtype;
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

  return 'review_pending';
end;
$$;

revoke all on function public.submit_club_submission(bigint) from public, anon;
grant execute on function public.submit_club_submission(bigint) to authenticated;

/**
 * Stop. Reversible only by starting again, which is the honest thing: a
 * cancelled listing that could be un-cancelled is a draft with extra steps.
 */
create or replace function public.cancel_club_submission(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.club_submissions
   where id = p_id and owner_id = (select auth.uid())
   for update;

  if v_status is null then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if v_status in ('approved', 'declined', 'cancelled') then
    raise exception 'SUBMISSION_FINISHED' using errcode = 'check_violation';
  end if;

  update public.club_submissions set status = 'cancelled' where id = p_id;
  return 'cancelled';
end;
$$;

revoke all on function public.cancel_club_submission(bigint) from public, anon;
grant execute on function public.cancel_club_submission(bigint) to authenticated;

do $$
declare bad boolean;
begin
  select bool_or(column_name is null) into bad from (
    select null::text as column_name from information_schema.role_table_grants
     where table_name = 'club_submissions'
       and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    union all
    select column_name from information_schema.role_column_grants
     where table_name = 'club_submissions'
       and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) g;
  if bad then
    raise exception 'club_submissions carries a whole-table grant';
  end if;
end $$;
