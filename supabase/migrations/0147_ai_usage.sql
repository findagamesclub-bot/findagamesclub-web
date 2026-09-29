-- 0147 · Who may run what, how often, and what it costs
--
-- The limit is a **rolling twenty-four hours**, not a calendar day
-- (`_build_army_analysis_usage_summary_from_records`, club_store.py:7635). It
-- matters to the person waiting: a day that resets at midnight is one cliff,
-- and this gives one run back at a time, twenty-four hours after the run that
-- used it. `src/utils/ai-usage.ts` says the same thing for the button, and
-- `supabase/tests/stage11-ai.sql` runs both against the same fixtures.
--
-- Three things this refuses, each with its own code so the screen can use
-- legacy's own wording: the feature's tier benefit, the rolling limit, and the
-- club's monthly cap in pence.
--
-- Checked on a throwaway Postgres built from every migration: a failed run
-- does not count, a second run while one is in flight is refused, an unchanged
-- signature is answered from the cache without consuming anything, the cap
-- refuses by name, and the sweep fails an orphan without charging for it.

/** Which tier flag each feature is sold under. Legacy's four keys. */
create or replace function public.ai_feature_benefit(p_feature text)
returns text language sql immutable set search_path = public as $$
  select case lower(btrim(p_feature))
    when 'coach'    then 'listCoachingAccess'
    when 'matchup'  then 'matchupAnalysisAccess'
    when 'scouting' then 'opponentScoutingAccess'
    when 'season'   then 'seasonCoachAccess'
  end
$$;

/** And how many of it a club allows in a day. */
create or replace function public.ai_feature_limit(p_club bigint, p_feature text)
returns integer language sql stable security definer set search_path = public as $$
  select case lower(btrim(p_feature))
    when 'coach'    then coalesce(s.coaching_daily_limit, 5)
    when 'matchup'  then coalesce(s.matchup_daily_limit, 3)
    when 'scouting' then coalesce(s.scouting_daily_limit, 2)
    when 'season'   then coalesce(s.season_daily_limit, 2)
    else 0 end
    from (select 1) one
    left join public.club_army_builder_settings s on s.club_id = p_club
$$;

/**
 * The builder's ladder, then the feature's own rung.
 *
 * A manager bypasses the tier as everywhere else, but not the club's switch:
 * `army_builder_allowed` refuses everybody when the builder is off, which is
 * what turns all four features off together.
 */
create or replace function public.ai_feature_allowed(p_club bigint, p_feature text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_key text; v_tier text; v_allows boolean;
begin
  perform public.army_builder_allowed(p_club);

  v_key := public.ai_feature_benefit(p_feature);
  if v_key is null then raise exception 'AI_BAD_FEATURE'; end if;
  if public.can_manage_club(p_club) or public.is_admin() then return; end if;

  select m.tier_key into v_tier from public.club_memberships m
   where m.club_id = p_club and m.profile_id = auth.uid() and m.status = 'approved'
   limit 1;

  select coalesce((t.benefits ->> v_key)::boolean, false) into v_allows
    from public.club_membership_tiers t
   where t.club_id = p_club and t.tier_key = v_tier;

  if not coalesce(v_allows, false) then
    raise exception 'AI_TIER_%', upper(p_feature) using errcode = 'insufficient_privilege';
  end if;
end $$;

/**
 * How many runs are left, and when the next one comes back.
 *
 * `next_available_at` is the limiting run's own time plus a day, counting back
 * from the newest, which is what makes the allowance return one at a time.
 * Succeeded rows only.
 */
create or replace function public.ai_usage_window(p_club bigint, p_feature text)
returns table (used integer, allowed integer, remaining integer,
               next_available_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_limit integer; v_used integer; v_boundary timestamptz;
begin
  v_limit := public.ai_feature_limit(p_club, p_feature);

  select count(*) into v_used from public.army_ai_jobs j
   where j.club_id = p_club and j.profile_id = auth.uid()
     and j.feature = p_feature and j.status = 'succeeded'
     and j.created_at >= now() - interval '1 day';

  if v_limit > 0 and v_used >= v_limit then
    select j.created_at into v_boundary from public.army_ai_jobs j
     where j.club_id = p_club and j.profile_id = auth.uid()
       and j.feature = p_feature and j.status = 'succeeded'
       and j.created_at >= now() - interval '1 day'
     order by j.created_at desc
     offset v_limit - 1 limit 1;
  end if;

  return query select v_used, v_limit,
    case when v_limit <= 0 then null else greatest(0, v_limit - v_used) end,
    case when v_boundary is null then null else v_boundary + interval '1 day' end;
end $$;

/** What a club has spent this month, in pence. */
create or replace function public.ai_month_spend(p_club bigint)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(j.cost_pence), 0) from public.army_ai_jobs j
   where j.club_id = p_club and j.status = 'succeeded'
     and j.created_at >= date_trunc('month', public.london_today()::timestamptz)
$$;

/**
 * Start a run, or hand back the one that already answered this.
 *
 * The cache is the list's signature. Pressing Coach twice on a list nobody has
 * touched returns the first report and consumes nothing, which is legacy's
 * behaviour (club_store.py:7261) and the reason the signature exists at all.
 * `p_force` is the Regenerate button and does consume.
 */
create or replace function public.start_ai_job(
  p_club bigint, p_feature text, p_signature text default '',
  p_source jsonb default '{}', p_payload jsonb default '{}',
  p_force boolean default false
) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_cached public.army_ai_jobs%rowtype;
  v_window record; v_cap numeric; v_spent numeric; v_id bigint;
begin
  perform public.ai_feature_allowed(p_club, p_feature);

  if not p_force and btrim(coalesce(p_signature, '')) <> '' then
    select * into v_cached from public.army_ai_jobs j
     where j.club_id = p_club and j.profile_id = auth.uid()
       and j.feature = p_feature and j.status = 'succeeded'
       and j.source_signature = p_signature
     order by j.created_at desc limit 1;
    if v_cached.id is not null then
      return jsonb_build_object('jobId', v_cached.id, 'cached', true,
                                'status', 'succeeded');
    end if;
  end if;

  select * into v_window from public.ai_usage_window(p_club, p_feature);
  if v_window.allowed > 0 and coalesce(v_window.remaining, 0) <= 0 then
    raise exception 'AI_LIMIT' using errcode = 'insufficient_privilege',
      hint = coalesce(v_window.next_available_at::text, '');
  end if;

  select coalesce(s.monthly_ai_cap_pence, 0) into v_cap
    from public.club_army_builder_settings s where s.club_id = p_club;
  if coalesce(v_cap, 0) > 0 then
    v_spent := public.ai_month_spend(p_club);
    if v_spent >= v_cap then
      raise exception 'AI_CLUB_CAP' using errcode = 'insufficient_privilege',
        hint = v_spent::text;
    end if;
  end if;

  -- The unique index refuses a second run while one is in flight; this turns
  -- that into a code the screen can say something useful about.
  begin
    insert into public.army_ai_jobs (
      club_id, profile_id, feature, source_signature, source, request_payload)
    values (p_club, auth.uid(), p_feature, coalesce(p_signature, ''),
            coalesce(p_source, '{}'::jsonb), coalesce(p_payload, '{}'::jsonb))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'AI_IN_FLIGHT' using errcode = 'insufficient_privilege';
  end;

  return jsonb_build_object('jobId', v_id, 'cached', false, 'status', 'queued');
end $$;

/** Mark it running, so the sweep can tell a slow job from a lost one. */
create or replace function public.mark_ai_job_running(p_job bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  update public.army_ai_jobs
     set status = 'running', started_at = now()
   where id = p_job and status = 'queued';
end $$;

/**
 * Write the answer, or the failure.
 *
 * A failure records what went wrong and charges nothing, because it is not in
 * any index that feeds a limit or a bill.
 */
create or replace function public.finish_ai_job(
  p_job bigint, p_result jsonb, p_provider text, p_model text,
  p_tokens_in integer, p_tokens_out integer, p_tokens_cached integer,
  p_cost_pence numeric, p_latency_ms integer, p_error text default ''
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
         finished_at = now()
   where id = p_job and status in ('queued', 'running');
end $$;

/**
 * Anything running for more than five minutes is lost, not slow.
 *
 * Without this a crashed request leaves a row in flight for ever: the person
 * watches a spinner that will never finish and cannot start another, because
 * the one-in-flight index is doing its job. Run from the cron route.
 */
create or replace function public.sweep_ai_jobs()
returns integer language plpgsql volatile security definer set search_path = public as $$
declare v_count integer;
begin
  with stuck as (
    update public.army_ai_jobs
       set status = 'failed', error_code = 'AI_LOST',
           cost_pence = 0, finished_at = now()
     where status in ('queued', 'running')
       and created_at < now() - interval '5 minutes'
    returning 1)
  select count(*) into v_count from stuck;
  return v_count;
end $$;

/** Retire the plan a focus already had, so there is only ever one live. */
create or replace function public.save_season_plan(
  p_club bigint, p_focus_key text, p_focus jsonb, p_goal text,
  p_plan jsonb, p_signature text, p_matches integer
) returns bigint language plpgsql volatile security definer set search_path = public as $$
declare v_id bigint;
begin
  perform public.ai_feature_allowed(p_club, 'season');

  update public.season_coach_plans set retired_at = now()
   where profile_id = auth.uid() and club_id = p_club
     and focus_key = p_focus_key and retired_at is null;

  insert into public.season_coach_plans (
    club_id, profile_id, focus_key, focus, goal, plan,
    source_signature, matches_at_write)
  values (p_club, auth.uid(), p_focus_key, coalesce(p_focus, '{}'::jsonb),
          coalesce(p_goal, ''), coalesce(p_plan, '{}'::jsonb),
          coalesce(p_signature, ''), greatest(0, coalesce(p_matches, 0)))
  returning id into v_id;
  return v_id;
end $$;

/**
 * Spend per club per month, for the admin.
 *
 * A function rather than a view, because the guard is the point: the numbers
 * are every club's, and a view would lean on RLS that `army_ai_jobs` cannot
 * express in aggregate. Failures are in the count and not in the money, so an
 * admin can see a club burning runs without being charged for them.
 */
create or replace function public.admin_ai_usage(p_months integer default 6)
returns table (club_id bigint, club_name text, month date,
               runs bigint, failures bigint, spend_pence numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select j.club_id, max(c.name),
         public.london_day(j.created_at) - (extract(day from j.created_at)::int - 1),
         count(*) filter (where j.status = 'succeeded'),
         count(*) filter (where j.status = 'failed'),
         coalesce(sum(j.cost_pence) filter (where j.status = 'succeeded'), 0)
    from public.army_ai_jobs j
    join public.clubs c on c.id = j.club_id
   where j.created_at >= date_trunc('month', now())
                         - make_interval(months => greatest(0, p_months - 1))
   group by j.club_id, 3
   order by 3 desc, 6 desc;
end $$;

revoke all on function public.ai_feature_benefit(text) from public, anon;
revoke all on function public.ai_feature_limit(bigint, text) from public, anon;
revoke all on function public.ai_feature_allowed(bigint, text) from public, anon;
revoke all on function public.ai_usage_window(bigint, text) from public, anon;
revoke all on function public.ai_month_spend(bigint) from public, anon;
revoke all on function public.start_ai_job(bigint, text, text, jsonb, jsonb, boolean)
  from public, anon;
revoke all on function public.mark_ai_job_running(bigint) from public, anon;
revoke all on function public.finish_ai_job(
  bigint, jsonb, text, text, integer, integer, integer, numeric, integer, text)
  from public, anon;
revoke all on function public.sweep_ai_jobs() from public, anon;
revoke all on function public.save_season_plan(
  bigint, text, jsonb, text, jsonb, text, integer) from public, anon;
revoke all on function public.admin_ai_usage(integer) from public, anon;

grant execute on function public.ai_usage_window(bigint, text) to authenticated;
grant execute on function public.ai_month_spend(bigint) to authenticated;
grant execute on function public.start_ai_job(bigint, text, text, jsonb, jsonb, boolean)
  to authenticated;
grant execute on function public.save_season_plan(
  bigint, text, jsonb, text, jsonb, text, integer) to authenticated;
grant execute on function public.admin_ai_usage(integer) to authenticated;
-- `mark_ai_job_running`, `finish_ai_job` and `sweep_ai_jobs` are the server's,
-- reached through the service role. A member who could write a result could
-- write themselves a free one.
