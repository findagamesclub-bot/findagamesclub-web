-- 0106 · Starting again should not mean typing it all again
--
-- 0099 says a cancelled listing is "reversible only by starting again, which is
-- the honest thing", and that reasoning holds for a declined one too: an admin
-- said no, with a reason, on a date, and a row that could quietly become a
-- draft again would erase that. What it did not do is give anybody a way to
-- start again. A declined listing offers no action at all, so the only route
-- back is an empty builder and thirteen fields, plus games, pricing and a
-- schedule, typed a second time from memory. That is not a decision anybody
-- took; it is what was left over.
--
-- So starting again is a real thing now: a new draft carrying everything they
-- wrote, with the old row left exactly as it is. The record of the decline
-- survives, the work survives, and the two are not the same row.
--
-- `restarted_from` is what makes the second attempt visible. Without it an
-- admin reading the queue cannot tell a new club from one they turned down
-- last week, and the reason they turned it down is the single most useful
-- thing to have in front of them. It also stops a double press making two
-- drafts, since a live restart of the same listing is returned rather than
-- made again.
--
-- Checked on a throwaway Postgres: an owner restarts a declined listing and a
-- cancelled one and gets every field back; pressing twice returns the same
-- draft rather than a second; the old row is untouched; a draft, a queued one
-- and an approved one all refuse; a stranger cannot restart somebody else's;
-- and the new draft can be submitted and notifies the admins as a fresh
-- request.

alter table public.club_submissions
  add column if not exists restarted_from bigint
    references public.club_submissions (id) on delete set null;

comment on column public.club_submissions.restarted_from is
  'The finished listing this one was started again from. Read by the admin so a second attempt says so.';

-- Not in the insert or update grants. A club naming its own predecessor could
-- hang a fresh draft off somebody else''s declined listing and put that
-- reason on the reviewer''s screen. The function below is the only writer.

-- Reading "has anybody restarted this one" happens on every restart, and the
-- column is null on almost every row, so the index only covers the ones set.
create index if not exists club_submissions_restarted_idx
  on public.club_submissions (restarted_from)
  where restarted_from is not null;

/**
 * Start again from a finished listing.
 *
 * Only from one that is over: declined by us, or stopped by them. A draft is
 * already editable, one in the queue is being read, and an approved one is a
 * club now.
 */
create or replace function public.restart_club_submission(p_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.club_submissions%rowtype;
  v_new bigint;
begin
  select * into v_row from public.club_submissions
   where id = p_id and owner_id = (select auth.uid())
   for update;

  if v_row.id is null then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if v_row.status not in ('declined', 'cancelled') then
    raise exception 'SUBMISSION_NOT_RESTARTABLE' using errcode = 'check_violation';
  end if;

  -- Already started again, and that one is still going. Two drafts of the same
  -- club is the double press, not a second attempt, and the second would bury
  -- whatever they had already changed in the first.
  select id into v_new from public.club_submissions
   where restarted_from = p_id
     and owner_id = v_row.owner_id
     and status in ('draft', 'changes_requested', 'review_pending')
   order by id desc
   limit 1;

  if v_new is not null then
    return v_new;
  end if;

  -- Everything they wrote, and nothing the admin did. The note and the reason
  -- belong to the attempt that ended, not to this one.
  insert into public.club_submissions
    (owner_id, club_name, city, payload, last_step, restarted_from)
  values
    (v_row.owner_id, v_row.club_name, v_row.city, v_row.payload,
     -- Straight to the review step. Every field is already filled in, so the
     -- useful screen is the one listing what still needs doing, not the first
     -- of five they have been through once.
     'review', p_id)
  returning id into v_new;

  return v_new;
end;
$$;

revoke all on function public.restart_club_submission(bigint) from public, anon;
grant execute on function public.restart_club_submission(bigint) to authenticated;

do $$
declare v_bad boolean;
begin
  select bool_or(column_name is null) into v_bad
  from (select null::text as column_name from information_schema.role_table_grants
         where table_name = 'club_submissions' and grantee = 'authenticated'
           and privilege_type in ('INSERT', 'UPDATE')
        union all
        select column_name from information_schema.role_column_grants
         where table_name = 'club_submissions' and grantee = 'authenticated'
           and privilege_type in ('INSERT', 'UPDATE')) g;

  if coalesce(v_bad, false) then
    raise exception 'club_submissions has a whole-table write grant';
  end if;

  -- Readable, because the admin screen shows it. Never writable: the
  -- privilege_type filter is the whole point, since the table-level select
  -- grant expands into role_column_grants for every column including this one.
  if exists (select 1 from information_schema.role_column_grants
              where table_name = 'club_submissions' and grantee = 'authenticated'
                and column_name = 'restarted_from'
                and privilege_type in ('INSERT', 'UPDATE')) then
    raise exception 'restarted_from must not be writable by authenticated';
  end if;
end $$;
