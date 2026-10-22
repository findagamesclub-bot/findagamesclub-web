-- 0218 · a signed-out visitor can read a published event's analytics.
--
-- The assertion that matters is 1: the three event reads are one panel, so a
-- grant that admits anon to one of them and not the others is a panel that
-- draws nothing for the people it was written for. Every run of this screen
-- while it was built was signed in, which is exactly why nobody saw it.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

do $$
declare v_club bigint; v_event bigint; v_n int; v_err text;
begin
  select id into v_club from c;

  insert into public.club_events (club_id, legacy_id, title, start_date, status)
  values (v_club, 'public-rtt', 'RTT', public.london_today() - 7, 'published')
  returning id into v_event;

  -- 1 ---------------------------------- the three reads have one audience
  set local role anon;
  begin
    select count(*) into v_n from public.meta_event(v_event);
    select count(*) into v_n from public.meta_event_breakdown(v_event);
    select count(*) into v_n from public.meta_event_players(v_event);
    select count(*) into v_n from public.meta_event_matchups(v_event);
  exception
    when others then
      get stacked diagnostics v_err = message_text;
      reset role;
      raise exception 'FAIL 1: a signed-out visitor could not read the panel (%)', v_err;
  end;
  reset role;
  raise notice 'PASS 1: every read behind the event panel answers a signed-out visitor';

  -- 2 ------------------------------------------- and so does a member
  set local role authenticated;
  begin
    select count(*) into v_n from public.meta_event_breakdown(v_event);
    select count(*) into v_n from public.meta_event_players(v_event);
    select count(*) into v_n from public.meta_event_matchups(v_event);
  exception
    when others then
      get stacked diagnostics v_err = message_text;
      reset role;
      raise exception 'FAIL 2: a signed-in reader lost the panel (%)', v_err;
  end;
  reset role;
  raise notice 'PASS 2: and a signed-in reader still does';

  raise notice 'ALL PASS · 0218 event analytics are public';
end $$;

rollback;
