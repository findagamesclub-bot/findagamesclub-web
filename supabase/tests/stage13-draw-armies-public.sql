-- 0172 · the armies on a draw are as visible as the draw itself.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- Read as postgres, so the fixture can be counted whatever the policy is
-- doing to the session under test. Reading an id through RLS before a session
-- is set returns null and reports a missing fixture as a refusal, which this
-- suite has paid for three times.
create or replace function pg_temp.armies_on(p_match bigint)
returns bigint language sql security definer as $fn$
  select count(*) from public.game_result_armies
   where source_type = 'event_pairing' and source_id = p_match $fn$;

create or replace function pg_temp.match_id(p_event bigint)
returns bigint language sql security definer as $fn$
  select m.id from public.club_event_pairing_matches m
    join public.club_event_pairings p on p.id = m.pairing_id
   where p.event_id = p_event order by m.id limit 1 $fn$;

create or replace function pg_temp.publish(p_event bigint, p_on boolean)
returns void language sql security definer as $fn$
  update public.club_event_pairings set published = p_on where event_id = p_event $fn$;

insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select id, '2026-05-05-army-rtt', 'Army RTT', current_date - 20, 'published' from c;

do $$
declare
  w record; v_event bigint; v_round bigint; v_match bigint; v_seen bigint;
begin
  select * into w from who;
  select id into v_event from public.club_events where legacy_id = '2026-05-05-army-rtt';

  -- A round nobody has put on show yet, with one table on it.
  insert into public.club_event_pairings (event_id, round, published)
    values (v_event, 1, false) returning id into v_round;
  insert into public.club_event_pairing_matches
    (pairing_id, event_id, table_label, player_one, player_one_id,
     player_two, player_two_id, score_one, score_two, "position")
    values (v_round, v_event, '1', 'Member Eight', w.member,
            'Owner Eight', w.owner, 80, 60, 0)
    returning id into v_match;

  -- Written through the real writer, as somebody who may: a hand-rolled
  -- insert would not prove the row this policy actually has to answer for.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_pairing_armies(v_match, jsonb_build_object(
    'one', jsonb_build_object('factionId', 'adepta-sororitas',
                              'factionLabel', 'Adepta Sororitas',
                              'detachment', 'Hallowed Martyrs',
                              'disposition', 'Priority Assets'),
    'two', jsonb_build_object('factionId', 'adeptus-custodes',
                              'factionLabel', 'Adeptus Custodes',
                              'detachment', 'Shield Host',
                              'disposition', 'Purge the Foe')));
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if pg_temp.armies_on(v_match) <> 2 then
    raise exception 'FAIL 0: the fixture wrote % armies, not 2',
      pg_temp.armies_on(v_match);
  end if;

  -- 1 · A round that is not on show tells a signed-out visitor nothing.
  set local role anon;
  select count(*) into v_seen from public.game_result_armies
   where source_type = 'event_pairing' and source_id = v_match;
  reset role;
  if v_seen <> 0 then
    raise exception 'FAIL 1: anon read % armies on an unpublished round', v_seen;
  end if;

  -- 2 · Nor a signed-in stranger, who is in no club here.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen from public.game_result_armies
   where source_type = 'event_pairing' and source_id = v_match;
  reset role;
  if v_seen <> 0 then
    raise exception 'FAIL 2: a stranger read % armies on an unpublished round', v_seen;
  end if;

  -- 3 · The club's own member still does, which is what draws the console
  --     dialog while a round is being built.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen from public.game_result_armies
   where source_type = 'event_pairing' and source_id = v_match;
  reset role;
  if v_seen <> 2 then
    raise exception 'FAIL 3: a member read % armies, not 2', v_seen;
  end if;

  -- 4 · Put the round on show and the visitor reads what the tables say.
  perform pg_temp.publish(v_event, true);

  set local role anon;
  select count(*) into v_seen from public.game_result_armies
   where source_type = 'event_pairing' and source_id = v_match;
  reset role;
  if v_seen <> 2 then
    raise exception 'FAIL 4: anon read % armies on a published round, not 2', v_seen;
  end if;

  -- 5 · And so does a signed-in stranger, the same as the tables themselves.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen from public.game_result_armies
   where source_type = 'event_pairing' and source_id = v_match;
  reset role;
  if v_seen <> 2 then
    raise exception 'FAIL 5: a stranger read % armies on a published round, not 2',
      v_seen;
  end if;

  -- 6 · The audience is the ROUND, not the event. Taking it back off show
  --     takes the armies with it, or a club tidying a draw would be
  --     publishing armies it had just hidden.
  perform pg_temp.publish(v_event, false);
  set local role anon;
  select count(*) into v_seen from public.game_result_armies
   where source_type = 'event_pairing' and source_id = v_match;
  reset role;
  if v_seen <> 0 then
    raise exception 'FAIL 6: anon still read % armies after the round came off show',
      v_seen;
  end if;

  -- 7 · A club night's result is nobody else's business, published round or
  --     not. The booking armies in the seed share this table and must not
  --     have been opened up by any of the above.
  set local role anon;
  select count(*) into v_seen from public.game_result_armies
   where source_type = 'booking';
  reset role;
  if v_seen <> 0 then
    raise exception 'FAIL 7: anon read % booking armies', v_seen;
  end if;

  raise notice 'stage13 draw armies: all pass';
end $$;

rollback;
