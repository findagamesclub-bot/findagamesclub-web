-- 0171 · the club putting a join date right.
--
-- Every date here is measured from `public.london_today()`, never
-- `current_date`. The function counts tenure in London days, and the harness
-- runs in the machine's own zone (Asia/Karachi, UTC+5): between midnight and
-- 05:00 there the session date is already tomorrow while London is still on
-- today, so "three years before current_date" is two years and 364 days of
-- London tenure and the three year badge is correctly not given. The first
-- version of this file used `current_date` and passed for nineteen hours a
-- day.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- As postgres: a membership row and somebody else's badge are both hidden
-- from an ordinary session by policy, so counting them from one reads zero
-- whether the row is there or not.
create or replace function pg_temp.joined(p_membership bigint)
returns date language sql security definer as $fn$
  select joined_at::date from public.club_memberships where id = p_membership $fn$;

create or replace function pg_temp.years_badge(p_profile uuid, p_years integer)
returns bigint language sql security definer as $fn$
  select count(*) from public.member_badges m
    join public.club_badges b on b.id = m.badge_id
   where m.profile_id = p_profile and b.tenure_years = p_years
     and m.revoked_at is null $fn$;

create or replace function pg_temp.notices(p_profile uuid)
returns bigint language sql security definer as $fn$
  select count(*) from public.notifications
   where profile_id = p_profile and kind = 'badge-awarded' $fn$;

create temp table ms as
  select id from public.club_memberships
   where profile_id = 'e0000000-0000-0000-0000-000000000003';
grant select on ms to authenticated;

set local role authenticated;

do $$
declare w record; v_m bigint; v_bad boolean;
begin
  select * into w from who;
  select id into v_m from ms;

  -- 1 · The club puts it right, and the date sticks.
  perform pg_temp.be(w.owner);
  perform public.set_membership_joined_at(v_m, (public.london_today() - interval '3 years')::date);
  if pg_temp.joined(v_m) <> (public.london_today() - interval '3 years')::date then
    raise exception 'FAIL 1: the date reads %', pg_temp.joined(v_m);
  end if;

  -- 2 · And the year badges follow it on the spot, which is the whole reason
  -- this is a function rather than an update.
  if pg_temp.years_badge(w.member, 3) <> 1 then
    raise exception 'FAIL 2: three years back gave no three year badge';
  end if;
  -- Only the highest band reached, the same as 0162's nightly run.
  if pg_temp.years_badge(w.member, 1) <> 0 then
    raise exception 'FAIL 3: a lower band was handed out as well';
  end if;

  -- 3 · Quietly. A club fixing forty dates on listing day is bookkeeping, not
  -- forty things to tell forty people about.
  if pg_temp.notices(w.member) <> 0 then
    raise exception 'FAIL 4: % notices for a correction', pg_temp.notices(w.member);
  end if;

  -- 4 · Moving it further back crosses another band and awards that one too.
  perform public.set_membership_joined_at(v_m, (public.london_today() - interval '6 years')::date);
  if pg_temp.years_badge(w.member, 5) <> 1 then
    raise exception 'FAIL 5: six years back gave no five year badge';
  end if;

  -- 5 · And moving it forward takes nothing away. A revoke is somebody's
  -- decision (0126 tells the member about one), so the owner does it by hand.
  perform public.set_membership_joined_at(v_m, (public.london_today() - interval '1 years')::date);
  if pg_temp.years_badge(w.member, 5) <> 1 then
    raise exception 'FAIL 6: correcting the date forward took a badge back';
  end if;

  -- 6 · A date nobody could have joined on.
  begin
    perform public.set_membership_joined_at(v_m, (public.london_today() + 1)::date);
    raise exception 'FAIL 7: a join date in the future was accepted';
  exception when others then
    if sqlerrm <> 'JOINED_IN_FUTURE' then raise; end if;
  end;

  begin
    perform public.set_membership_joined_at(v_m, date '1899-12-31');
    raise exception 'FAIL 8: a mistyped year was accepted';
  exception when others then
    if sqlerrm <> 'JOINED_TOO_OLD' then raise; end if;
  end;

  begin
    perform public.set_membership_joined_at(v_m, null);
    raise exception 'FAIL 9: an empty join date was accepted';
  exception when others then
    if sqlerrm <> 'JOINED_REQUIRED' then raise; end if;
  end;

  -- 7 · Not the member's own to set, and not a stranger's.
  perform pg_temp.be(w.member);
  begin
    perform public.set_membership_joined_at(v_m, (public.london_today() - interval '9 years')::date);
    raise exception 'FAIL 10: a member backdated their own membership';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.be(w.stranger);
  begin
    perform public.set_membership_joined_at(v_m, (public.london_today() - interval '9 years')::date);
    raise exception 'FAIL 11: a stranger set somebody else''s join date';
  exception when insufficient_privilege then null;
  end;

  -- 8 · A site admin holds no team row anywhere and still can, which is the
  -- clause 0170 had to add for the same reason.
  perform pg_temp.be(w.admin);
  perform public.set_membership_joined_at(v_m, (public.london_today() - interval '2 years')::date);
  if pg_temp.joined(v_m) <> (public.london_today() - interval '2 years')::date then
    raise exception 'FAIL 12: a site admin could not set it';
  end if;

  raise notice 'stage13 join date: all pass';
end $$;

rollback;
