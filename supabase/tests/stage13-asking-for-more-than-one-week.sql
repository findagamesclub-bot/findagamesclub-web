-- 0204 · A club can ask for more than one week.
-- Run with scripts/pg-harness.sh psql -f this.
--
-- The client's words: *"At the moment, they can only request 1 at a time."*
-- 0161 put a unique index on it and the reasoning was right about the case it
-- named, a club pressing the button twice, and wrong about the one the client
-- is describing, a club running four events a year. So the rule moves from one
-- open ask per club to one open ask per date, with a cap on top so an admin's
-- queue stays workable.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.open_asks(p_club bigint)
returns bigint language sql security definer as $fn$
  select count(*) from public.featured_requests
   where club_id = p_club and status = 'pending' $fn$;

-- 1 · The index that only allowed one is gone, which is what makes the rest of
-- this possible. Asserted rather than assumed: with it still there, every
-- section below would fail on a rule nothing in the function says.
do $$
begin
  if to_regclass('public.featured_requests_one_open') is not null then
    raise exception 'FAIL 1: the one-open-ask index is still there';
  end if;
end $$;

do $$
declare
  v_club bigint := (select id from c);
  v_owner uuid := (select owner from who);
  v_member uuid := (select member from who);
  v_first bigint;
  v_week bigint;
  v_open bigint;
begin
  set local role authenticated;

  -- 2 · Three different weeks are three things to answer, and all three land.
  perform pg_temp.be(v_owner);
  v_first := public.request_featured_slot(v_club, current_date + 7, 'Open day');
  v_week  := public.request_featured_slot(v_club, current_date + 14, 'League final');
  perform public.request_featured_slot(v_club, current_date + 21, '');

  v_open := pg_temp.open_asks(v_club);
  if v_open <> 3 then
    raise exception 'FAIL 2: three weeks asked for, % open', v_open;
  end if;

  -- 3 · The same week twice is still one club wanting one slot, which is the
  -- double press the old index was really protecting against.
  begin
    perform public.request_featured_slot(v_club, current_date + 14, 'again');
    raise exception 'FAIL 3: the same week was asked for twice';
  exception when check_violation then
    if sqlerrm not like '%ALREADY_ASKED%' then
      raise exception 'FAIL 3: refused for the wrong reason, got %', sqlerrm;
    end if;
  end;

  -- 4 · And "whenever suits" twice is one preference said twice. A plain
  -- unique index would let this through, because nulls never collide, which is
  -- why the guard is written `is not distinct from`.
  perform public.request_featured_slot(v_club, null, 'Any week you have');
  begin
    perform public.request_featured_slot(v_club, null, 'Still any week');
    raise exception 'FAIL 4: two open asks with no dates named';
  exception when check_violation then
    if sqlerrm not like '%ALREADY_ASKED%' then
      raise exception 'FAIL 4: refused for the wrong reason, got %', sqlerrm;
    end if;
  end;

  -- 5 · Five is as many as we hold at once, so the sixth is refused. A week
  -- nobody has asked for, or this would be section 3 again wearing a cap.
  perform public.request_featured_slot(v_club, current_date + 28, '');
  if pg_temp.open_asks(v_club) <> 5 then
    raise exception 'FAIL 5: expected five open asks, got %',
      pg_temp.open_asks(v_club);
  end if;

  begin
    perform public.request_featured_slot(v_club, current_date + 35, '');
    raise exception 'FAIL 6: a sixth open ask was allowed';
  exception when check_violation then
    if sqlerrm not like '%TOO_MANY_ASKS%' then
      raise exception 'FAIL 6: refused for the wrong reason, got %', sqlerrm;
    end if;
  end;

  -- 7 · Taking one back frees the place, which is what the panel tells a club
  -- to do when it is full.
  perform public.withdraw_featured_request(v_first);
  perform public.request_featured_slot(v_club, current_date + 35, '');
  if pg_temp.open_asks(v_club) <> 5 then
    raise exception 'FAIL 7: taking one back did not free a place, % open',
      pg_temp.open_asks(v_club);
  end if;

  -- 8 · A week taken back can be asked for again. The guard counts open asks,
  -- not every ask ever made, or a club that changed its mind in March could
  -- never ask for that week again.
  perform public.withdraw_featured_request(v_week);
  perform public.request_featured_slot(v_club, current_date + 14, 'Back on');
  if pg_temp.open_asks(v_club) <> 5 then
    raise exception 'FAIL 8: the withdrawn week was not askable again';
  end if;

  -- 9 · Still a club's own door, at the new signature as at the old one.
  perform pg_temp.be(v_member);
  begin
    perform public.request_featured_slot(v_club, current_date + 42, 'go on');
    raise exception 'FAIL 9: a stranger asked to be featured';
  exception when insufficient_privilege then null;
  end;

  raise notice 'sections 1-9 pass';
end $$;

\echo 'stage13-asking-for-more-than-one-week: all pass'
