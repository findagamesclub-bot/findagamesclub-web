-- 0184 · a place on the list finds its account.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select id, 'link-184', 'Linking Open', current_date + 20, 'published' from c;

create temp table ev as
  select id from public.club_events where legacy_id = 'link-184';

-- The member buys two places: one for themselves and one for a friend whose
-- name goes on the door. Both carry the member's account, which is the state
-- scenario 2 describes and the whole reason this migration exists.
insert into public.club_event_bookings
  (club_id, event_id, profile_id, full_name, email, reference)
  select (select id from c), id, 'e0000000-0000-0000-0000-000000000003',
         'Member Eight', 'member8@example.com', 'FAGC-LINK01' from ev;
insert into public.club_event_bookings
  (club_id, event_id, profile_id, full_name, email, reference)
  select (select id from c), id, 'e0000000-0000-0000-0000-000000000003',
         'Dave At The Door', 'member8@example.com', 'FAGC-LINK02' from ev;

create temp table lk as select
  (select id from public.club_event_bookings where reference = 'FAGC-LINK01') as mine,
  (select id from public.club_event_bookings where reference = 'FAGC-LINK02') as friend;

do $$
declare
  w record; v_mine bigint; v_friend bigint; v_who uuid; v_code text;
begin
  select * into w from who;
  select mine, friend into v_mine, v_friend from lk;

  -- 1 · A stranger cannot move somebody else's booking onto an account.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.set_booking_member(v_friend, null, '');
    reset role;
    raise exception 'FAIL 1: a stranger edited the door list';
  exception when insufficient_privilege then
    reset role;
  end;

  -- 2 · The club takes the wrong account off the friend's place. Scenario 2
  --     is not a missing link, it is a WRONG one: the booking carries the
  --     buyer's account and somebody else's name.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.set_booking_member(v_friend, null, '');
  reset role;

  select profile_id into v_who from public.club_event_bookings where id = v_friend;
  if v_who is not null then
    raise exception 'FAIL 2: the wrong account is still on the place';
  end if;

  -- And the member's own place is untouched by it.
  select profile_id into v_who from public.club_event_bookings where id = v_mine;
  if v_who is distinct from w.member then
    raise exception 'FAIL 3: clearing one place cleared another';
  end if;

  -- 3 · An account that is nobody at this club is refused without a code.
  --     The stranger holds no booking and no membership here, which is
  --     exactly scenario 2's "may not be a member of that club".
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.set_booking_member(v_friend, w.stranger, '');
    reset role;
    raise exception 'FAIL 4: a stranger was attached with no code';
  exception when check_violation then
    reset role;
  end;

  -- 4 · With their code, they can be. This is the whole mechanism the client
  --     proposed: the person hands the organiser their member ID.
  -- `my_member_code` makes one for whoever is asking, which is how every
  -- real code comes into being: the member opens their own profile page.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_code := public.my_member_code();
  reset role;

  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.set_booking_member(v_friend, w.stranger, v_code);
  reset role;

  select profile_id into v_who from public.club_event_bookings where id = v_friend;
  if v_who is distinct from w.stranger then
    raise exception 'FAIL 5: the code did not attach the account';
  end if;

  -- 5 · And a club member needs no code at all, which is the ordinary case.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.set_booking_member(v_friend, w.member, '');
  reset role;

  select profile_id into v_who from public.club_event_bookings where id = v_friend;
  if v_who is distinct from w.member then
    raise exception 'FAIL 6: an approved member could not be attached';
  end if;

  -- 6 · A booking that is not there says so rather than silently doing
  --     nothing, which is what a stale list would otherwise look like.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.set_booking_member(-1, null, '');
    reset role;
    raise exception 'FAIL 7: a booking that is gone was accepted';
  exception when check_violation then
    reset role;
  end;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'stage13 booking member: all pass';
end $$;

rollback;
