-- 0167 · first, second and third, given automatically.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- The triggers are what is under test and none of them reads `auth.uid()`
-- except the notice, so the body below runs as postgres: every fixture here
-- is a row somebody else owns, and an ordinary session is hidden from all of
-- them by policy. The refusals have their own section at the end, with the
-- role assumed, because that is the only part where the session matters.
create or replace function pg_temp.holds(p_profile uuid, p_place integer)
returns bigint language sql security definer as $fn$
  select count(*) from public.member_badges m
    join public.club_badges b on b.id = m.badge_id
   where m.profile_id = p_profile and b.podium_rank = p_place
     and m.revoked_at is null $fn$;

create or replace function pg_temp.note_on(p_profile uuid, p_place integer)
returns text language sql security definer as $fn$
  select m.note from public.member_badges m
    join public.club_badges b on b.id = m.badge_id
   where m.profile_id = p_profile and b.podium_rank = p_place limit 1 $fn$;

create or replace function pg_temp.podium_badges(p_club bigint)
returns bigint language sql security definer as $fn$
  select count(*) from public.club_badges
   where club_id = p_club and podium_rank is not null $fn$;

create or replace function pg_temp.notices(p_profile uuid)
returns bigint language sql security definer as $fn$
  select count(*) from public.notifications
   where profile_id = p_profile and kind = 'badge-awarded' $fn$;

insert into public.club_events (club_id, legacy_id, title, start_date)
  select id, '2026-04-04-spring-rtt', 'Spring RTT', current_date - 60 from c;
insert into public.club_events (club_id, legacy_id, title, start_date)
  select id, '2026-05-02-may-rtt', 'May RTT', current_date - 30 from c;
insert into public.club_competitions (club_id, title, type, type_label, status)
  select id, 'Autumn Ladder', 'league', 'League', 'active' from c;

do $$
declare
  w record; v_club bigint; v_spring bigint; v_may bigint; v_comp bigint;
  v_badges integer; v_badge bigint;
begin
  -- 0174 made the podium triggers CONSTRAINT triggers deferred to commit, so
  -- that a save which deletes and re-inserts a whole standings table recounts
  -- once at the end rather than revoking and re-awarding as it goes. Inside
  -- one transaction that means they never fire, so this asks for them now and
  -- the assertions below read what a committed save would leave.
  set constraints all immediate;
  select * into w from who;
  select id into v_club from c;
  select id into v_spring from public.club_events where legacy_id = '2026-04-04-spring-rtt';
  select id into v_may from public.club_events where legacy_id = '2026-05-02-may-rtt';
  select id into v_comp from public.club_competitions limit 1;

  -- 1 · Every club starts with the three, seeded when it was created.
  v_badges := pg_temp.podium_badges(v_club);
  if v_badges <> 3 then
    raise exception 'FAIL 1: the club has % podium badges', v_badges;
  end if;

  -- 2 · A first place at an event awards on the spot, and the note says where.
  insert into public.club_event_results
    (event_id, rank, placement, member_name, member_profile_id)
  values (v_spring, 1, '1st', 'Member Eight', w.member);

  if pg_temp.holds(w.member, 1) <> 1 then
    raise exception 'FAIL 2: winning an event gave no badge';
  end if;
  if pg_temp.note_on(w.member, 1) not like '%Spring RTT%' then
    raise exception 'FAIL 3: the note does not name the event, got "%"',
      pg_temp.note_on(w.member, 1);
  end if;
  if pg_temp.notices(w.member) <> 1 then
    raise exception 'FAIL 4: % notices about one badge', pg_temp.notices(w.member);
  end if;

  -- 3 · Winning again adds no second badge. One place, one badge.
  insert into public.club_event_results
    (event_id, rank, placement, member_name, member_profile_id)
  values (v_may, 1, '1st', 'Member Eight', w.member);
  if pg_temp.holds(w.member, 1) <> 1 then
    raise exception 'FAIL 5: a second win made a second badge';
  end if;

  -- 4 · Fourth place is not a podium.
  insert into public.club_event_results
    (event_id, rank, placement, member_name, member_profile_id)
  values (v_may, 4, '4th', 'Owner Eight', w.owner);
  if pg_temp.holds(w.owner, 1) + pg_temp.holds(w.owner, 2)
     + pg_temp.holds(w.owner, 3) <> 0 then
    raise exception 'FAIL 6: fourth place was given a podium badge';
  end if;

  -- 5 · A league gives nothing while it is still running.
  insert into public.club_competition_standings
    (competition_id, profile_id, member_name, rank, played, wins, draws, losses)
  values (v_comp, w.owner, 'Owner Eight', 2, 6, 3, 1, 2),
         (v_comp, w.stranger, 'Stranger Eight', 3, 6, 2, 1, 3);
  if pg_temp.holds(w.owner, 2) <> 0 then
    raise exception 'FAIL 7: a league gave a badge before it was over';
  end if;

  -- 6 · Completing it gives all three at once, to a non-member as well: an
  -- open tournament puts people on the podium who have never joined.
  update public.club_competitions set status = 'completed' where id = v_comp;
  if pg_temp.holds(w.owner, 2) <> 1 then
    raise exception 'FAIL 8: second in a completed league gave no badge';
  end if;
  if pg_temp.holds(w.stranger, 3) <> 1 then
    raise exception 'FAIL 9: a non-member was refused their badge';
  end if;

  -- 7 · A table corrected after the close still reaches the badge.
  update public.club_competitions set status = 'completed' where id = v_comp;
  insert into public.club_competition_standings
    (competition_id, profile_id, member_name, rank, played, wins, draws, losses)
  values (v_comp, w.admin, 'Admin Eight', 1, 6, 5, 0, 1);
  if pg_temp.holds(w.admin, 1) <> 1 then
    raise exception 'FAIL 10: a late standing gave no badge';
  end if;

  -- 8 · An owner taking one off by hand is not undone by the next placing.
  select id into v_badge from public.club_badges
   where club_id = v_club and podium_rank = 1;
  update public.member_badges
     set revoked_at = now(), revoked_by = w.owner
   where badge_id = v_badge and profile_id = w.member;

  insert into public.club_event_results
    (event_id, rank, placement, member_name, member_profile_id)
  values (v_spring, 1, '1st', 'Member Eight', w.member);
  if pg_temp.holds(w.member, 1) <> 0 then
    raise exception 'FAIL 11: a revoked badge was handed back';
  end if;

  -- 9 · A placing with nobody behind it is not an error and not a badge.
  insert into public.club_event_results
    (event_id, rank, placement, member_name, member_profile_id)
  values (v_may, 2, '2nd', 'Somebody At The Door', null);

  raise notice 'stage13 podium badges: the awarding passes';
end $$;

-- The only part where the session matters: nothing above is reachable by hand.
set local role authenticated;

do $$
declare w record; v_ok boolean;
begin
  select * into w from who;
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);

  begin
    perform public.award_podium_badge(
      (select id from c), w.stranger, 1, 'Giving myself a trophy.');
    raise exception 'FAIL 12: a stranger awarded themselves a podium badge';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.seed_podium_badges((select id from c));
    raise exception 'FAIL 13: a stranger reseeded a club''s badges';
  exception when insufficient_privilege then null;
  end;

  -- The bands are reference data and are meant to be readable.
  select count(*) = 3 into v_ok from public.podium_badge_bands();
  if not v_ok then
    raise exception 'FAIL 14: the bands are not readable by a member';
  end if;

  raise notice 'stage13 podium badges: all pass';
end $$;

rollback;
