-- 0228 · one club night, not a whole month of them.
--
-- Section 3 is the break test: the nights a picker offers must be the nights
-- inside the month the reader has already chosen. Offering every night a club
-- has ever run is the list the month filter was added to avoid, and it is the
-- same mistake 0227 fixed from the other direction.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Three nights across two months. Inserted on a future Thursday and then
-- backdated, because `club_bookings_guard` refuses a past date on insert and
-- the session runs on a Thursday; the same trick the sibling suite uses.
create or replace function pg_temp.seed_nights()
returns table (m1 text, n1 date, n2 date, m2 text, n3 date) language plpgsql security definer as $fn$
declare
  v_club bigint; v_session bigint; v_id bigint;
  -- The first of each month, so two nights a day apart cannot straddle it.
  -- A day apart at all because one person may hold one table per date.
  v_a date := date_trunc('month', public.london_today() - interval '2 months')::date;
  v_b date := date_trunc('month', public.london_today() - interval '1 month')::date;
  v_thu date := current_date + (((4 - extract(isodow from current_date))::int + 6) % 7 + 1);
begin
  select id into v_club from public.clubs where slug = 'army-club';
  select id into v_session from public.club_sessions where club_id = v_club limit 1;

  insert into public.club_bookings
    (club_id, club_session_id, session_date, booked_by, opponent_profile_id,
     game_title, table_index, status)
  values (v_club, v_session, v_thu + 7, 'e0000000-0000-0000-0000-000000000003',
          'e0000000-0000-0000-0000-000000000001', 'Warhammer 40,000', 2, 'booked')
  returning id into v_id;
  update public.club_bookings set session_date = v_a where id = v_id;

  insert into public.club_bookings
    (club_id, club_session_id, session_date, booked_by, opponent_profile_id,
     game_title, table_index, status)
  values (v_club, v_session, v_thu + 14, 'e0000000-0000-0000-0000-000000000003',
          'e0000000-0000-0000-0000-000000000001', 'Blood Bowl', 3, 'booked')
  returning id into v_id;
  update public.club_bookings set session_date = v_a + 1 where id = v_id;

  insert into public.club_bookings
    (club_id, club_session_id, session_date, booked_by, opponent_profile_id,
     game_title, table_index, status)
  values (v_club, v_session, v_thu + 21, 'e0000000-0000-0000-0000-000000000003',
          'e0000000-0000-0000-0000-000000000001', 'Kill Team', 4, 'booked')
  returning id into v_id;
  update public.club_bookings set session_date = v_b where id = v_id;

  return query select to_char(v_a, 'YYYY-MM'), v_a, v_a + 1, to_char(v_b, 'YYYY-MM'), v_b;
end $fn$;

create temp table nights as select * from pg_temp.seed_nights();
grant select on nights to authenticated;

set local role authenticated;

do $$
declare
  w record; f record; v_club bigint; n bigint; v_sides bigint;
begin
  select * into w from who;
  select * into f from nights;
  select id into v_club from c;
  perform pg_temp.be(w.owner);

  -- ====================================================================== 1
  -- With no month chosen the picker offers no nights at all. A club three
  -- seasons in has run two hundred of them, and a list of two hundred is the
  -- thing the month filter already exists to prevent.
  -- ====================================================================== 1
  select count(*) into n
    from public.club_booking_facets(v_club, 'all', '') where kind = 'night';
  if n <> 0 then
    raise exception 'FAIL 1: % nights were offered before a month was picked', n;
  end if;
  raise notice 'PASS 1: no month, no nights';

  -- ====================================================================== 2
  -- Pick the month and its own nights appear, each carrying what it holds.
  -- Two bookings, two people charged on each, so two rows a night.
  -- ====================================================================== 2
  select count(*) into n
    from public.club_booking_facets(v_club, 'all', f.m1) where kind = 'night';
  if n <> 2 then
    raise exception 'FAIL 2: the first month offered % nights, expected 2', n;
  end if;
  select rows into v_sides
    from public.club_booking_facets(v_club, 'all', f.m1)
   where kind = 'night' and value = to_char(f.n1, 'YYYY-MM-DD');
  if coalesce(v_sides, 0) < 1 then
    raise exception 'FAIL 2b: the first night counted %', v_sides;
  end if;
  raise notice 'PASS 2: the month''s own nights are offered, with what each holds';

  -- ====================================================================== 3
  -- BREAK TEST. The nights belong to the month that was picked and to no
  -- other. A picker that ignored the month would hand back the other month's
  -- night as well, and picking it would narrow the list to nothing while the
  -- month above still said otherwise.
  -- ====================================================================== 3
  select count(*) into n
    from public.club_booking_facets(v_club, 'all', f.m1)
   where kind = 'night' and value = to_char(f.n3, 'YYYY-MM-DD');
  if n <> 0 then
    raise exception
      'FAIL 3: a night from another month was offered under %', f.m1;
  end if;
  -- And the other month offers its own, so this is narrowing rather than
  -- an empty list that happens to look right.
  select count(*) into n
    from public.club_booking_facets(v_club, 'all', f.m2) where kind = 'night';
  if n <> 1 then
    raise exception 'FAIL 3b: the second month offered % nights, expected 1', n;
  end if;
  raise notice 'PASS 3: break test — a month offers its own nights and no others';

  -- ====================================================================== 4
  -- The list narrows to the one night, and the month on its own is wider.
  -- ====================================================================== 4
  select count(*) into v_sides
    from public.club_table_bookings(v_club, 'all', '', f.m1, null, 'newest', 1, 100);
  select count(*) into n
    from public.club_table_bookings(v_club, 'all', '', f.m1, f.n1, 'newest', 1, 100);
  if n >= v_sides then
    raise exception
      'FAIL 4: one night held % of the month''s % rows — it did not narrow', n, v_sides;
  end if;
  if n <> 2 then
    raise exception 'FAIL 4b: the night held % rows, expected both sides of one table', n;
  end if;
  raise notice 'PASS 4: the list narrows to a single club night';

  -- ====================================================================== 5
  -- And the counts narrow with it. A tab reading "To pay 2" under a night has
  -- to mean two that night, which is the same rule 0227 wrote for the tabs on
  -- the featured board.
  -- ====================================================================== 5
  select all_rows into n
    from public.club_table_booking_counts(v_club, '', f.m1, f.n1);
  if n <> 2 then
    raise exception 'FAIL 5: the counts say % for a night the list says 2', n;
  end if;
  select all_rows into n from public.club_table_booking_counts(v_club, '', f.m1, null);
  if n <> v_sides then
    raise exception 'FAIL 5b: the month counts % against a list of %', n, v_sides;
  end if;
  raise notice 'PASS 5: the counts narrow with the night';

  -- ====================================================================== 6
  -- A night with nothing on it answers nothing rather than everything. A
  -- filter that falls back to the whole list when it does not recognise its
  -- argument is worse than one that refuses.
  -- ====================================================================== 6
  select count(*) into n
    from public.club_table_bookings(v_club, 'all', '', f.m1,
                                    f.n1 - 400, 'newest', 1, 100);
  if n <> 0 then
    raise exception 'FAIL 6: a night nobody played held % rows', n;
  end if;
  raise notice 'PASS 6: a night with nothing on it answers nothing';

  -- ====================================================================== 7
  -- And none of it is readable by somebody who does not run the club.
  -- ====================================================================== 7
  perform pg_temp.be(w.stranger);
  begin
    perform public.club_table_bookings(v_club, 'all', '', '', null, 'newest', 1, 10);
    raise exception 'FAIL 7: a stranger read the club''s table payments';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.club_booking_facets(v_club, 'all', '');
    raise exception 'FAIL 7: a stranger read the club''s nights';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 7: a stranger reads neither the list nor the nights';

  raise notice 'ALL PASS · 0228 one club night';
end $$;

rollback;
