-- 0166 · a member's record, from everywhere they have played.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- `returns table` builds no composite type, so the rows come back through a
-- record variable rather than a typed helper.

-- A second night, so one booking can be settled and one left alone. The week
-- after, because the same two people cannot be down for two tables on one day.
insert into public.club_bookings
  (club_id, club_session_id, session_date, booked_by, opponent_profile_id,
   opponent_name, game_title, table_index, status)
  select c.id, s.id,
         current_date + (((4 - extract(isodow from current_date))::int + 6) % 7 + 1) + 7,
         'e0000000-0000-0000-0000-000000000003'::uuid,
         'e0000000-0000-0000-0000-000000000001'::uuid, 'Owner Eight',
         'Warhammer 40,000', 1, 'booked'
    from c, public.club_sessions s where s.club_id = c.id;

create temp table bk2 as
  select id from public.club_bookings order by id desc limit 1;

-- A scored night, settled by the club.
update public.club_bookings
   set booked_by_score = 80, opponent_score = 60,
       result_confirmation = 'admin-confirmed'
 where id = (select id from bk);

-- Scored and not settled yet. It counts too, which is the same bar the grudge
-- tracker on the same profile uses: a club that has not pressed confirm has
-- not made the game not happen.
update public.club_bookings
   set booked_by_score = 90, opponent_score = 10,
       result_confirmation = 'submitted'
 where id = (select id from bk2);

-- A night nobody has typed a score on at all. That one is not a game.
insert into public.club_bookings
  (club_id, club_session_id, session_date, booked_by, opponent_profile_id,
   opponent_name, game_title, table_index, status)
  select c.id, s.id,
         current_date + (((4 - extract(isodow from current_date))::int + 6) % 7 + 1) + 14,
         'e0000000-0000-0000-0000-000000000003'::uuid,
         'e0000000-0000-0000-0000-000000000001'::uuid, 'Owner Eight',
         'Warhammer 40,000', 1, 'booked'
    from c, public.club_sessions s where s.club_id = c.id;

-- A scored table of a draw, a table nobody has typed a score on, and a podium
-- finish. Only the first of the three is a game they have played.
insert into public.game_result_armies
  (source_type, source_id, side, club_id, played_on, profile_id,
   faction_id, faction_label, outcome)
  select 'event_pairing', 9001, 'one', c.id, current_date - 30,
         'e0000000-0000-0000-0000-000000000003', 'adeptus-custodes',
         'Adeptus Custodes', 'lost' from c;
insert into public.game_result_armies
  (source_type, source_id, side, club_id, played_on, profile_id,
   faction_id, faction_label, outcome)
  select 'event_pairing', 9002, 'one', c.id, current_date - 29,
         'e0000000-0000-0000-0000-000000000003', 'adeptus-custodes',
         'Adeptus Custodes', '' from c;
insert into public.game_result_armies
  (source_type, source_id, side, club_id, played_on, profile_id,
   faction_id, faction_label, outcome)
  select 'event_podium', 9003, 'one', c.id, current_date - 30,
         'e0000000-0000-0000-0000-000000000003', 'adeptus-custodes',
         'Adeptus Custodes', '' from c;

-- A league standing, which is the club's own tally.
insert into public.club_competitions (club_id, title, type, status)
  select id, 'Autumn Ladder', 'league', 'active' from c;
insert into public.club_competition_standings
  (competition_id, profile_id, member_name, rank, played, wins, draws, losses)
  select id, 'e0000000-0000-0000-0000-000000000003', 'Member Eight', 1, 6, 3, 1, 2
    from public.club_competitions;

set local role authenticated;

do $$
declare
  w record; r record;
begin
  select * into w from who;

  -- 1 · Their own record, all three sources.
  perform pg_temp.be(w.member);

  select * into r from public.member_overall_record(w.member) where source = 'club';
  if r.played <> 2 or r.wins <> 2 or r.draws <> 0 or r.losses <> 0 then
    raise exception 'FAIL 1: club nights read % played, % wins', r.played, r.wins;
  end if;

  select * into r from public.member_overall_record(w.member) where source = 'event';
  if r.played <> 1 or r.losses <> 1 then
    raise exception 'FAIL 2: event games read % played, % losses', r.played, r.losses;
  end if;

  select * into r from public.member_overall_record(w.member) where source = 'league';
  if r.played <> 6 or r.wins <> 3 or r.draws <> 1 or r.losses <> 2 then
    raise exception 'FAIL 3: the league tally read %-%-% over %',
      r.wins, r.draws, r.losses, r.played;
  end if;

  -- 2 · A clubmate reads the same answer. This is what puts it on a profile.
  perform pg_temp.be(w.owner);
  select * into r from public.member_overall_record(w.member) where source = 'club';
  if r.played <> 2 then
    raise exception 'FAIL 4: a clubmate read % club nights', r.played;
  end if;
  select * into r from public.member_overall_record(w.member) where source = 'league';
  if r.wins <> 3 then
    raise exception 'FAIL 5: a clubmate read % league wins', r.wins;
  end if;

  -- 3 · A site admin holds no membership row anywhere and still reads it.
  -- The panel was empty on every profile an admin opened until 0170.
  perform pg_temp.be(w.admin);
  select * into r from public.member_overall_record(w.member) where source = 'club';
  if r.played <> 2 then
    raise exception 'FAIL 3a: a site admin read % club nights', r.played;
  end if;

  -- 4 · Somebody who shares no club reads nothing at all.
  perform pg_temp.be(w.stranger);
  select * into r from public.member_overall_record(w.member) where source = 'club';
  if r.played <> 0 then
    raise exception 'FAIL 6: a stranger read % club nights', r.played;
  end if;
  select * into r from public.member_overall_record(w.member) where source = 'event';
  if r.played <> 0 then
    raise exception 'FAIL 7: a stranger read % event games', r.played;
  end if;
  select * into r from public.member_overall_record(w.member) where source = 'league';
  if r.played <> 0 then
    raise exception 'FAIL 8: a stranger read % league games', r.played;
  end if;

  -- 5 · The owner's own side of the one settled night is a loss.
  perform pg_temp.be(w.owner);
  select * into r from public.member_overall_record(w.owner) where source = 'club';
  if r.played <> 2 or r.losses <> 2 then
    raise exception 'FAIL 9: the opponent read % played, % losses', r.played, r.losses;
  end if;

  raise notice 'stage13 overall record: all pass';
end $$;

rollback;
