-- 0198 · a podium badge listing every finish it stands for.
--
-- The badge stays one row per rank per club (0167). What it gains is the
-- ability to say what the "and 1 more" is, which the client could not find
-- anywhere near it.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Two first places for the member at one club: an event placing and a
-- completed competition, which is the client's own pair.
create or replace function pg_temp.seed_wins() returns void
language plpgsql security definer as $fn$
declare v_club bigint; v_event bigint; v_comp bigint;
begin
  select id into v_club from public.clubs where slug = 'army-club';

  insert into public.club_events
    (club_id, legacy_id, title, start_date, status)
  values (v_club, 'test-198', 'Spring Open', current_date - 40, 'published')
  returning id into v_event;
  insert into public.club_event_results
    (event_id, rank, placement, member_name, member_profile_id)
  values (v_event, 1, '1st place', 'Member Eight',
          'e0000000-0000-0000-0000-000000000003');

  insert into public.club_competitions
    (club_id, title, type, status, start_date, end_date)
  values (v_club, 'Winter Arc', 'campaign', 'completed',
          current_date - 200, current_date - 120)
  returning id into v_comp;
  insert into public.club_competition_standings
    (competition_id, member_name, profile_id, rank, played, wins, draws, losses, points)
  values (v_comp, 'Member Eight', 'e0000000-0000-0000-0000-000000000003',
          1, 6, 5, 1, 0, 16);
end $fn$;

select pg_temp.seed_wins();

-- The deferred recount triggers (0174) never fire inside one transaction
-- unless asked, and the badge is what this is all hung off.
set constraints all immediate;

set local role authenticated;

do $$
declare w record; v_rows bigint; v_award bigint;
begin
  select * into w from who;

  -- 1 · The holder sees both finishes against one award.
  perform pg_temp.be(w.member);
  select count(*), min(award_id) into v_rows, v_award
    from public.member_podium_finishes(w.member);
  if v_rows <> 2 then
    raise exception 'FAIL 1: a member with two firsts saw % finishes', v_rows;
  end if;

  -- 2 · One award, not two. The badge model is unchanged: what moved is that
  -- it can now say what it stands for.
  if (select count(distinct award_id) from public.member_podium_finishes(w.member)) <> 1 then
    raise exception 'FAIL 2: two firsts made two badges';
  end if;

  -- 3 · Both are named. "and 1 more" was the whole complaint.
  if not exists (select 1 from public.member_podium_finishes(w.member)
                  where note like '%Spring Open%')
     or not exists (select 1 from public.member_podium_finishes(w.member)
                     where note like '%Winter Arc%') then
    raise exception 'FAIL 3: a finish is missing from the list';
  end if;

  -- 4 · Newest first, which is the order the badge's own note uses.
  if (select note from public.member_podium_finishes(w.member) limit 1)
     not like '%Spring Open%' then
    raise exception 'FAIL 4: the list is not newest first';
  end if;

  -- 5 · A stranger gets nothing. They cannot see the badge, so they must not
  -- be handed what earned it: RLS has no say inside a definer function.
  perform pg_temp.be(w.stranger);
  if (select count(*) from public.member_podium_finishes(w.member)) <> 0 then
    raise exception 'FAIL 5: a stranger read somebody else''s podium finishes';
  end if;

  -- 6 · A clubmate does, because that is the audience the badge itself has.
  perform pg_temp.be(w.owner);
  if (select count(*) from public.member_podium_finishes(w.member)) <> 2 then
    raise exception 'FAIL 6: the club could not see its own member''s finishes';
  end if;

  raise notice 'all six pass';
end $$;

reset role;
rollback;
