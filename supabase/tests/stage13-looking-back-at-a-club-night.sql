-- 0213 · looking back at a club night.
--
-- The security assertion is 8: the past-nights list is members-only, because
-- `club_bookings_select` (0014) hides other people's past bookings on purpose
-- and this reads round it. The one worth having twice is 5, which pins that
-- the four groups partition: the Scores page prints a header figure and a tab
-- strip off the same counts, and the client counts them against each other.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Four nights that have already happened, across two months.
--
-- Inserted on future Thursdays and then backdated, because
-- `club_bookings_guard` refuses a past date on insert and that guard is worth
-- keeping. Same trick `stage10-links.sql` already uses, and the reason the
-- date filter under test can be measured at all: the seed's own booking is
-- still in the future, so a log that forgot to exclude it comes back with
-- five rows where there are four.
create or replace function pg_temp.seed_nights() returns void
language plpgsql security definer as $fn$
declare
  v_club bigint; v_session bigint; v_id bigint;
  -- The first of each month, so the two nights inside one of them can be a
  -- day apart without the second falling into the next month. They have to be
  -- a day apart at all because `club_booking_participants_one_per_date` allows
  -- one table per person per day, and the owner is on both.
  v_m1 date := date_trunc('month', public.london_today() - interval '2 months')::date;
  v_m2 date := date_trunc('month', public.london_today() - interval '1 month')::date;
  -- The night runs on a Thursday and the insert guard says so
  -- (BOOKING_SESSION_WRONG_DAY), so every fixture goes in on one before it is
  -- backdated. Same expression the seed uses for its own booking.
  v_thu date := current_date + (((4 - extract(isodow from current_date))::int + 6) % 7 + 1);
begin
  select id into v_club from public.clubs where slug = 'army-club';
  select id into v_session from public.club_sessions where club_id = v_club limit 1;

  -- Scored and settled: the member booked, the owner played.
  insert into public.club_bookings
    (club_id, club_session_id, session_date, booked_by, opponent_profile_id,
     game_title, table_index, status)
  values (v_club, v_session, v_thu + 7,
          'e0000000-0000-0000-0000-000000000003',
          'e0000000-0000-0000-0000-000000000001', 'Warhammer 40,000', 2, 'booked')
  returning id into v_id;
  update public.club_bookings
     set session_date = v_m1, booked_by_score = 20, opponent_score = 10,
         result_confirmation = 'admin-confirmed', result_mission = 'Take and Hold'
   where id = v_id;

  -- Scored and waiting on the club. A guest on the other side, so the member
  -- picker has somebody with no account to leave out.
  insert into public.club_bookings
    (club_id, club_session_id, session_date, booked_by, opponent_name,
     game_title, table_index, status)
  values (v_club, v_session, v_thu + 14,
          'e0000000-0000-0000-0000-000000000001', 'Walk In',
          'Blood Bowl', 3, 'booked')
  returning id into v_id;
  update public.club_bookings
     set session_date = v_m1 + 1, booked_by_score = 5, opponent_score = 5,
         result_confirmation = 'submitted'
   where id = v_id;

  -- Disputed, a month later.
  insert into public.club_bookings
    (club_id, club_session_id, session_date, booked_by, opponent_profile_id,
     game_title, table_index, status)
  values (v_club, v_session, v_thu + 21,
          'e0000000-0000-0000-0000-000000000003',
          'e0000000-0000-0000-0000-000000000001', 'Warhammer 40,000', 4, 'booked')
  returning id into v_id;
  update public.club_bookings
     set session_date = v_m2, booked_by_score = 3, opponent_score = 1,
         result_confirmation = 'disputed'
   where id = v_id;

  -- Nobody has typed a score on this one.
  insert into public.club_bookings
    (club_id, club_session_id, session_date, booked_by, opponent_name,
     game_title, table_index, status)
  values (v_club, v_session, v_thu + 28,
          'e0000000-0000-0000-0000-000000000001', 'Dave At The Door',
          'Kill Team', 5, 'booked')
  returning id into v_id;
  update public.club_bookings set session_date = v_m2 + 1 where id = v_id;
end $fn$;

select pg_temp.seed_nights();

-- One more past night, the same game typed with different capitals. Two rows
-- is the smallest fixture that can tell "folded" from "not folded", and
-- without it the case assertion passes whatever the function does.
create or replace function pg_temp.seed_casing() returns void
language plpgsql security definer as $fn$
declare
  v_club bigint; v_session bigint; v_id bigint;
  v_m2 date := date_trunc('month', public.london_today() - interval '1 month')::date;
  v_thu date := current_date + (((4 - extract(isodow from current_date))::int + 6) % 7 + 1);
begin
  select id into v_club from public.clubs where slug = 'army-club';
  select id into v_session from public.club_sessions where club_id = v_club limit 1;

  insert into public.club_bookings
    (club_id, club_session_id, session_date, booked_by, opponent_name,
     game_title, table_index, status)
  values (v_club, v_session, v_thu + 35,
          'e0000000-0000-0000-0000-000000000003', 'Walk In',
          'blood bowl', 0, 'booked')
  returning id into v_id;
  update public.club_bookings set session_date = v_m2 + 2 where id = v_id;
end $fn$;

create temp table months as select
  to_char(date_trunc('month', public.london_today() - interval '2 months'), 'YYYY-MM') as m1,
  to_char(date_trunc('month', public.london_today() - interval '1 month'), 'YYYY-MM')  as m2;
grant select on months to authenticated;

set local role authenticated;

do $$
declare
  w record; m record; v_club bigint; n bigint; v_all bigint; v_counted bigint;
  r record; v_text text;
begin
  select * into w from who;
  select * into m from months;
  select id into v_club from c;

  -- 1 · The club has months, games and players to narrow by, and every option
  --     has rows behind it. A dropdown offering a month with nothing in it is
  --     a control pretending to work.
  perform pg_temp.be(w.owner);
  select count(*) into n from public.club_booking_facets(v_club, 'all') where kind = 'month';
  if n < 2 then
    raise exception 'FAIL 1: the club offers % months, expected at least two', n;
  end if;
  select rows into n from public.club_booking_facets(v_club, 'all')
   where kind = 'month' and value = m.m1;
  if n <> 2 then
    raise exception 'FAIL 1b: the first month holds %, expected 2', n;
  end if;
  select rows into n from public.club_booking_facets(v_club, 'all')
   where kind = 'game' and value = 'Warhammer 40,000';
  if n <> 3 then
    -- Two of the four nights plus the seed's own future booking: the facets
    -- are about what the club HAS, which is a different question from what
    -- has been played, and the pickers sit above both screens.
    raise exception 'FAIL 1c: Warhammer 40,000 holds %, expected 3', n;
  end if;
  -- A guest typed at the door has no id to filter on, so the member picker
  -- offers the two accounts and nobody else.
  select count(*) into n from public.club_booking_facets(v_club, 'all') where kind = 'player';
  if n <> 2 then
    raise exception 'FAIL 1d: the member picker offers % people, expected 2', n;
  end if;

  -- 2 · A member may read them, because the past-nights view is theirs. A
  --     stranger may not.
  perform pg_temp.be(w.member);
  perform public.club_booking_facets(v_club, 'played');
  perform pg_temp.be(w.stranger);
  begin
    perform public.club_booking_facets(v_club, 'all');
    raise exception 'FAIL 2: a stranger read the club''s months';
  exception when insufficient_privilege then null;
  end;

  -- 3 · The money screen narrows to a month, and so do its counts. A tab
  --     reading "To pay 3" under September has to mean three in September.
  --     Four rows, not two: since 0221 the money screen is one row per
  --     PERSON, because a table's price is split between the two playing on
  --     it and the club collects each half separately.
  perform pg_temp.be(w.owner);
  select count(*) into n from public.club_table_bookings(v_club, 'all', '', m.m1);
  if n <> 4 then
    raise exception 'FAIL 3: the first month lists % sides, expected 4', n;
  end if;
  -- Compared against the list rather than against a number written twice:
  -- what this assertion is actually for is that the tab and the rows under it
  -- cannot disagree, and a hardcoded pair drifts apart the first time the
  -- fixture changes. That is how this one went stale.
  select all_rows into v_counted from public.club_table_booking_counts(v_club, '', m.m1);
  if v_counted <> n then
    raise exception 'FAIL 3b: the counts say % for a month the list says %', v_counted, n;
  end if;
  -- And an empty month is every night, never none.
  select all_rows into v_all from public.club_table_booking_counts(v_club, '', '');
  if v_all < 5 then
    raise exception 'FAIL 3c: every month counts %, expected the lot', v_all;
  end if;

  -- 4 · A night still to come is a booking, not a game. The seed's own
  --     booking is next Thursday and must not be in the log.
  select count(*) into n from public.club_played_log(v_club);
  if n <> 4 then
    raise exception 'FAIL 4: the log holds % rows, expected the four past ones', n;
  end if;

  -- 5 · The four groups partition. The Scores page prints a header figure and
  --     a tab strip off these counts, and a tab added without being taken out
  --     of another is how the two end up disagreeing.
  select all_rows, unscored, waiting, disputed, settled into r
    from public.club_played_log_counts(v_club);
  if r.unscored + r.waiting + r.disputed + r.settled <> r.all_rows then
    raise exception 'FAIL 5: % + % + % + % is not %',
      r.unscored, r.waiting, r.disputed, r.settled, r.all_rows;
  end if;
  if r.all_rows <> 4 or r.unscored <> 1 or r.waiting <> 1
     or r.disputed <> 1 or r.settled <> 1 then
    raise exception 'FAIL 5b: got all=% unscored=% waiting=% disputed=% settled=%',
      r.all_rows, r.unscored, r.waiting, r.disputed, r.settled;
  end if;
  -- Each group lists what it counted.
  select count(*) into n from public.club_played_log(v_club, 'disputed');
  if n <> 1 then
    raise exception 'FAIL 5c: the disputed group lists % rows', n;
  end if;

  -- 6 · The three axes narrow, and narrow together.
  select count(*) into n from public.club_played_log(v_club, 'all', m.m1);
  if n <> 2 then
    raise exception 'FAIL 6: one month lists % games, expected 2', n;
  end if;
  select count(*) into n from public.club_played_log(v_club, 'all', '', 'Kill Team');
  if n <> 1 then
    raise exception 'FAIL 6b: one game lists % rows, expected 1', n;
  end if;
  -- The member filter reaches somebody who PLAYED rather than only somebody
  -- who booked: the owner booked two of these and was the opponent on the
  -- other two, and a version matching on `booked_by` alone finds half.
  select count(*) into n from public.club_played_log(v_club, 'all', '', '', w.owner::text);
  if n <> 4 then
    raise exception 'FAIL 6c: the owner played % of the four', n;
  end if;
  select count(*) into n from public.club_played_log(v_club, 'all', '', '', w.member::text);
  if n <> 2 then
    raise exception 'FAIL 6d: the member played %, expected 2', n;
  end if;
  select count(*) into n
    from public.club_played_log(v_club, 'all', m.m2, '', w.member::text);
  if n <> 1 then
    raise exception 'FAIL 6e: one month and one member lists %, expected 1', n;
  end if;

  -- 7 · The counts obey every filter the list does, or a tab says three about
  --     somebody else's games.
  select all_rows into n from public.club_played_log_counts(v_club, m.m1);
  if n <> 2 then
    raise exception 'FAIL 7: the counts say % for a month the list says 2', n;
  end if;
  select all_rows into n
    from public.club_played_log_counts(v_club, '', '', w.member::text);
  if n <> 2 then
    raise exception 'FAIL 7b: the counts say % for a member the list says 2', n;
  end if;
  -- A guest's name is in the search, which is the only way to reach somebody
  -- with no account at all.
  select all_rows into n from public.club_played_log_counts(v_club, '', '', '', 'Dave');
  if n <> 1 then
    raise exception 'FAIL 7c: searching a guest''s name counted %', n;
  end if;

  -- 8 · A member may look back at the club's own nights, which is the whole
  --     item: `club_bookings_select` hides another member's past bookings, so
  --     without this they could see a night they were part of and nothing of
  --     the night itself. A stranger still may not.
  perform pg_temp.be(w.member);
  select count(*) into n from public.club_played_log(v_club);
  if n <> 4 then
    raise exception 'FAIL 8: a member read % of the club''s four nights', n;
  end if;
  perform pg_temp.be(w.stranger);
  begin
    perform public.club_played_log(v_club);
    raise exception 'FAIL 8b: a stranger read the club''s nights';
  exception when insufficient_privilege then null;
  end;

  -- 9 · Nothing about money is in it. That is `bookings.manage`'s question
  --     and it has its own screen; a member reading the nights must not be
  --     handed what the club charged somebody else.
  select string_agg(a.attname, ',') into v_text
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    cross join lateral unnest(p.proargnames) with ordinality as a(attname, ord)
   where ns.nspname = 'public' and p.proname = 'club_played_log'
     and a.attname like '%price%';
  if v_text is not null then
    raise exception 'FAIL 9: the played log returns %', v_text;
  end if;
  if exists (
    select 1 from pg_proc p
     join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = 'club_played_log'
       and position('payment_status' in pg_get_functiondef(p.oid)) > 0
  ) then
    raise exception 'FAIL 9b: the played log reads a payment column';
  end if;

  -- 10 · The trend is the club's own, and asks a capability a member has not
  --      got. It is why the member's page does not spend a round trip on it.
  perform pg_temp.be(w.owner);
  select count(*) into n from public.club_played_months(v_club);
  if n <> 2 then
    raise exception 'FAIL 10: the trend holds % months, expected 2', n;
  end if;
  select ruled, waiting, unscored into r
    from public.club_played_months(v_club) where month = m.m1;
  if r.ruled <> 1 or r.waiting <> 1 or r.unscored <> 0 then
    raise exception 'FAIL 10b: the first month reads ruled=% waiting=% unscored=%',
      r.ruled, r.waiting, r.unscored;
  end if;
  perform pg_temp.be(w.member);
  begin
    perform public.club_played_months(v_club);
    raise exception 'FAIL 10c: a member read the club''s trend';
  exception when insufficient_privilege then null;
  end;

  -- 11 · A member sees what the club recorded about their OWN tables and
  --      nobody else's. Invoker, so row security decides and nothing about
  --      who may read a booking is written out a second time.
  perform pg_temp.be(w.member);
  select count(*) into n from public.my_booking_payments(
    array(select id from public.club_bookings where club_id = v_club));
  if n < 1 then
    raise exception 'FAIL 11: a member could not read their own table''s money';
  end if;
  perform pg_temp.be(w.stranger);
  select count(*) into n from public.my_booking_payments(
    array(select id from public.club_bookings where club_id = v_club));
  if n <> 0 then
    raise exception 'FAIL 11b: a stranger read % of the club''s bookings', n;
  end if;

  -- 12 · 0214 · the counts answer the screen that is asking. Every booking
  --      for the money screen, only what was played for the two that look
  --      back. The Scores page offered "Sep 2026 (12)" and drew three games.
  perform pg_temp.be(w.owner);
  select rows into n from public.club_booking_facets(v_club, 'played')
   where kind = 'month' and value = m.m1;
  if n <> 2 then
    raise exception 'FAIL 12: played counts % for the first month, expected 2', n;
  end if;
  -- The same month, asked the other way, carries the one still to come as
  -- well. Neither figure is wrong; they are answers to different questions.
  select sum(f.rows) into n from public.club_booking_facets(v_club, 'all') f
   where f.kind = 'month';
  if n <> 5 then
    raise exception 'FAIL 12b: every booking counts %, expected 5', n;
  end if;
  select sum(f.rows) into n from public.club_booking_facets(v_club, 'played') f
   where f.kind = 'month';
  if n <> 4 then
    raise exception 'FAIL 12c: played counts %, expected the four past ones', n;
  end if;

  -- 13 · 0214 · the months read newest first. A month list is scanned by
  --      date; ordering it by how many bookings each holds gave
  --      "Sep 2026 (12), Oct 2026 (7), Aug 2026 (6)", which nobody can find
  --      September in without reading the lot.
  select string_agg(f.value, ',' order by f.ord) into v_text
    from (select value, row_number() over () as ord
            from public.club_booking_facets(v_club, 'played')
           where kind = 'month') f;
  if v_text <> m.m2 || ',' || m.m1 then
    raise exception 'FAIL 13: the months came back as %, expected newest first', v_text;
  end if;

  -- 14 · 0214 · a game typed with different capitals is one game. Two
  --      spellings that differ only in case are not information, and picking
  --      one of the pair showed half the games that are plainly the same.
  perform pg_temp.seed_casing();
  select count(*) into n from public.club_booking_facets(v_club, 'played')
   where kind = 'game' and lower(value) = 'blood bowl';
  if n <> 1 then
    raise exception 'FAIL 14: "Blood Bowl" and "blood bowl" came back as % options', n;
  end if;
  select rows into n from public.club_booking_facets(v_club, 'played')
   where kind = 'game' and lower(value) = 'blood bowl';
  if n <> 2 then
    raise exception 'FAIL 14b: the folded game holds %, expected both', n;
  end if;
  -- And the filter finds both, or picking the option shows one of the two.
  select count(*) into n from public.club_played_log(v_club, 'all', '', 'Blood Bowl');
  if n <> 2 then
    raise exception 'FAIL 14c: filtering on one spelling found % of the two', n;
  end if;
  select all_rows into n
    from public.club_played_log_counts(v_club, '', 'blood bowl');
  if n <> 2 then
    raise exception 'FAIL 14d: the counts found % for one spelling', n;
  end if;
end $$;

reset role;
rollback;
\echo '0213 looking back at a club night: all pass'
