-- 0236 · why a run failed, and the ones before it
--
-- The client, item 6, for the third time: "Match up coaching, Season Coach and
-- AI scout opponent all doesn't look to be working... it shows now as service
-- did not answer... Old analysis should cache and stay as previous runs to
-- look back on, but you should be able to run new versions which are saved
-- also."
--
-- Two things, and the first one is ours.
--
-- WHY IT FAILED. `finish_ai_job` stores a KIND — `provider`, `timeout`,
-- `unparseable` — and throws away what the provider actually said. So every
-- fault in the world reads "The coaching service did not answer", and the one
-- that was really happening (OpenAI refusing a model name that belongs to
-- Anthropic) was indistinguishable from a bad key, a dead network or no
-- credit. It cost this item three rounds with the client, and nothing on any
-- screen or in any table could have told anybody which of those it was.
--
-- `error_detail` is that sentence. It is NOT shown to the member: what they
-- need is whether it is worth pressing again, which the kind already answers.
-- It is for the admin's AI usage screen, where somebody can act on it.
--
-- THE RUNS BEFORE IT. 0147's cache answers "has this exact question already
-- been asked", which is a different question from "what did it say last
-- month". A member who coached a list in October and again in November had
-- the October one still in the table and no way to reach it. That is the
-- half the client has asked for twice.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-a-saved-report-has-an-age.sql.

begin;

alter table public.army_ai_jobs
  add column if not exists error_detail text not null default '';

comment on column public.army_ai_jobs.error_detail is
  'What the provider actually said, trimmed. For the admin, never the '
  'member: a key, a model name or a quota is not their problem to read.';

/**
 * Write the answer, or the failure, now with the reason.
 *
 * 0147's body, unchanged except for the new column. A failure still charges
 * nothing and still cannot overwrite a finished row.
 */
create or replace function public.finish_ai_job(
  p_job bigint, p_result jsonb, p_provider text, p_model text,
  p_tokens_in integer, p_tokens_out integer, p_tokens_cached integer,
  p_cost_pence numeric, p_latency_ms integer, p_error text default '',
  p_detail text default ''
) returns void language plpgsql volatile security definer set search_path = public as $$
begin
  update public.army_ai_jobs
     set status = case when btrim(coalesce(p_error, '')) <> ''
                       then 'failed' else 'succeeded' end,
         result = case when btrim(coalesce(p_error, '')) <> '' then null else p_result end,
         provider = coalesce(p_provider, ''), model = coalesce(p_model, ''),
         tokens_in = coalesce(p_tokens_in, 0),
         tokens_out = coalesce(p_tokens_out, 0),
         tokens_cached = coalesce(p_tokens_cached, 0),
         -- Never billed for a failure.
         cost_pence = case when btrim(coalesce(p_error, '')) <> ''
                           then 0 else coalesce(p_cost_pence, 0) end,
         latency_ms = coalesce(p_latency_ms, 0),
         error_code = coalesce(p_error, ''),
         error_detail = left(coalesce(p_detail, ''), 600),
         finished_at = now()
   where id = p_job and status in ('queued', 'running');
end $$;

-- The old signature would otherwise keep resolving for any caller that has
-- not been rebuilt, writing no detail and looking like it worked. A new or
-- defaulted argument makes a NEW function in Postgres; this is the drop that
-- makes the old one stop existing.
drop function if exists public.finish_ai_job(
  bigint, jsonb, text, text, integer, integer, integer, numeric, integer, text);

revoke all on function public.finish_ai_job(
  bigint, jsonb, text, text, integer, integer, integer, numeric, integer,
  text, text) from public, anon, authenticated;

/**
 * Every answer this person has had to this question, newest first.
 *
 * Theirs only — `profile_id = auth.uid()` — because a report is coaching
 * written for one member about their own list, and a clubmate reading it
 * would be reading their homework.
 *
 * Succeeded only. A failed run produced nothing to look back on, and listing
 * it would offer somebody a date that opens an empty card.
 */
create or replace function public.ai_job_history(
  p_club bigint, p_feature text, p_signature text, p_limit integer default 12
) returns table (
  id bigint, created_at timestamptz, finished_at timestamptz, model text
)
language sql
stable
security definer
set search_path = public
as $$
  select j.id, j.created_at, j.finished_at, j.model
    from public.army_ai_jobs j
   where j.club_id = p_club
     and j.profile_id = auth.uid()
     and j.feature = p_feature
     and j.source_signature = coalesce(p_signature, '')
     and j.status = 'succeeded'
   -- The id breaks the tie in the same direction the sort runs, which 0234
   -- already had to learn: two runs inside one transaction share a timestamp.
   order by j.created_at desc, j.id desc
   limit greatest(1, least(coalesce(p_limit, 12), 50))
$$;

revoke all on function public.ai_job_history(bigint, text, text, integer)
  from public, anon;
grant execute on function public.ai_job_history(bigint, text, text, integer)
  to authenticated;

/**
 * The runs that did not finish, for the admin screen.
 *
 * A function rather than a select, for the reason `check:columns` gives:
 * `src/types/database.ts` is generated from the live schema and has never
 * heard of `error_detail`. It also puts the guard where it belongs — this
 * crosses every club and every member, which is not a shape any ordinary
 * reader should be able to ask for, and `is_admin()` is the whole of who may.
 */
create or replace function public.admin_ai_failures(p_limit integer default 20)
returns table (
  id bigint, feature text, provider text, model text,
  error_code text, error_detail text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select j.id, j.feature, j.provider, j.model,
         j.error_code, j.error_detail, j.created_at
    from public.army_ai_jobs j
   where j.status = 'failed'
   order by j.created_at desc, j.id desc
   limit greatest(1, least(coalesce(p_limit, 20), 100));
end $$;

revoke all on function public.admin_ai_failures(integer) from public, anon;
grant execute on function public.admin_ai_failures(integer) to authenticated;

commit;
