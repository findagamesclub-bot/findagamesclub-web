-- 0234 · a saved report is not this evening's answer.
--
-- Section 2 is the break test: the whole point is that an old report stops
-- answering a press. Remove the age from `start_ai_job` and this fails,
-- because that is the state the client reported.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Read and age as postgres: `army_ai_jobs` is the member's own and a fixture
-- RLS hides reads exactly like one that was never written.
create or replace function pg_temp.finish(p_job bigint) returns void
language plpgsql security definer as $fn$ begin
  update public.army_ai_jobs
     set status = 'succeeded', finished_at = now(), result = '{"ok": true}'::jsonb
   where id = p_job;
end $fn$;

create or replace function pg_temp.age(p_job bigint, p_days integer) returns void
language plpgsql security definer as $fn$ begin
  update public.army_ai_jobs
     set created_at = now() - make_interval(days => p_days),
         finished_at = now() - make_interval(days => p_days)
   where id = p_job;
end $fn$;

create or replace function pg_temp.open_builder() returns void
language plpgsql security definer as $fn$
declare v_club bigint; v_edition text;
begin
  select id into v_club from public.clubs where slug = 'army-club';
  select id into v_edition from public.army_editions
   where status = 'active' limit 1;
  -- The daily cap defaults to two, and this suite starts four runs on purpose:
  -- what is under test is the cache, not the allowance.
  insert into public.club_army_builder_settings
    (club_id, enabled, edition_id, matchup_daily_limit)
  values (v_club, true, v_edition, 99)
  on conflict (club_id) do update
    set enabled = true, matchup_daily_limit = 99;
end $fn$;

select pg_temp.open_builder();

set local role authenticated;

do $$
declare
  w record; v_club bigint; v_first bigint; v_second bigint; v_out jsonb;
  n bigint; v_said text;
begin
  select * into w from who;
  select id into v_club from c;

  -- As the owner, who passes the tier ladder by running the club. What is
  -- under test is the cache's age, not the five rungs 0143 already guards.
  perform pg_temp.be(w.owner);

  -- ====================================================================== 1
  -- Two presses in a row on the same question is one run. That is legacy's
  -- behaviour and the reason the signature exists.
  -- ====================================================================== 1
  v_out := public.start_ai_job(v_club, 'matchup', 'list-7:aeldari');
  v_first := (v_out ->> 'jobId')::bigint;
  if (v_out ->> 'cached')::boolean then
    raise exception 'FAIL 1: the first run came back cached';
  end if;
  perform pg_temp.finish(v_first);

  v_out := public.start_ai_job(v_club, 'matchup', 'list-7:aeldari');
  if not (v_out ->> 'cached')::boolean then
    raise exception 'FAIL 1b: pressing twice in a row spent a second run';
  end if;
  if (v_out ->> 'jobId')::bigint <> v_first then
    raise exception 'FAIL 1c: the cache handed back a different report';
  end if;
  raise notice 'PASS 1: two presses on the same question is one run';

  -- ====================================================================== 2
  -- BREAK TEST. A month later it is not the answer to a press. This is the
  -- client's own report: "it does not run new analysis and only shows old
  -- analysis from October."
  -- ====================================================================== 2
  perform pg_temp.age(v_first, 30);

  v_out := public.start_ai_job(v_club, 'matchup', 'list-7:aeldari');
  if (v_out ->> 'cached')::boolean then
    raise exception
      'FAIL 2: a 30-day-old report was handed back as the answer to a press';
  end if;
  v_second := (v_out ->> 'jobId')::bigint;
  if v_second = v_first then
    raise exception 'FAIL 2b: no new run was started';
  end if;
  perform pg_temp.finish(v_second);
  raise notice 'PASS 2: break test — an old report does not answer a press';

  -- ====================================================================== 3
  -- And the screen can still open on it, which is what the window must not
  -- cost: a report somebody spent a run on should be there next time.
  -- ====================================================================== 3
  perform pg_temp.age(v_second, 30);
  if public.latest_ai_job(v_club, 'matchup', 'list-7:aeldari') <> v_second then
    raise exception
      'FAIL 3: the screen cannot find the last report for this question';
  end if;
  raise notice 'PASS 3: the last report is still there to open on';

  -- ====================================================================== 4
  -- A different opponent is a different question, cached or not.
  -- ====================================================================== 4
  v_out := public.start_ai_job(v_club, 'matchup', 'list-7:death-guard');
  if (v_out ->> 'cached')::boolean then
    raise exception 'FAIL 4: another faction was answered from the first one';
  end if;
  raise notice 'PASS 4: a different opponent is a different question';

  -- ====================================================================== 5
  -- Nobody reads somebody else's report, which is what keeps the cache from
  -- being a way of reading another member's coaching.
  -- ====================================================================== 5
  perform pg_temp.be(w.member);
  if public.latest_ai_job(v_club, 'matchup', 'list-7:aeldari') is not null then
    raise exception 'FAIL 5: a clubmate read somebody else''s report';
  end if;
  raise notice 'PASS 5: a report belongs to whoever ran it';

  -- ====================================================================== 6
  -- 0236. The runs before this one are reachable, which is the half the
  -- client has now asked for twice: "old analysis should cache and stay as
  -- previous runs to look back on".
  -- ====================================================================== 6
  perform pg_temp.be(w.owner);
  select count(*) into n
    from public.ai_job_history(v_club, 'matchup', 'list-7:aeldari');
  if n <> 2 then
    raise exception
      'FAIL 6: the history holds % runs for this question, expected 2', n;
  end if;
  raise notice 'PASS 6: both answers to one question are still reachable';

  -- ====================================================================== 7
  -- BREAK TEST. A history is one person's own coaching. A clubmate reading
  -- it would be reading somebody else's homework, and the owner of the club
  -- is the tempting case because they can manage everything else here.
  -- ====================================================================== 7
  perform pg_temp.be(w.member);
  select count(*) into n
    from public.ai_job_history(v_club, 'matchup', 'list-7:aeldari');
  if n <> 0 then
    raise exception 'FAIL 7: a clubmate read % of somebody else''s runs', n;
  end if;
  raise notice 'PASS 7: break test — a history belongs to whoever ran it';

  -- ====================================================================== 8
  -- And why a run failed is the admin's, not the club's. The detail is a key,
  -- a model name or a quota, which is nobody else's to read.
  -- ====================================================================== 8
  v_said := '';
  begin
    perform public.admin_ai_failures(5);
    raise exception 'FAIL 8: a member read the deployment''s own failures';
  exception when insufficient_privilege then v_said := 'refused';
  end;
  if v_said <> 'refused' then
    raise exception 'FAIL 8: the failures guard did not refuse a member';
  end if;

  perform pg_temp.be(w.admin);
  perform public.admin_ai_failures(5);
  raise notice 'PASS 8: only an admin reads why a run failed';

  raise notice '--- all 8 passed ---';
end $$;
