-- 0162 · A club starts with length-of-membership badges, and they are given out
-- on their own.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.notices(p_profile uuid)
returns bigint language sql security definer as $fn$
  select count(*) from public.notifications
   where profile_id = p_profile and kind = 'badge-awarded' $fn$;

create or replace function pg_temp.held(p_profile uuid)
returns setof text language sql security definer as $fn$
  select b.label from public.member_badges m
    join public.club_badges b on b.id = m.badge_id
   where m.profile_id = p_profile and m.revoked_at is null
   order by b.tenure_years $fn$;

-- 1 · The club the seed just made got the suggested set from the trigger.
do $$
declare v_club bigint := (select id from c); v_n integer;
begin
  select count(*) into v_n from public.club_badges
   where club_id = v_club and tenure_years is not null;
  if v_n <> 5 then
    raise exception 'FAIL 1: a new club started with % tenure badges, not 5', v_n;
  end if;

  -- All five are the same kind of thing, so one tone.
  if exists (select 1 from public.club_badges
              where club_id = v_club and tenure_years is not null and tone <> 'service') then
    raise exception 'FAIL 2: a tenure badge is wearing a competition tone';
  end if;

  raise notice 'section 1 passes';
end $$;

-- 2 · Under a year is nothing; over a year is the band they are in, and only
-- the one band.
do $$
declare
  v_club bigint := (select id from c);
  v_member uuid := (select member from who);
  v_owner uuid := (select owner from who);
  v_made integer;
begin
  update public.club_memberships
     set joined_at = public.london_today() - 200, status = 'approved'
   where club_id = v_club and profile_id = v_member;
  update public.club_memberships
     set joined_at = public.london_today() - (365 * 6), status = 'approved'
   where club_id = v_club and profile_id = v_owner;

  delete from public.member_badges;
  v_made := public.award_due_tenure_badges();

  if exists (select 1 from pg_temp.held(v_member)) then
    raise exception 'FAIL 3: somebody 200 days in was given a year badge';
  end if;

  if (select count(*) from pg_temp.held(v_owner)) <> 1 then
    raise exception 'FAIL 4: a six year member got % badges, not 1',
      (select count(*) from pg_temp.held(v_owner));
  end if;
  if (select string_agg(x, ',') from pg_temp.held(v_owner) x) <> 'Member for 5 years' then
    raise exception 'FAIL 5: wrong band, got %',
      (select string_agg(x, ',') from pg_temp.held(v_owner) x);
  end if;

  -- 3 · Running it again hands out nothing.
  v_made := public.award_due_tenure_badges();
  if v_made <> 0 then
    raise exception 'FAIL 6: a second run awarded % more', v_made;
  end if;

  raise notice 'sections 2-3 pass';
end $$;

-- 4 · Crossing into the next band adds it and leaves the old one alone.
do $$
declare
  v_club bigint := (select id from c);
  v_owner uuid := (select owner from who);
begin
  update public.club_memberships
     set joined_at = public.london_today() - (365 * 11)
   where club_id = v_club and profile_id = v_owner;

  perform public.award_due_tenure_badges();

  if (select string_agg(x, ',') from pg_temp.held(v_owner) x)
     <> 'Member for 5 years,Member for 10 years' then
    raise exception 'FAIL 7: crossing a band did not add it, got %',
      (select string_agg(x, ',') from pg_temp.held(v_owner) x);
  end if;

  raise notice 'section 4 passes';
end $$;

-- 5 · A revoke sticks, and a retired band is not given out.
do $$
declare
  v_club bigint := (select id from c);
  v_owner uuid := (select owner from who);
  v_ten bigint;
begin
  select id into v_ten from public.club_badges
   where club_id = v_club and tenure_years = 10;

  -- Both columns: `member_badges_revoke_pair` refuses one without the other,
  -- which is the table insisting a revoke has somebody's name on it.
  update public.member_badges set revoked_at = now(), revoked_by = v_owner
   where badge_id = v_ten and profile_id = v_owner;

  perform public.award_due_tenure_badges();
  if exists (select 1 from public.member_badges
              where badge_id = v_ten and profile_id = v_owner and revoked_at is null) then
    raise exception 'FAIL 8: a revoked badge was handed straight back';
  end if;

  -- With ten revoked the next run would otherwise fall to five, which they
  -- already hold, so nothing moves. Retiring five as well proves the active
  -- check rather than relying on that.
  update public.club_badges set active = false
   where club_id = v_club and tenure_years in (5, 10);
  delete from public.member_badges where profile_id = v_owner;

  perform public.award_due_tenure_badges();
  if (select string_agg(x, ',') from pg_temp.held(v_owner) x) <> 'Member for 3 years' then
    raise exception 'FAIL 9: a retired band was still awarded, got %',
      (select string_agg(x, ',') from pg_temp.held(v_owner) x);
  end if;

  raise notice 'section 5 passes';
end $$;

-- 6 · The member is told, and a bulk run can be told to keep quiet.
do $$
declare
  v_club bigint := (select id from c);
  v_owner uuid := (select owner from who);
  v_before bigint;
begin
  update public.club_badges set active = true where club_id = v_club;
  delete from public.member_badges where profile_id = v_owner;
  delete from public.notifications where kind = 'badge-awarded';

  perform public.award_due_tenure_badges();
  if pg_temp.notices(v_owner) <> 1 then
    raise exception 'FAIL 10: an automatic award told them % times', pg_temp.notices(v_owner);
  end if;

  delete from public.member_badges where profile_id = v_owner;
  v_before := pg_temp.notices(v_owner);
  perform set_config('app.badge_notify_quiet', 'on', true);
  perform public.award_due_tenure_badges();
  perform set_config('app.badge_notify_quiet', 'off', true);

  if pg_temp.notices(v_owner) <> v_before then
    raise exception 'FAIL 11: a quiet run still wrote a notice';
  end if;

  raise notice 'section 6 passes';
end $$;

-- 7 · An owner can still hand one out by name, which is the half the client
-- said already looked good and must not break.
do $$
declare
  v_club bigint := (select id from c);
  v_owner uuid := (select owner from who);
  v_member uuid := (select member from who);
  v_one bigint;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  select id into v_one from public.club_badges
   where club_id = v_club and tenure_years = 1;

  -- 200 days in, so nothing automatic would ever give them this.
  perform public.award_member_badge(v_one, v_member, 'Joined us at the old club.');

  if not exists (select 1 from public.member_badges
                  where badge_id = v_one and profile_id = v_member and revoked_at is null) then
    raise exception 'FAIL 12: an owner could not award a tenure badge by hand';
  end if;

  raise notice 'section 7 passes';
end $$;

\echo 'stage12-tenure-badges: all pass'
