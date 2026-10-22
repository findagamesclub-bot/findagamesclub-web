-- 0211 · a place at a team event is booked under a team name.
--
-- The assertion that matters is 3: the name is kept only at a team event. A
-- team name on an event that is not run as teams is a field nobody will ever
-- read back, and the console groups on it.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.seed_events()
returns table (team_event bigint, plain_event bigint, ticket bigint, plain_ticket bigint)
language plpgsql security definer as $fn$
declare v_club bigint; v_team bigint; v_plain bigint; v_t1 bigint; v_t2 bigint;
begin
  select id into v_club from public.clubs where slug = 'army-club';

  insert into public.club_events (club_id, legacy_id, title, start_date, status, team_event)
  values (v_club, '2099-03-03-team-open', 'Team Open', current_date + 30, 'published', true)
  returning id into v_team;

  insert into public.club_events (club_id, legacy_id, title, start_date, status, team_event)
  values (v_club, '2099-03-04-singles', 'Singles Open', current_date + 30, 'published', false)
  returning id into v_plain;

  insert into public.club_event_ticket_types
    (event_id, label, price, quantity_available, audience)
  values (v_team, 'Entry', 'GBP 20', 50, 'all') returning id into v_t1;
  insert into public.club_event_ticket_types
    (event_id, label, price, quantity_available, audience)
  values (v_plain, 'Entry', 'GBP 20', 50, 'all') returning id into v_t2;

  return query select v_team, v_plain, v_t1, v_t2;
end $fn$;

create temp table fx as select * from pg_temp.seed_events();
grant select on fx to authenticated;

set local role authenticated;

do $$
declare w record; f record; r record; n bigint; v_name text; v_made boolean;
begin
  select * into w from who;
  select * into f from fx;

  -- 1 · The club books two people in under one team, and one under another.
  perform pg_temp.be(w.owner);
  perform public.club_add_event_booking(
    f.team_event, w.member, 'Member Eight', 'member8@example.com',
    'FAGC-TEAM01', f.ticket, 1, '  Red Dice  ');
  perform public.club_add_event_booking(
    f.team_event, null, 'Ben Shah', 'ben@example.com',
    'FAGC-TEAM02', f.ticket, 1, 'red dice');
  perform public.club_add_event_booking(
    f.team_event, null, 'Cat Moss', 'cat@example.com',
    'FAGC-TEAM03', f.ticket, 1, 'Blue Dice');

  select team_name into v_name from public.club_event_bookings
   where reference = 'FAGC-TEAM01';
  if v_name <> 'Red Dice' then
    raise exception 'FAIL 1: the team came back as "%", untrimmed', v_name;
  end if;

  -- 2 · The console groups them, folding on case: "Red Dice" and "red dice"
  --     are one team told to the club twice.
  select count(*) into n from public.event_booked_teams(f.team_event);
  if n <> 2 then
    raise exception 'FAIL 2: % booked teams, expected Red Dice and Blue Dice', n;
  end if;
  select * into r from public.event_booked_teams(f.team_event)
   where lower(team_name) = 'red dice';
  if r.people <> 2 then
    raise exception 'FAIL 2b: Red Dice has % people, expected both', r.people;
  end if;
  if jsonb_array_length(r.players) <> 2 then
    raise exception 'FAIL 2c: Red Dice carries % players', jsonb_array_length(r.players);
  end if;

  -- 3 · And a team name on an event that is NOT run as teams is dropped. The
  --     console groups on this column and a name nothing can read back is a
  --     field that will drift out of step with the teams themselves.
  perform public.club_add_event_booking(
    f.plain_event, null, 'Dave Lin', 'dave@example.com',
    'FAGC-PLAIN1', f.plain_ticket, 1, 'Red Dice');
  select team_name into v_name from public.club_event_bookings
   where reference = 'FAGC-PLAIN1';
  if v_name <> '' then
    raise exception 'FAIL 3: a singles event kept the team name "%"', v_name;
  end if;

  -- 4 · "Who is coming" carries it, which is the half the client asked for in
  --     those words.
  select team_name into v_name from public.club_event_roster(f.team_event)
   where full_name = 'Member Eight';
  if v_name <> 'Red Dice' then
    raise exception 'FAIL 4: the roster says "%" for a Red Dice booking', v_name;
  end if;

  -- 5 · So does the door list, so the club can see who is with whom at the
  --     desk.
  select team_name into v_name from public.club_event_door_list(f.team_event)
   where reference = 'FAGC-TEAM03';
  if v_name <> 'Blue Dice' then
    raise exception 'FAIL 5: the door list says "%"', v_name;
  end if;

  -- 6 · `made` says whether the club has turned that name into a real team,
  --     so the console can offer the press once and not twice.
  select made into v_made from public.event_booked_teams(f.team_event)
   where lower(team_name) = 'red dice';
  if v_made then
    raise exception 'FAIL 6: Red Dice reads as made before anybody made it';
  end if;
  perform public.save_event_team(f.team_event, null, 'Red Dice', null, 1, '[]'::jsonb);
  select made into v_made from public.event_booked_teams(f.team_event)
   where lower(team_name) = 'red dice';
  if not v_made then
    raise exception 'FAIL 6b: Red Dice still reads as not made';
  end if;

  -- 7 · A cancelled place is not somebody who is coming, so it leaves the
  --     grouping as well as the roster.
  update public.club_event_bookings set status = 'cancelled'
   where reference = 'FAGC-TEAM03';
  select count(*) into n from public.event_booked_teams(f.team_event);
  if n <> 1 then
    raise exception 'FAIL 7: % booked teams after a cancellation, expected one', n;
  end if;

  -- 8 · And it is the club's read, not everybody's.
  perform pg_temp.be(w.stranger);
  begin
    perform public.event_booked_teams(f.team_event);
    raise exception 'FAIL 8: a stranger read the booked teams';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;

\echo '0211 booked under a team: all pass'
