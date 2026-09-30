-- Every scheduled job the migrations promise is actually scheduled.
--
-- Until the harness grew a real `cron.job`, these blocks had never run locally:
-- each guarded on a `pg_extension` row that the harness does not have, so the
-- chain took the "not enabled" branch every time and reported success. 0149's
-- was proved only by the user running it against the real database, and 0152's
-- first guard used `to_regproc` where it needed `to_regprocedure`, which made
-- it false everywhere and scheduled nothing. Neither would have been caught.
--
-- Run after scripts/pg-harness.sh build.

do $$
declare
  want text[] := array[
    'warn-expiring-memberships',
    'prune-notifications',
    'prune-club-audit',
    'prune-notification-deliveries',
    'sweep-ai-jobs'];
  missing text;
begin
  select string_agg(w, ', ' order by w) into missing
    from unnest(want) as w
   where not exists (select 1 from cron.job j where j.jobname = w);

  if missing is not null then
    raise exception 'these jobs are not scheduled: %', missing;
  end if;
end $$;

-- The sweep has to be frequent or it is not doing its job: somebody whose
-- request died is watching a spinner and cannot start another until it runs.
do $$
declare v_schedule text;
begin
  select schedule into v_schedule from cron.job where jobname = 'sweep-ai-jobs';
  if v_schedule <> '*/2 * * * *' then
    raise exception 'the AI sweep runs on %, which is not every two minutes', v_schedule;
  end if;
end $$;

select 'stage12-cron ok' as result, count(*) as jobs_scheduled from cron.job;
