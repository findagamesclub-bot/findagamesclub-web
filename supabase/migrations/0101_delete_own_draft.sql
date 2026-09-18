-- 0101 · Binning a listing nobody has seen
--
-- 0099 gave `club_submissions` no delete policy at all, on the reasoning that a
-- submission is cancelled rather than removed so an admin looking at a queue
-- entry that vanished has something to read.
--
-- That reasoning is right for a listing somebody has **sent**, and wrong for one
-- they have not. A draft has never left its owner's account: no admin has seen
-- it, no queue counted it, nothing anywhere refers to it. Leaving a tombstone
-- for that is clutter in the only list it appears in, which is theirs.
--
-- So the split is by state rather than by verb:
--
--   draft                              delete it, it is theirs alone
--   review_pending, changes_requested  cancel it, an admin has read it
--   approved, declined, cancelled      neither, it is a record
--
-- `cancelled` is deletable too, because by then the record has served its
-- purpose and the owner should be able to clear their own list.
--
-- Checked on a throwaway Postgres: an owner deletes their own draft and their
-- own cancelled one; cannot delete one that is with the admins, one that came
-- back for changes, or one that became a club; and cannot delete somebody
-- else's draft at all.

grant delete on public.club_submissions to authenticated;

drop policy if exists club_submissions_bin on public.club_submissions;
create policy club_submissions_bin on public.club_submissions
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and status in ('draft', 'cancelled')
  );

-- The guard block from 0099 checks INSERT and UPDATE for whole-table grants.
-- DELETE is a whole-table grant on purpose here: there are no columns to name
-- on a delete, and the policy above is what narrows it.
do $$
declare bad boolean;
begin
  select bool_or(column_name is null) into bad from (
    select null::text as column_name from information_schema.role_table_grants
     where table_name = 'club_submissions'
       and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
    union all
    select column_name from information_schema.role_column_grants
     where table_name = 'club_submissions'
       and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
  ) g;
  if bad then
    raise exception 'club_submissions carries a whole-table insert or update grant';
  end if;
end $$;
