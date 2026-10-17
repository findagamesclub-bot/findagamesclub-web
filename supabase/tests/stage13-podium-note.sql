-- 0182 · a podium badge says what it is for, and keeps saying it.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- Two events the same member wins, months apart, so "the most recent" has
-- something to be more recent than.
insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select id, 'spring-open-182', 'Spring Open', current_date - 120, 'published' from c;
insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select id, 'autumn-open-182', 'Autumn Open', current_date - 10, 'published' from c;

create temp table ev as select
  (select id from public.club_events where legacy_id = 'spring-open-182') as spring,
  (select id from public.club_events where legacy_id = 'autumn-open-182') as autumn;

-- The podium triggers are CONSTRAINT triggers deferred to commit (0174), so
-- inside one transaction they never fire and a test watches nothing happen.
set constraints all immediate;

do $$
declare
  w record; v_spring bigint; v_autumn bigint; v_badge bigint;
  v_note text; v_rows integer;
begin
  select * into w from who;
  select spring, autumn into v_spring, v_autumn from ev;

  select id into v_badge from public.club_badges
   where club_id = (select id from c) and podium_rank = 1 and active;
  if v_badge is null then
    raise exception 'FAIL 1: the club has no First place badge to award';
  end if;

  -- 1 · One win. The badge lands and names it.
  insert into public.club_event_results
    (event_id, rank, placement, member_name, member_profile_id)
  values (v_spring, 1, '1st place', 'Member Eight', w.member);

  select note into v_note from public.member_badges
   where badge_id = v_badge and profile_id = w.member and revoked_at is null;
  if v_note is distinct from '1st place at Spring Open.' then
    raise exception 'FAIL 2: one win reads "%"', v_note;
  end if;

  -- 2 · A second win MOVES the note, and does not file a second badge. This
  --     is the whole item: the client recorded a first place for somebody who
  --     already held it and nothing on any screen changed.
  insert into public.club_event_results
    (event_id, rank, placement, member_name, member_profile_id)
  values (v_autumn, 1, '1st place', 'Member Eight', w.member);

  select count(*) into v_rows from public.member_badges
   where badge_id = v_badge and profile_id = w.member and revoked_at is null;
  if v_rows <> 1 then
    raise exception 'FAIL 3: two wins filed % badges rather than 1', v_rows;
  end if;

  -- 0199 took ", and 1 more." back off. The chip counts the wins and opens
  -- the list (0198), so the note saying it too was the same fact twice, in the
  -- exact words the client objected to. What still has to hold is the half
  -- 0182 was really about: the note MOVES to the newest win rather than
  -- staying on the first, which is what "does not show or update" meant.
  select note into v_note from public.member_badges
   where badge_id = v_badge and profile_id = w.member and revoked_at is null;
  if v_note is distinct from '1st place at Autumn Open.' then
    raise exception 'FAIL 4: two wins read "%"', v_note;
  end if;

  -- 3 · The newest is named, whichever order they were recorded in. Before
  --     0182 the note came from a `limit 1` with no `order by`, so this was
  --     whatever the planner felt like.
  if (select note from public.podium_finishes(
        (select id from c), w.member, 1) limit 1)
     is distinct from '1st place at Autumn Open.' then
    raise exception 'FAIL 5: the finishes are not newest first';
  end if;

  -- 4 · Taking the newer win away puts the note back rather than leaving it
  --     describing an event this member no longer placed at.
  delete from public.club_event_results where event_id = v_autumn;

  select note into v_note from public.member_badges
   where badge_id = v_badge and profile_id = w.member and revoked_at is null;
  if v_note is distinct from '1st place at Spring Open.' then
    raise exception 'FAIL 6: after removing the later win the note reads "%"', v_note;
  end if;

  -- 5 · And the last one going takes the badge with it, which is 0174.
  delete from public.club_event_results where event_id = v_spring;

  select count(*) into v_rows from public.member_badges
   where badge_id = v_badge and profile_id = w.member and revoked_at is null;
  if v_rows <> 0 then
    raise exception 'FAIL 7: the badge outlived every finish behind it';
  end if;

  -- 6 · A note an owner typed by hand is theirs and is not rewritten. The
  --     recount only ever edits what the system wrote.
  insert into public.member_badges (club_id, badge_id, profile_id, note, awarded_by)
  values ((select id from c), v_badge, w.member, 'For services to the raffle.', w.owner);

  insert into public.club_event_results
    (event_id, rank, placement, member_name, member_profile_id)
  values (v_spring, 1, '1st place', 'Member Eight', w.member);

  select note into v_note from public.member_badges
   where badge_id = v_badge and profile_id = w.member and revoked_at is null;
  if v_note is distinct from 'For services to the raffle.' then
    raise exception 'FAIL 8: an owner''s own words were overwritten with "%"', v_note;
  end if;

  raise notice 'stage13 podium note: all pass';
end $$;

rollback;
