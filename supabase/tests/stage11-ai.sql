-- 0146/0147 · AI runs, limits, the cache and the cap.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- The writers are the server's, so the test plays the server here.
create or replace function pg_temp.finish(p_job bigint, p_cost numeric default 1,
                                          p_error text default '')
returns void language sql security definer as $fn$
  select public.finish_ai_job(p_job, '{"overview":"ok"}'::jsonb, 'anthropic',
    'claude-sonnet-5', 1000, 500, 0, p_cost, 1200, p_error) $fn$;

-- Backdating a run is how a rolling window gets tested without waiting a day.
create or replace function pg_temp.age(p_job bigint, p_hours numeric)
returns void language sql security definer as $fn$
  update public.army_ai_jobs set created_at = now() - (p_hours || ' hours')::interval
   where id = p_job $fn$;

create or replace function pg_temp.jobs(p_profile uuid)
returns setof public.army_ai_jobs language sql security definer as $fn$
  select * from public.army_ai_jobs where profile_id = p_profile order by id $fn$;

insert into public.club_membership_tiers (club_id, tier_key, label, benefits, is_basic)
  select id, 'basic', 'Basic', '{"armyBuilderAccess": true,
    "listCoachingAccess": true, "matchupAnalysisAccess": true}'::jsonb, true from c;

create or replace function pg_temp.set_limits(
  p_club bigint, p_coach integer, p_cap integer default 0)
returns void language sql security definer as $fn$
  update public.club_army_builder_settings
     set coaching_daily_limit = p_coach, monthly_ai_cap_pence = p_cap
   where club_id = p_club $fn$;

set local role authenticated;

do $$
declare
  w record; v_club bigint; v_out jsonb; v_job bigint; v_win record;
  v_first bigint; v_second bigint; v_third bigint;
begin
  select * into w from who; select id into v_club from c;

  perform pg_temp.be(w.admin);
  perform public.save_army_edition('warhammer-40k', 'Warhammer 40,000',
    array['2000'], 'warhammer-40k-11th', '11th', 'v1');
  perform public.save_army_faction('warhammer-40k-11th', 'adepta-sororitas',
    'Adepta Sororitas', 0);
  perform public.publish_army_catalogue('warhammer-40k-11th', '');
  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');
  perform pg_temp.set_limits(v_club, 3);

  -- ------------------------------------------------------------ the gate
  perform pg_temp.be(w.member);
  begin
    perform public.start_ai_job(v_club, 'season', 'sig-a');
    raise exception 'a tier without seasonCoachAccess should refuse';
  exception when others then
    if sqlerrm <> 'AI_TIER_SEASON' then raise; end if;
  end;

  -- The club's switch is above the tier: turning the builder off turns all
  -- four features off, for the owner as well.
  perform pg_temp.be(w.owner);
  perform public.save_army_builder_settings(v_club, false, 'warhammer-40k-11th');
  begin
    perform public.start_ai_job(v_club, 'coach', 'sig-a');
    raise exception 'a club with the builder off should refuse every feature';
  exception when others then
    if sqlerrm <> 'ARMY_NOT_ENABLED' then raise; end if;
  end;
  perform public.save_army_builder_settings(v_club, true, 'warhammer-40k-11th');
  perform pg_temp.set_limits(v_club, 3);

  -- ------------------------------------------------------- one at a time
  perform pg_temp.be(w.member);
  v_out := public.start_ai_job(v_club, 'coach', 'sig-a');
  v_first := (v_out ->> 'jobId')::bigint;
  if (v_out ->> 'cached')::boolean then
    raise exception 'the first run cannot be a cache hit';
  end if;

  begin
    perform public.start_ai_job(v_club, 'coach', 'sig-b');
    raise exception 'a second run while one is in flight should refuse';
  exception when others then
    if sqlerrm <> 'AI_IN_FLIGHT' then raise; end if;
  end;

  -- ---------------------------------------------- a failure costs nothing
  perform pg_temp.finish(v_first, 5, 'AI_TIMEOUT');
  select * into v_win from public.ai_usage_window(v_club, 'coach');
  if v_win.used <> 0 then
    raise exception 'a failed run must not count, used %', v_win.used;
  end if;
  if public.ai_month_spend(v_club) <> 0 then
    raise exception 'a failed run must not be billed';
  end if;
  -- And it clears the way for another.
  v_out := public.start_ai_job(v_club, 'coach', 'sig-a');
  v_first := (v_out ->> 'jobId')::bigint;
  perform pg_temp.finish(v_first, 12);

  select * into v_win from public.ai_usage_window(v_club, 'coach');
  if v_win.used <> 1 or v_win.remaining <> 2 then
    raise exception 'one good run should leave two, got % used % left',
      v_win.used, v_win.remaining;
  end if;
  if public.ai_month_spend(v_club) <> 12 then
    raise exception 'the successful run should be billed';
  end if;

  -- ------------------------------------------------------------ the cache
  -- The same list, untouched. Answered from the stored run, nothing consumed.
  v_out := public.start_ai_job(v_club, 'coach', 'sig-a');
  if not (v_out ->> 'cached')::boolean then
    raise exception 'an unchanged signature should be answered from the cache';
  end if;
  if (v_out ->> 'jobId')::bigint <> v_first then
    raise exception 'the cache should hand back the run that answered it';
  end if;
  select * into v_win from public.ai_usage_window(v_club, 'coach');
  if v_win.used <> 1 then raise exception 'a cache hit must not consume'; end if;

  -- Regenerate does consume, which is the whole difference.
  v_out := public.start_ai_job(v_club, 'coach', 'sig-a', '{}', '{}', true);
  if (v_out ->> 'cached')::boolean then
    raise exception 'force should not read the cache';
  end if;
  v_second := (v_out ->> 'jobId')::bigint;
  perform pg_temp.finish(v_second, 12);

  -- ----------------------------------------------------- the rolling limit
  v_out := public.start_ai_job(v_club, 'coach', 'sig-c');
  v_third := (v_out ->> 'jobId')::bigint;
  perform pg_temp.finish(v_third, 12);

  select * into v_win from public.ai_usage_window(v_club, 'coach');
  if v_win.remaining <> 0 then
    raise exception 'three of three should leave none, got %', v_win.remaining;
  end if;
  begin
    perform public.start_ai_job(v_club, 'coach', 'sig-d');
    raise exception 'a fourth run should be refused';
  exception when others then
    if sqlerrm <> 'AI_LIMIT' then raise; end if;
  end;

  -- Age the oldest past the window and exactly one comes back. Not all three,
  -- which is the difference between this and a calendar day.
  perform pg_temp.age(v_first, 25);
  select * into v_win from public.ai_usage_window(v_club, 'coach');
  if v_win.used <> 2 or v_win.remaining <> 1 then
    raise exception 'one run should return, got % used % left',
      v_win.used, v_win.remaining;
  end if;

  -- ------------------------------------------------------------- the cap
  perform pg_temp.be(w.owner);
  perform pg_temp.set_limits(v_club, 3, 10);
  perform pg_temp.be(w.member);
  begin
    perform public.start_ai_job(v_club, 'coach', 'sig-e');
    raise exception 'a club over its monthly cap should refuse';
  exception when others then
    if sqlerrm <> 'AI_CLUB_CAP' then raise; end if;
  end;
  perform pg_temp.be(w.owner);
  perform pg_temp.set_limits(v_club, 3, 0);

  -- ------------------------------------------------------------ the sweep
  perform pg_temp.be(w.member);
  v_out := public.start_ai_job(v_club, 'matchup', 'sig-f');
  v_job := (v_out ->> 'jobId')::bigint;
  perform pg_temp.age(v_job, 1);
  if (select public.sweep_ai_jobs()) < 1 then
    raise exception 'the sweep should have failed the lost run';
  end if;
  if (select status from pg_temp.jobs(w.member) where id = v_job) <> 'failed' then
    raise exception 'a lost run should end failed';
  end if;
  -- And it did not count or cost.
  select * into v_win from public.ai_usage_window(v_club, 'matchup');
  if v_win.used <> 0 then raise exception 'a swept run must not count'; end if;
  -- The way is clear again.
  v_out := public.start_ai_job(v_club, 'matchup', 'sig-g');

  -- --------------------------------------------------- one plan per focus
  perform pg_temp.be(w.owner);
  perform public.save_season_plan(v_club, 'list:1:improve-results',
    '{}'::jsonb, 'improve-results', '{"weeks":[]}'::jsonb, 'sig-a', 4);
  perform public.save_season_plan(v_club, 'list:1:improve-results',
    '{}'::jsonb, 'improve-results', '{"weeks":[1]}'::jsonb, 'sig-b', 7);
  if (select count(*) from public.season_coach_plans
       where focus_key = 'list:1:improve-results' and retired_at is null) <> 1 then
    raise exception 'a focus should carry exactly one live plan';
  end if;
  if (select count(*) from public.season_coach_plans
       where focus_key = 'list:1:improve-results') <> 2 then
    raise exception 'the replaced plan should be retired, not deleted';
  end if;

  -- ------------------------------------------------- somebody else's runs
  perform pg_temp.be(w.member);
  if exists (select 1 from public.army_ai_jobs where profile_id = w.owner) then
    raise exception 'a member must not read another member''s coaching';
  end if;

  raise notice 'stage11-ai: all pass';
end $$;
