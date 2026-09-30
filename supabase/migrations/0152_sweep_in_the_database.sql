-- 0152 · The AI sweep belongs in the database, not in a workflow
--
-- `sweep_ai_jobs` is one UPDATE. It sends nothing, reads nothing outside
-- Postgres and needs no secret, which is exactly the shape CLAUDE.md's rule
-- describes: a Vercel or GitHub cron is for a job that has to send something,
-- and pg_cron is for one that is pure SQL. It went into the workflow with the
-- other three because they were written together, not because it belonged
-- there.
--
-- Two things it was costing. GitHub bills a scheduled run rounded up to a full
-- minute, so every ten minutes is about 4,300 minutes a month against a
-- 2,000-minute free allowance on a private repository: it would have run out
-- part way through the month and stopped the three jobs that do send email.
-- And ten minutes is slow for what this does. Somebody whose request died is
-- watching a spinner and cannot start another, because the one-in-flight index
-- is doing its job. Two minutes is what the plan asked for and what pg_cron
-- makes free.
--
-- Scheduled beside the three already here: `warn-expiring-memberships`,
-- `prune-notifications` and `prune-club-audit` (0028, 0068), plus 0149's
-- delivery prune.

do $$
begin
  -- Asks whether the function this is about to call exists, rather than
  -- whether an extension row does. Same answer on Supabase, and it lets
  -- the harness exercise the branch instead of skipping it.
  --
  -- `to_regprocedure`, not `to_regproc`: the latter takes a bare name and
  -- answers null for anything carrying an argument list, so the first cut
  -- of this guard was false everywhere and scheduled nothing at all.
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.unschedule('sweep-ai-jobs')
      where exists (select 1 from cron.job where jobname = 'sweep-ai-jobs');

    perform cron.schedule(
      'sweep-ai-jobs', '*/2 * * * *',
      $job$ select public.sweep_ai_jobs() $job$);

    raise notice 'sweep-ai-jobs scheduled every two minutes';
  else
    raise notice
      'pg_cron is not enabled, so the AI sweep was not scheduled. Enable it '
      'under Database, Extensions and run this migration again, or a request '
      'that dies mid-run leaves somebody watching a spinner for ever.';
  end if;
end $$;
