-- 0146 · AI runs, as jobs
--
-- The client asked for "Army lists, list analysis, opponent scouting and
-- season coaching (see local app to see how it works now)". Legacy blocks the
-- request for twenty to sixty seconds while the model thinks
-- (`OPENAI_TIMEOUT_SECONDS` is 75, server.py:188). That is not available to us:
-- a serverless function has a ceiling, and somebody building a list on a phone
-- should be able to close the tab.
--
-- So a run is a row. It is inserted, the work continues after the response,
-- and the page polls. Same prompts, same outputs, same limits, and the answer
-- survives the tab closing.
--
-- Two rules the shape exists to enforce:
--   * One in flight per person per feature per club, by partial unique index.
--     Somebody pressing Coach twice gets one run, not two charges.
--   * **A failed run never counts against anybody.** Every index that feeds a
--     limit or a bill is `where status = 'succeeded'`, so being told you have
--     spent your allowance on an answer you never received cannot happen.
--
-- Checked on a throwaway Postgres built from every migration: nobody may write
-- either table directly, a second run while one is in flight is refused, a
-- failed run leaves the allowance untouched, and a member reads only their own.

create table public.army_ai_jobs (
  id                bigint generated always as identity primary key,
  club_id           bigint not null references public.clubs (id) on delete cascade,
  profile_id        uuid not null references public.profiles (id) on delete cascade,
  feature           text not null
                      check (feature in ('coach', 'matchup', 'scouting', 'season')),
  status            text not null default 'queued'
                      check (status in ('queued', 'running', 'succeeded', 'failed')),
  -- The list's canonical signature (0144). A re-run on an unchanged list is
  -- answered from the stored result and costs nothing.
  source_signature  text not null default '',
  -- What was asked about, for the header: the list, the opponent, the focus.
  source            jsonb not null default '{}'::jsonb,
  -- Redacted before it lands here. `redact.ts` takes emails, postcodes and
  -- phone numbers out, because a prompt is a copy of somebody's data and this
  -- row outlives the request.
  request_payload   jsonb not null default '{}'::jsonb,
  result            jsonb,
  provider          text not null default '',
  model             text not null default '',
  tokens_in         integer not null default 0,
  tokens_out        integer not null default 0,
  tokens_cached     integer not null default 0,
  cost_pence        numeric(10, 4) not null default 0,
  latency_ms        integer not null default 0,
  error_code        text not null default '',
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz
);

-- One run at a time, per person per feature per club.
create unique index army_ai_jobs_one_in_flight
  on public.army_ai_jobs (club_id, profile_id, feature)
  where status in ('queued', 'running');

-- The rolling window. Succeeded only: a failure is not somebody's allowance.
create index army_ai_jobs_window_idx
  on public.army_ai_jobs (profile_id, feature, created_at desc)
  where status = 'succeeded';

-- The cache probe, and the club's bill.
create index army_ai_jobs_signature_idx
  on public.army_ai_jobs (profile_id, feature, source_signature, created_at desc)
  where status = 'succeeded' and source_signature <> '';

create index army_ai_jobs_spend_idx
  on public.army_ai_jobs (club_id, created_at desc)
  where status = 'succeeded';

-- What the sweep looks for.
create index army_ai_jobs_stuck_idx
  on public.army_ai_jobs (started_at)
  where status = 'running';

/**
 * One active plan per focus.
 *
 * Legacy keys a plan on a focus key built from the list or faction and the
 * goal (`_build_season_coach_focus_key`, club_store.py:7810), and keeps one.
 * Retiring rather than deleting, because a plan is advice somebody acted on
 * and "what did it tell me in August" is a fair question.
 */
create table public.season_coach_plans (
  id                bigint generated always as identity primary key,
  club_id           bigint not null references public.clubs (id) on delete cascade,
  profile_id        uuid not null references public.profiles (id) on delete cascade,
  focus_key         text not null,
  focus             jsonb not null default '{}'::jsonb,
  goal              text not null default '',
  plan              jsonb not null default '{}'::jsonb,
  source_signature  text not null default '',
  -- How many trusted matches existed when it was written. The difference is
  -- what makes it stale (0147 and `season-staleness.ts`).
  matches_at_write  integer not null default 0,
  created_at        timestamptz not null default now(),
  retired_at        timestamptz
);

create unique index season_coach_plans_one_active
  on public.season_coach_plans (profile_id, club_id, focus_key)
  where retired_at is null;

create index season_coach_plans_mine_idx
  on public.season_coach_plans (profile_id, created_at desc);

revoke insert, update, delete on public.army_ai_jobs from authenticated, anon;
revoke insert, update, delete on public.season_coach_plans from authenticated, anon;
grant select on public.army_ai_jobs to authenticated;
grant select on public.season_coach_plans to authenticated;

alter table public.army_ai_jobs enable row level security;
alter table public.season_coach_plans enable row level security;

/**
 * Your own runs, and the club's team for the spend page.
 *
 * A clubmate cannot read somebody's coaching, which is different from the army
 * lists deliberately: a list is a thing you bring to a table in front of
 * people, and a coaching report is somebody being told what is wrong with it.
 */
create policy army_ai_jobs_select on public.army_ai_jobs
  for select to authenticated
  using (profile_id = (select auth.uid())
         or public.can_manage_club(club_id)
         or public.is_admin());

create policy season_coach_plans_select on public.season_coach_plans
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

do $$
declare v_bad boolean; v_table text;
begin
  foreach v_table in array array['army_ai_jobs', 'season_coach_plans'] loop
    select bool_or(column_name is null) into v_bad from (
      select null::text as column_name from information_schema.role_table_grants
       where table_name = v_table and grantee = 'authenticated'
         and privilege_type = 'INSERT'
      union all
      select column_name from information_schema.role_column_grants
       where table_name = v_table and grantee = 'authenticated'
         and privilege_type = 'INSERT') g;
    if coalesce(v_bad, false) then
      raise exception '% still carries a whole-table insert grant', v_table;
    end if;
  end loop;
end $$;
