-- 0178 · a member changes who they play, and every booking says what it cost.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.booking(p_id bigint)
returns public.club_bookings language sql security definer as $fn$
  select * from public.club_bookings where id = p_id $fn$;

-- A second member at the club, to be played against.
insert into auth.users (id, email)
  values ('e0000000-0000-0000-0000-000000000011', 'rival@example.com');
update public.profiles set full_name = 'Rhi Rival'
 where id = 'e0000000-0000-0000-0000-000000000011';
insert into public.club_memberships (club_id, profile_id, status, tier_key, joined_at, created_at)
  select id, 'e0000000-0000-0000-0000-000000000011', 'approved', 'basic', now(), now() from c;

-- And somebody at no club at all.
insert into auth.users (id, email)
  values ('e0000000-0000-0000-0000-000000000012', 'outside@example.com');
update public.profiles set full_name = 'Oz Outsider'
 where id = 'e0000000-0000-0000-0000-000000000012';

do $$
declare
  w record; v_club bigint; v_booking bigint; v_row public.club_bookings;
  v_price_before numeric(10,2);
  v_rival uuid := 'e0000000-0000-0000-0000-000000000011';
  v_outsider uuid := 'e0000000-0000-0000-0000-000000000012';
begin
  select * into w from who;
  select id into v_club from c;
  select id into v_booking from bk;

  -- The seed books `member` against `owner` on the next Thursday.
  v_row := pg_temp.booking(v_booking);
  if v_row.booked_by <> w.member then
    raise exception 'FAIL 1: the fixture is not the member''s booking';
  end if;

  v_price_before := v_row.total_price;

  -- 1 · 0064's rule, unchanged: a member cannot set the people. This is the
  --     booker seat, which stays the club's whoever asks.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.edit_booking_details(v_booking, 'Warhammer 40,000', '', '',
                                        true, w.member, v_rival);
    reset role;
    raise exception 'FAIL 2: a member handed the booker seat to somebody';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'BOOKING_NOT_YOURS' then raise; end if;
  end;

  -- 2 · And the new door: the member may say who they are playing.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.edit_booking_details(v_booking, 'Warhammer 40,000', '', '',
                                      false, null, v_rival, true);
  reset role;

  v_row := pg_temp.booking(v_booking);
  if v_row.opponent_profile_id is distinct from v_rival then
    raise exception 'FAIL 3: the member could not change who they play';
  end if;
  if v_row.opponent_name <> 'Rhi Rival' then
    raise exception 'FAIL 4: the opponent name reads % rather than the account''s',
      v_row.opponent_name;
  end if;

  -- 3 · AND THE BOOKER SEAT DID NOT MOVE. That is the whole line this draws:
  --     changing who you play is ordinary, handing your table over is not.
  if v_row.booked_by <> w.member then
    raise exception 'FAIL 5: setting the opponent moved the booker seat';
  end if;

  -- 4 · And nothing was repriced. A table is priced off the booker's tier, and
  --     the booker is exactly what this cannot change.
  if v_row.total_price is distinct from v_price_before then
    raise exception 'FAIL 6: the price moved from % to %',
      v_price_before, v_row.total_price;
  end if;

  -- 5 · A guest is still a guest: typed text, no account.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.edit_booking_details(v_booking, 'Warhammer 40,000',
                                      'Dave from work', '', false, null, null, true);
  reset role;

  v_row := pg_temp.booking(v_booking);
  if v_row.opponent_profile_id is not null then
    raise exception 'FAIL 7: typing a guest left the old account linked';
  end if;
  if v_row.opponent_name <> 'Dave from work' then
    raise exception 'FAIL 8: the guest name reads %', v_row.opponent_name;
  end if;

  -- 6 · Not themselves.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.edit_booking_details(v_booking, 'Warhammer 40,000', '', '',
                                        false, null, w.member, true);
    reset role;
    raise exception 'FAIL 9: a member was put down to play themselves';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'BOOKING_SAME_PERSON' then raise; end if;
  end;

  -- 7 · And not somebody who is not at the club.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.edit_booking_details(v_booking, 'Warhammer 40,000', '', '',
                                        false, null, v_outsider, true);
    reset role;
    raise exception 'FAIL 10: somebody outside the club was put on a table';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'BOOKING_OPPONENT_NOT_MEMBER' then raise; end if;
  end;

  -- 8 · A stranger cannot touch somebody else's booking at all.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.edit_booking_details(v_booking, 'Warhammer 40,000', '', '',
                                        false, null, v_rival, true);
    reset role;
    raise exception 'FAIL 11: a stranger set somebody else''s opponent';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'BOOKING_NOT_YOURS' then raise; end if;
  end;

  -- 9 · Both flags at once is two forms posting into one call, which cannot
  --     be true of one request.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.edit_booking_details(v_booking, 'Warhammer 40,000', '', '',
                                        true, w.member, v_rival, true);
    reset role;
    raise exception 'FAIL 12: both seat flags were accepted at once';
  exception when raise_exception then
    reset role;
    if sqlerrm <> 'BOOKING_SEATS_CONFLICT' then raise; end if;
  end;

  -- 10 · The club keeps both seats, which 0064 gave it and this must not take.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.edit_booking_details(v_booking, 'Warhammer 40,000', '', '',
                                      true, w.member, v_rival);
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if (pg_temp.booking(v_booking)).opponent_profile_id is distinct from v_rival then
    raise exception 'FAIL 13: the club could no longer set the people';
  end if;

  raise notice 'stage13 opponent: all pass';
end $$;

-- ------------------------------------------------- the coaching money --

do $$
declare
  w record; v_club bigint; v_slot bigint; v_booking bigint; v_row record;
begin
  select * into w from who;
  select id into v_club from c;

  -- A session is booked by somebody, and a trigger on the table reads who.
  -- Inserting with no claims set leaves `auth.uid()` reading an empty GUC.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.member, 'role', 'authenticated')::text, true);

  insert into public.club_coaching_slots
    (club_id, title, description, slot_date, start_time, end_time, price,
     coaching_type, capacity)
  values (v_club, 'List clinic', 'Bring a draft', current_date + 14,
          '19:00', '20:00', 'GBP 20', 'one-to-one', 1)
  returning id into v_slot;

  insert into public.club_coaching_bookings (slot_id, profile_id, status)
    values (v_slot, w.member, 'booked') returning id into v_booking;

  -- 11 · The trigger priced it, and now names the tier that did the pricing.
  --      Didcot's seed has no discount on basic, so this is the plain case:
  --      the figures are there and the label is whatever the tier is called.
  select * into v_row from public.club_coaching_bookings where id = v_booking;
  if v_row.base_price is distinct from 20.00 then
    raise exception 'FAIL 14: the slot priced at % rather than 20', v_row.base_price;
  end if;
  if v_row.membership_tier_label is null then
    raise exception 'FAIL 15: the tier label was not written at all';
  end if;

  -- 12 · And the member's own read hands the whole sum back, which is what
  --      the dashboard could not get at: `database.ts` has never carried
  --      0157's columns, so a select naming them is refused by check:columns.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_row from public.my_coaching_bookings() where booking_id = v_booking;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if v_row.booking_id is null then
    raise exception 'FAIL 16: the member could not read their own coaching';
  end if;
  if v_row.total_price is distinct from 20.00 then
    raise exception 'FAIL 17: the read answered % rather than the frozen total',
      v_row.total_price;
  end if;
  if v_row.title <> 'List clinic' then
    raise exception 'FAIL 18: the read lost the session it belongs to';
  end if;

  -- 13 · And somebody else's coaching is not in it. The function is invoker,
  --      so this is the table's own policy answering rather than a second
  --      copy of the rule written out here.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if exists (select 1 from public.my_coaching_bookings() where booking_id = v_booking) then
    reset role;
    raise exception 'FAIL 19: a stranger read somebody else''s coaching booking';
  end if;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  -- 14 · The club's own list carries the breakdown now, not just the total.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_row from public.club_coaching_bookings_list(v_club)
   where booking_id = v_booking;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if v_row.base_price is distinct from 20.00 then
    raise exception 'FAIL 20: the club''s list lost the base price';
  end if;
  if v_row.tier_percent is null then
    raise exception 'FAIL 21: the club''s list cannot say what came off';
  end if;

  raise notice 'stage13 coaching money: all pass';
end $$;

rollback;
