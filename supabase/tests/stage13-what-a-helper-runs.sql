-- 0185 · what a helper runs.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- A helper, and a member on a tier worth discounting, so the price this
-- migration writes is somebody else's price and not a default.
insert into auth.users (id, email)
  values ('e0000000-0000-0000-0000-000000000005', 'helper8@example.com');
update public.profiles set full_name = 'Helper Eight'
  where id = 'e0000000-0000-0000-0000-000000000005';
insert into public.club_team (club_id, profile_id, role)
  select id, 'e0000000-0000-0000-0000-000000000005', 'helper' from c;

insert into public.club_booking_settings (club_id, table_booking_price, price_currency)
  select id, 10.00, 'GBP' from c;
insert into public.club_membership_tiers (club_id, tier_key, label, benefits)
  select id, 'gold', 'Gold',
         '{"bookingDiscountPercent": 20, "loyaltyRedemptionCapPercent": 50}'::jsonb from c;
update public.club_memberships set tier_key = 'gold'
  where profile_id = 'e0000000-0000-0000-0000-000000000003';

-- Points to spend, and a club that would let them be spent. If this migration
-- ever starts spending somebody else's balance, section 6 catches it.
insert into public.club_loyalty_settings (club_id, enabled, point_value)
  select id, true, 0.05 from c;
insert into public.club_loyalty_transactions
  (club_id, profile_id, kind, category, description,
   available_delta, lifetime_delta, source_key)
  select id, 'e0000000-0000-0000-0000-000000000003', 'earned', 'membership-approved',
         'Joined', 500, 500, 'test::joined-185' from c;

insert into public.club_announcements (club_id, message, created_at)
  select id, 'Car park is shut', now() - interval '40 days' from c;

create temp table nb as
  select id from public.club_announcements order by id desc limit 1;

-- A competition, so the helper has something to run.
insert into public.club_competitions (club_id, title, type, status)
  select id, 'Winter Ladder', 'league', 'active' from c;
create temp table cp as
  select id from public.club_competitions where title = 'Winter Ladder';
grant select on nb, cp to authenticated;

do $$
declare
  w record;
  -- stage8-seed's `who` has no helper, and the other suites that use it do not
  -- need one. Held here rather than widened there.
  v_helper uuid := 'e0000000-0000-0000-0000-000000000005';
  v_club bigint; v_session bigint; v_night date;
  v_notice bigint; v_comp bigint;
  v_booking bigint; v_row public.club_bookings%rowtype;
  v_made timestamptz; v_after timestamptz; v_count int;
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_notice from nb;
  select id into v_comp from cp;
  select id into v_session from public.club_sessions where club_id = v_club limit 1;
  -- The Thursday AFTER the one stage8-seed already booked this member onto:
  -- the one-table-per-person-per-date index is real and section 8 tests it
  -- deliberately, so it must not fire here by accident. Neither the weekday
  -- guard nor the past-date guard can fire on it either.
  v_night := current_date + (((4 - extract(isodow from current_date))::int + 6) % 7 + 1) + 7;

  -- =====================================================================
  -- 1 · The capability matrix itself.
  -- =====================================================================
  if not ('noticeboard.manage' = any(public.club_role_capabilities('helper'))) then
    raise exception 'FAIL 1: a helper cannot manage the noticeboard';
  end if;
  if not ('competitions.manage' = any(public.club_role_capabilities('helper'))) then
    raise exception 'FAIL 1: a helper cannot manage competitions';
  end if;
  -- The line that did NOT move. A helper runs the night; the listing, the
  -- roster's money and the events are still somebody else's.
  if 'listing.edit' = any(public.club_role_capabilities('helper'))
     or 'members.manage' = any(public.club_role_capabilities('helper'))
     or 'events.manage' = any(public.club_role_capabilities('helper'))
     or 'analytics.view' = any(public.club_role_capabilities('helper')) then
    raise exception 'FAIL 1: the helper role was widened past the night';
  end if;

  -- =====================================================================
  -- 2 · The noticeboard, as the helper. Every write below runs as the role:
  --     postgres bypasses row security entirely, so a suite that skips this
  --     proves nothing about a policy (0158).
  -- =====================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.save_club_notices(v_club,
      '[{"id": null, "message": "I do not run this club"}]'::jsonb);
    reset role;
    raise exception 'FAIL 2: a stranger wrote to the noticeboard';
  exception when insufficient_privilege then
    reset role;
  end;

  select created_at into v_made from public.club_announcements where id = v_notice;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_helper, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_club_notices(v_club, jsonb_build_array(
    jsonb_build_object('id', v_notice, 'message', 'Car park is shut all month'),
    jsonb_build_object('id', null,     'message', 'New terrain on table four')));
  reset role;

  if (select count(*) from public.club_announcements where club_id = v_club) <> 2 then
    raise exception 'FAIL 2: the board does not hold both notices';
  end if;

  -- =====================================================================
  -- 3 · An edited notice keeps the date it went up.
  --     The old writer deleted and re-inserted every row, so fixing a typo in
  --     this week's notice re-dated last month's to today and the board, which
  --     is ordered by that date, reshuffled itself.
  -- =====================================================================
  select created_at into v_after from public.club_announcements where id = v_notice;
  if v_after is distinct from v_made then
    raise exception 'FAIL 3: editing a notice moved its date';
  end if;
  if (select created_at from public.club_announcements
       where club_id = v_club and message = 'New terrain on table four')
     < now() - interval '1 day' then
    raise exception 'FAIL 3: a new notice did not get today''s date';
  end if;

  -- And a notice left out of the list comes down.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_helper, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.save_club_notices(v_club, jsonb_build_array(
    jsonb_build_object('id', v_notice, 'message', 'Car park is shut all month')));
  reset role;
  if (select count(*) from public.club_announcements where club_id = v_club) <> 1 then
    raise exception 'FAIL 3: a notice left off the list stayed up';
  end if;

  -- =====================================================================
  -- 4 · The listing is still not a helper's. The noticeboard came out of
  --     0085's loop on its own; the other seven tables did not move.
  -- =====================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_helper, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.club_images (club_id, src, alt, position)
      values (v_club, 'x.webp', 'x', 0);
    reset role;
    raise exception 'FAIL 4: a helper edited the listing';
  exception when insufficient_privilege then
    reset role;
  end;

  -- =====================================================================
  -- 5 · Competitions. `competitions.manage` decided nothing before this
  --     migration: every policy asked `can_manage_club`, which is false for a
  --     helper, so widening the role alone would have opened a page whose
  --     every save was refused.
  -- =====================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_helper, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.club_competition_standings
    (competition_id, member_name, rank, played, wins, draws, losses, points)
    values (v_comp, 'Member Eight', 1, 3, 3, 0, 0, 9);
  update public.club_competitions set summary = 'Running on Thursdays'
   where id = v_comp;
  reset role;

  if (select summary from public.club_competitions where id = v_comp)
     <> 'Running on Thursdays' then
    raise exception 'FAIL 5: a helper could not edit the competition';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.club_competitions set summary = 'Mine now' where id = v_comp;
  reset role;
  if (select summary from public.club_competitions where id = v_comp) = 'Mine now' then
    raise exception 'FAIL 5: a stranger edited the competition';
  end if;

  -- =====================================================================
  -- 6 · The club puts a member on a table.
  -- =====================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.club_add_table_booking(
      v_club, v_session, v_night, w.member, 'Warhammer 40,000');
    reset role;
    raise exception 'FAIL 6: a stranger booked a table for somebody else';
  exception when insufficient_privilege then
    reset role;
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_helper, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select booking_id into v_booking from public.club_add_table_booking(
    v_club, v_session, v_night, w.member, 'Warhammer 40,000', 'Door booking');
  reset role;

  select * into v_row from public.club_bookings where id = v_booking;

  -- Filed under the member, not the helper who typed it.
  if v_row.booked_by <> w.member then
    raise exception 'FAIL 6: the table is filed under the wrong person, got %',
      v_row.booked_by;
  end if;

  -- Priced off the MEMBER'S tier. Gold takes 20% off a £10 table, so £8. The
  -- helper is on no tier at all, so a price read from the caller would be £10.
  if v_row.tier_discount_percent <> 20 or v_row.total_price <> 8.00 then
    raise exception 'FAIL 6: priced off the wrong person, got % at % per cent',
      v_row.total_price, v_row.tier_discount_percent;
  end if;

  -- And not a point of somebody else's balance was spent, although the member
  -- holds 500 and the tier allows half the bill to be covered.
  if v_row.loyalty_points_spent <> 0 or v_row.loyalty_discount_amount <> 0 then
    raise exception 'FAIL 6: the club spent the member''s points';
  end if;

  if v_row.source <> 'club' then
    raise exception 'FAIL 6: the booking does not say the club made it, got %',
      v_row.source;
  end if;

  -- =====================================================================
  -- 7 · The member is told. They did not press the button, so a table in
  --     their name with no notice is one they find out about on the night.
  -- =====================================================================
  select count(*) into v_count from public.notifications
   where profile_id = w.member and kind = 'booked_by_club';
  if v_count <> 1 then
    raise exception 'FAIL 7: the member was not told, got % notices', v_count;
  end if;

  -- =====================================================================
  -- 8 · The rules underneath still hold, and none of them are restated in
  --     0185: they are triggers and indexes on the row it inserts.
  -- =====================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_helper, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.club_add_table_booking(
      v_club, v_session, v_night, w.member, 'A second table');
    reset role;
    raise exception 'FAIL 8: the member was booked onto two tables in one night';
  exception when unique_violation then
    reset role;
  end;

  -- A table is a member benefit and is priced off a tier, so somebody with no
  -- membership has nothing to price it from. That is the difference between
  -- this and an event ticket sold at a door, where a walk-in is allowed.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_helper, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.club_add_table_booking(
      v_club, v_session, v_night, w.stranger, 'Warhammer 40,000');
    reset role;
    raise exception 'FAIL 8: a non-member was given a table';
  exception when check_violation then
    reset role;
  end;

  raise notice 'stage13-what-a-helper-runs: all pass';
end $$;

rollback;
\echo 'stage13-what-a-helper-runs: all pass'
