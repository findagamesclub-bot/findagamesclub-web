-- Stage 6: owner analytics (0117) and the admin lists (0118).
--
--   scripts/pg-harness.sh build
--   scripts/pg-harness.sh psql -f supabase/tests/stage6.sql
--
-- Everything runs inside a transaction that rolls back, so it can be run
-- against the harness as often as you like. It asserts figures, not just that
-- the functions execute: the four bugs this file exists because of all ran
-- fine against an invented schema and returned the wrong answer or threw
-- against the real one.

\i supabase/tests/stage6-seed.sql
\set QUIET on
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

create temp table r as
select (select id from public.clubs where slug='real-club') as club;

do $$
declare c bigint; d1 date; d2 date; j jsonb; n int;
begin
  select club into c from r;
  d1 := public.london_today() - 90; d2 := public.london_today();

  j := public.club_analytics_summary(c, d1, d2);
  assert (j->>'members')::int = 2, 'roster should be 2 approved, got ' || (j->>'members');
  assert (j->>'tableBookings')::int = 2,
    'table bookings should be 2 (one cancelled, one older), got ' || (j->>'tableBookings');
  assert (j->>'eventTickets')::int = 2,
    'event tickets should be 2 (one cancelled), got ' || (j->>'eventTickets');
  assert (j->>'posts')::int = 1, 'a removed post must not count, got ' || (j->>'posts');
  assert (j->>'replies')::int = 1, 'replies should be 1, got ' || (j->>'replies');
  assert (j->>'activeMembers')::int = 2,
    'both members did something, got ' || (j->>'activeMembers');
  assert (j->>'newMembers')::int = 1,
    'only one joined inside the window, got ' || (j->>'newMembers');
  raise notice 'PASS summary: every headline figure is right';

  j := public.club_analytics_nights(c, d1, d2);
  assert jsonb_array_length(j->'nights') = 1, 'one club night has bookings';
  assert (j->'nights'->0->>'bookings')::int = 2, 'two bookings on it';
  assert jsonb_array_length(j->'sellThrough') = 1, 'one published event in the window';
  assert (j->'sellThrough'->0->>'places')::int = 40,
    'places come from quantity_available, got ' || (j->'sellThrough'->0->>'places');
  assert (j->'sellThrough'->0->>'sold')::int = 2, 'two sold, the cancelled one is not';
  raise notice 'PASS nights: sell-through reads the real column';

  j := public.club_analytics_people(c, d1, d2);
  assert jsonb_array_length(j->'mostActive') >= 1, 'somebody is turning up';
  raise notice 'PASS people: the leaderboards build';

  j := public.club_analytics_memberships(c);
  assert (j->>'total')::int = 2, 'two on the roster, got ' || (j->>'total');
  raise notice 'PASS memberships: the roster matches the summary';

  -- The two must never disagree about the same club.
  assert (public.club_analytics_summary(c, d1, d2)->>'members')::int
       = (public.club_analytics_memberships(c)->>'total')::int,
    'the headline roster and membership health disagree';
  raise notice 'PASS agreement: headline roster equals membership health';
end $$;

-- A member of no club must be refused all six, not given zeros.
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
declare c bigint; refused int := 0; d1 date; d2 date;
begin
  select club into c from r;
  d1 := public.london_today() - 90; d2 := public.london_today();
  begin perform public.club_analytics_summary(c, d1, d2); exception when others then refused := refused + 1; end;
  begin perform public.club_analytics_money(c, d1, d2); exception when others then refused := refused + 1; end;
  begin perform public.club_analytics_people(c, d1, d2); exception when others then refused := refused + 1; end;
  begin perform public.club_analytics_nights(c, d1, d2); exception when others then refused := refused + 1; end;
  begin perform public.club_analytics_months(c, 3); exception when others then refused := refused + 1; end;
  begin perform public.club_analytics_memberships(c); exception when others then refused := refused + 1; end;
  assert refused = 6, 'a stranger got through to ' || (6 - refused) || ' of the six';
  raise notice 'PASS guard: all six refuse somebody who does not run the club';
end $$;

-- Admin lists.
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$
declare n int; t text; j jsonb;
begin
  select count(*) into n from public.admin_clubs('', '', 25, 0);
  assert n = 2, 'admin sees both clubs including the paused one, got ' || n;
  select count(*) into n from public.admin_clubs('leeds', '', 25, 0);
  assert n = 1, 'search matches the town, got ' || n;
  select count(*) into n from public.admin_clubs('', 'paused', 25, 0);
  assert n = 1, 'the status tab narrows, got ' || n;
  select members into n from public.admin_clubs('leeds', '', 25, 0);
  assert n = 2, 'the club carries its approved member count, got ' || n;
  select owner_name into t from public.admin_clubs('leeds', '', 25, 0);
  assert t = 'Owner One', 'the club names who runs it, got ' || coalesce(t, 'null');
  select owner_name into t from public.admin_clubs('hull', '', 25, 0);
  assert t = '', 'a club with nobody running it answers empty, not null';
  raise notice 'PASS admin_clubs: filters, counts and the owner all read right';

  j := public.admin_club_counts('');
  assert (j->>'all')::int = 2 and (j->>'active')::int = 1 and (j->>'paused')::int = 1,
    'club tab counts are wrong: ' || j::text;
  j := public.admin_club_counts('leeds');
  assert (j->>'all')::int = 1, 'the counts narrow with the search too: ' || j::text;
  raise notice 'PASS admin_club_counts: they narrow with the search';

  select title into t from public.admin_events('', '', 'upcoming', 25, 0) limit 1;
  assert t = 'Soon', 'the soonest event leads the Upcoming tab, got ' || coalesce(t, 'null');
  select count(*) into n from public.admin_events('', '', 'past', 25, 0);
  assert n = 1, 'one event has happened, got ' || n;
  select count(*) into n from public.admin_events('', '', '', 25, 0);
  assert n = 2, 'the All tab holds both, got ' || n;
  select places into n from public.admin_events('', '', 'past', 25, 0);
  assert n = 40, 'places come from quantity_available, got ' || n;
  select sold into n from public.admin_events('', '', 'past', 25, 0);
  assert n = 2, 'sold excludes the cancelled ticket, got ' || n;
  select count(*) into n from public.admin_events('leeds', '', '', 25, 0);
  assert n = 2, 'searching a town finds that club''s events, got ' || n;
  raise notice 'PASS admin_events: order, tabs, places and sold all read right';

  j := public.admin_event_counts('');
  assert (j->>'upcoming')::int = 1 and (j->>'past')::int = 1 and (j->>'all')::int = 2,
    'event tab counts are wrong: ' || j::text;
  raise notice 'PASS admin_event_counts: upcoming and past split correctly';
end $$;

-- And a member must not reach either list.
select set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$
declare refused int := 0;
begin
  begin perform * from public.admin_clubs('', '', 25, 0); exception when others then refused := refused + 1; end;
  begin perform * from public.admin_events('', '', '', 25, 0); exception when others then refused := refused + 1; end;
  begin perform public.admin_club_counts(''); exception when others then refused := refused + 1; end;
  begin perform public.admin_event_counts(''); exception when others then refused := refused + 1; end;
  assert refused = 4, 'a member reached ' || (4 - refused) || ' of the four admin reads';
  raise notice 'PASS admin guard: a member reaches none of the four';
end $$;
rollback;
