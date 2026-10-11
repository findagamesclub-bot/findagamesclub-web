-- 0174 · a podium badge follows the placing it came from.
-- Run with scripts/pg-harness.sh psql -f this.
--
-- The triggers are CONSTRAINT triggers deferred to commit, so inside one
-- transaction they do not fire until something forces them to. `set
-- constraints all immediate` is that something, and it is also how this file
-- models a real save: everything between two of them is one transaction's
-- worth of work, recounted once at the end.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.holds(p_profile uuid, p_place integer)
returns bigint language sql security definer as $fn$
  select count(*) from public.member_badges m
    join public.club_badges b on b.id = m.badge_id
   where m.profile_id = p_profile and b.podium_rank = p_place
     and m.revoked_at is null $fn$;

create or replace function pg_temp.system_took(p_profile uuid, p_place integer)
returns bigint language sql security definer as $fn$
  select count(*) from public.member_badges m
    join public.club_badges b on b.id = m.badge_id
   where m.profile_id = p_profile and b.podium_rank = p_place
     and m.revoked_at is not null and m.revoked_by is null $fn$;

create or replace function pg_temp.notices(p_profile uuid, p_kind text)
returns bigint language sql security definer as $fn$
  select count(*) from public.notifications
   where profile_id = p_profile and kind = p_kind $fn$;

create or replace function pg_temp.rows_for(p_profile uuid, p_place integer)
returns bigint language sql security definer as $fn$
  select count(*) from public.member_badges m
    join public.club_badges b on b.id = m.badge_id
   where m.profile_id = p_profile and b.podium_rank = p_place $fn$;

insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select id, '2026-03-03-spring-rtt', 'Spring RTT', current_date - 40, 'published' from c;
insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select id, '2026-04-04-summer-rtt', 'Summer RTT', current_date - 30, 'published' from c;

create temp table ids (spring bigint, summer bigint, res bigint, other bigint,
                       comp bigint, badge2 bigint);
insert into ids (spring, summer)
  select (select id from public.club_events where legacy_id = '2026-03-03-spring-rtt'),
         (select id from public.club_events where legacy_id = '2026-04-04-summer-rtt');

-- 1 · Second at the Spring RTT gives the second place badge.
with ins as (
  insert into public.club_event_results
    (event_id, rank, placement, member_name, member_profile_id)
  select spring, 2, '2nd', 'Member Eight',
         'e0000000-0000-0000-0000-000000000003'::uuid from ids
  returning id)
update ids set res = (select id from ins);
set constraints all immediate;

do $$
declare w record;
begin
  select * into w from who;
  if pg_temp.holds(w.member, 2) <> 1 then
    raise exception 'FAIL 1: second place gave no badge';
  end if;
end $$;

-- 2 · The client's own example. Corrected to third, and only the third place
--     badge is left.
set constraints all deferred;
update public.club_event_results set rank = 3, placement = '3rd'
 where id = (select res from ids);
set constraints all immediate;

do $$
declare w record;
begin
  select * into w from who;
  if pg_temp.holds(w.member, 2) <> 0 then
    raise exception 'FAIL 2: the second place badge survived the correction';
  end if;
  if pg_temp.holds(w.member, 3) <> 1 then
    raise exception 'FAIL 3: third place gave no badge';
  end if;
  -- The system took it, not a person. That is what lets it come back.
  if pg_temp.system_took(w.member, 2) <> 1 then
    raise exception 'FAIL 4: the revoke was not marked as the system''s';
  end if;

  -- Both ways, which is the rule the client asked for in 0126. Their
  -- achievement genuinely changed, so neither half is bookkeeping to be
  -- quiet about.
  if pg_temp.notices(w.member, 'badge-taken-back') <> 1 then
    raise exception 'FAIL 4b: % notices about the badge going',
      pg_temp.notices(w.member, 'badge-taken-back');
  end if;
  if pg_temp.notices(w.member, 'badge-awarded') <> 2 then
    raise exception 'FAIL 4c: % notices about a badge arriving, expected 2',
      pg_temp.notices(w.member, 'badge-awarded');
  end if;
end $$;

-- 3 · And back again. 0167 refused to award where any row existed at all,
--     which would have left them holding nothing here.
set constraints all deferred;
update public.club_event_results set rank = 2, placement = '2nd'
 where id = (select res from ids);
set constraints all immediate;

do $$
declare w record;
begin
  select * into w from who;
  if pg_temp.holds(w.member, 2) <> 1 then
    raise exception 'FAIL 5: the second place badge did not come back';
  end if;
  if pg_temp.holds(w.member, 3) <> 0 then
    raise exception 'FAIL 6: the third place badge was left behind';
  end if;
end $$;

-- 4 · THE REASON 0167 GAVE FOR NOT DOING ANY OF THIS. Two seconds at two
--     events, one corrected: the badge stays, because the other is still there.
set constraints all deferred;
with ins as (
  insert into public.club_event_results
    (event_id, rank, placement, member_name, member_profile_id)
  select summer, 2, '2nd', 'Member Eight',
         'e0000000-0000-0000-0000-000000000003'::uuid from ids
  returning id)
update ids set other = (select id from ins);
set constraints all immediate;

set constraints all deferred;
update public.club_event_results set rank = 3, placement = '3rd'
 where id = (select other from ids);
set constraints all immediate;

do $$
declare w record;
begin
  select * into w from who;
  if pg_temp.holds(w.member, 2) <> 1 then
    raise exception 'FAIL 7: correcting one of two seconds took the badge away';
  end if;
end $$;

-- 5 · Take the other one away as well and now there is nothing left.
set constraints all deferred;
delete from public.club_event_results where id = (select res from ids);
set constraints all immediate;

do $$
declare w record;
begin
  select * into w from who;
  if pg_temp.holds(w.member, 2) <> 0 then
    raise exception 'FAIL 8: the badge survived with no second place left';
  end if;
end $$;

-- 6 · A badge an owner handed out by hand is theirs, not the recount's.
update ids set badge2 = (
  select id from public.club_badges
   where club_id = (select id from c) and podium_rank = 2 and active);

do $$
declare w record; v_badge bigint;
begin
  select * into w from who;
  select badge2 into v_badge from ids;

  insert into public.member_badges (club_id, badge_id, profile_id, note, awarded_by)
    values ((select id from c), v_badge, w.member, 'For services to the raffle.', w.owner);

  -- Nothing about their placings changed, so a recount runs and must leave it.
  perform public.sync_podium_badges((select id from c), w.member);
  if pg_temp.holds(w.member, 2) <> 1 then
    raise exception 'FAIL 9: the recount took back a badge an owner gave by hand';
  end if;

  -- And an owner's revoke still sticks: the system must not hand it back.
  update public.member_badges set revoked_at = now(), revoked_by = w.owner
   where badge_id = v_badge and profile_id = w.member and revoked_at is null;
end $$;

set constraints all deferred;
insert into public.club_event_results
  (event_id, rank, placement, member_name, member_profile_id)
select summer, 2, '2nd', 'Member Eight again',
       'e0000000-0000-0000-0000-000000000003'::uuid from ids;
set constraints all immediate;

do $$
declare w record;
begin
  select * into w from who;
  if pg_temp.holds(w.member, 2) <> 0 then
    raise exception 'FAIL 10: a badge an owner revoked was handed back';
  end if;
  raise notice 'stage13 podium placings: all pass';
end $$;

-- ------------------------------------------------------------- the league

insert into public.club_competitions (club_id, title, status)
  select id, 'Winter Ladder', 'active' from c;
update ids set comp = (select id from public.club_competitions where title = 'Winter Ladder');

set constraints all deferred;
insert into public.club_competition_standings
  (competition_id, rank, member_name, profile_id)
select comp, 2, 'Admin Eight', 'e0000000-0000-0000-0000-000000000002'::uuid from ids;
set constraints all immediate;

do $$
declare w record;
begin
  select * into w from who;
  -- Running, so nothing is final and nothing is given. 0167's rule, unchanged.
  if pg_temp.holds(w.admin, 2) <> 0 then
    raise exception 'FAIL 11: a running league handed out a badge';
  end if;
end $$;

set constraints all deferred;
update public.club_competitions set status = 'completed' where id = (select comp from ids);
set constraints all immediate;

do $$
declare w record;
begin
  select * into w from who;
  if pg_temp.holds(w.admin, 2) <> 1 then
    raise exception 'FAIL 12: completing the league gave no badge';
  end if;
end $$;

-- 7 · A save that changes nothing must change nothing. `replaceStandings`
--     deletes every row and inserts them again, which is why the triggers are
--     deferred: both halves land before either recount runs.
create temp table before_rows as
  select pg_temp.rows_for('e0000000-0000-0000-0000-000000000002'::uuid, 2) as n;

set constraints all deferred;
delete from public.club_competition_standings where competition_id = (select comp from ids);
insert into public.club_competition_standings
  (competition_id, rank, member_name, profile_id)
select comp, 2, 'Admin Eight', 'e0000000-0000-0000-0000-000000000002'::uuid from ids;
set constraints all immediate;

do $$
declare w record; v_before bigint;
begin
  select * into w from who;
  select n into v_before from before_rows;

  if pg_temp.holds(w.admin, 2) <> 1 then
    raise exception 'FAIL 13: a no-op save lost the badge';
  end if;
  if pg_temp.rows_for(w.admin, 2) <> v_before then
    raise exception 'FAIL 14: a no-op save wrote % extra badge rows',
      pg_temp.rows_for(w.admin, 2) - v_before;
  end if;
end $$;

-- 8 · A real change in the same shape of save moves the badge.
set constraints all deferred;
delete from public.club_competition_standings where competition_id = (select comp from ids);
insert into public.club_competition_standings
  (competition_id, rank, member_name, profile_id)
select comp, 3, 'Admin Eight', 'e0000000-0000-0000-0000-000000000002'::uuid from ids;
set constraints all immediate;

do $$
declare w record;
begin
  select * into w from who;
  if pg_temp.holds(w.admin, 2) <> 0 then
    raise exception 'FAIL 15: the league second place badge survived a drop to third';
  end if;
  if pg_temp.holds(w.admin, 3) <> 1 then
    raise exception 'FAIL 16: dropping to third gave no third place badge';
  end if;
end $$;

-- 9 · Reopening it takes the podium back: there is no final placing now.
set constraints all deferred;
update public.club_competitions set status = 'active' where id = (select comp from ids);
set constraints all immediate;

do $$
declare w record;
begin
  select * into w from who;
  if pg_temp.holds(w.admin, 3) <> 0 then
    raise exception 'FAIL 17: a reopened league kept its podium badge';
  end if;
  raise notice 'stage13 podium league: all pass';
end $$;

-- 10 · 0175 · a recount can be quiet in BOTH directions. 0162 gave the award
--      half the switch and not the revoke half, because a backfill only ever
--      inserted. A sweep takes badges back too.
set constraints all deferred;
insert into public.club_event_results
  (event_id, rank, placement, member_name, member_profile_id)
select spring, 1, '1st', 'Owner Eight',
       'e0000000-0000-0000-0000-000000000001'::uuid from ids;
set constraints all immediate;

do $$
declare w record; v_before bigint; v_club bigint;
begin
  select * into w from who;
  select id into v_club from c;

  if pg_temp.holds(w.owner, 1) <> 1 then
    raise exception 'FAIL 18: winning the Spring RTT gave no badge';
  end if;

  select pg_temp.notices(w.owner, 'badge-taken-back') into v_before;

  -- Take the placing away under the quiet switch, the way the sweep does.
  perform set_config('app.badge_notify_quiet', 'on', true);
  delete from public.club_event_results
   where event_id = (select spring from ids)
     and member_profile_id = w.owner;
  perform public.sync_podium_badges(v_club, w.owner);
  perform set_config('app.badge_notify_quiet', 'off', true);

  if pg_temp.holds(w.owner, 1) <> 0 then
    raise exception 'FAIL 19: a quiet recount did not take the badge back';
  end if;
  if pg_temp.notices(w.owner, 'badge-taken-back') <> v_before then
    raise exception 'FAIL 20: a quiet recount told them anyway (% notices)',
      pg_temp.notices(w.owner, 'badge-taken-back') - v_before;
  end if;

  raise notice 'stage13 podium quiet recount: all pass';
end $$;

rollback;
