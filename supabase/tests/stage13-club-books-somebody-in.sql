-- 0179 · the club puts somebody on the list.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- A tier that actually discounts an event ticket, so "priced off the named
-- person" is a figure the test can tell apart from the list price.
insert into public.club_membership_tiers (club_id, tier_key, label, position, benefits)
  select id, 'premium', 'Premium', 2,
         '{"eventDiscountPercent": 10}'::jsonb from c;
update public.club_memberships set tier_key = 'premium'
 where profile_id = 'e0000000-0000-0000-0000-000000000003';

-- A future event with two ticket types: one open to all, one members only.
insert into public.club_events
  (club_id, legacy_id, title, start_date, status, featured_games)
  select id, 'test-event-179', 'Test Open', current_date + 30, 'published',
         array['Warhammer 40,000'] from c;

create temp table ev as
  select id from public.club_events where legacy_id = 'test-event-179';

insert into public.club_event_ticket_types
  (event_id, label, price, audience, position, quantity_available)
  select id, 'Standard', 'GBP 20', 'all', 1, 10 from ev;
insert into public.club_event_ticket_types
  (event_id, label, price, audience, position, quantity_available)
  select id, 'Members', 'GBP 50', 'members', 2, 10 from ev;

create temp table tt as select
  (select id from public.club_event_ticket_types
    where label = 'Standard' and event_id = (select id from ev)) as open_one,
  (select id from public.club_event_ticket_types
    where label = 'Members' and event_id = (select id from ev)) as members_only;

do $$
declare
  w record; v_event bigint; v_open bigint; v_members bigint;
  v_booking bigint; v_row public.club_event_bookings%rowtype;
begin
  select * into w from who;
  select id into v_event from ev;
  select open_one, members_only into v_open, v_members from tt;

  -- 1 · A stranger cannot put anybody on the club's list.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.club_add_event_booking(
      v_event, w.member, 'Member Eight', 'm@example.com', 'FAGC-TEST01', v_open, 1);
    reset role;
    raise exception 'FAIL 1: a stranger booked somebody onto an event';
  exception when insufficient_privilege then
    reset role;
  end;

  -- 2 · The club books a member in, and it is priced off THAT MEMBER'S tier,
  --     not off the club's and not at the list price. 10% of 20 is the whole
  --     point of the decision this function bakes in.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_booking := public.club_add_event_booking(
    v_event, w.member, 'Member Eight', 'm@example.com', 'FAGC-TEST02', v_open, 1);
  reset role;

  select * into v_row from public.club_event_bookings where id = v_booking;
  if v_row.subtotal is distinct from 20.00 then
    raise exception 'FAIL 2: subtotal is % rather than 20', v_row.subtotal;
  end if;
  if v_row.tier_discount_amount is distinct from 2.00 then
    raise exception 'FAIL 3: the member''s own tier discount was not applied (got %)',
      v_row.tier_discount_amount;
  end if;
  if v_row.total is distinct from 18.00 then
    raise exception 'FAIL 4: total is % rather than 18', v_row.total;
  end if;

  -- 3 · And no points were spent on their behalf. The club cannot consent to
  --     that for somebody else, which is the second decision baked in.
  if coalesce(v_row.loyalty_points_spent, 0) <> 0
     or coalesce(v_row.loyalty_discount_amount, 0) <> 0 then
    raise exception 'FAIL 5: the club spent % of somebody else''s points',
      v_row.loyalty_points_spent;
  end if;

  -- 4 · The place is in the MEMBER'S name, not the owner's. Without this the
  --     booking would show up on the wrong profile and the wrong door list.
  if v_row.profile_id is distinct from w.member then
    raise exception 'FAIL 6: the booking was filed under the wrong person';
  end if;

  -- 5 · A walk-in with no account can have an open ticket.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_booking := public.club_add_event_booking(
    v_event, null, 'Dave At The Door', 'dave@example.com', 'FAGC-TEST03', v_open, 2);
  reset role;

  select * into v_row from public.club_event_bookings where id = v_booking;
  if v_row.profile_id is not null then
    raise exception 'FAIL 7: a walk-in was given an account';
  end if;
  if v_row.subtotal is distinct from 40.00 or v_row.total is distinct from 40.00 then
    raise exception 'FAIL 8: a walk-in was priced at % / %',
      v_row.subtotal, v_row.total;
  end if;

  -- 6 · But NOT a members-only one. 0016's guard judges the person the booking
  --     is in the name of, so the club cannot walk somebody past a tier gate
  --     by typing their name in. This is the whole reason that guard was
  --     written the way it was, and this path inherits it rather than
  --     restating it.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.club_add_event_booking(
      v_event, null, 'Dave At The Door', 'dave@example.com', 'FAGC-TEST04',
      v_members, 1);
    reset role;
    raise exception 'FAIL 9: a walk-in was sold a members-only ticket';
  exception when insufficient_privilege then
    reset role;
  end;

  -- 7 · A name is required: a place with nobody's name on it is a place
  --     nobody can be called up for.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.club_add_event_booking(
      v_event, w.member, '   ', '', 'FAGC-TEST05', v_open, 1);
    reset role;
    raise exception 'FAIL 10: a booking was made with no name on it';
  exception when check_violation then
    reset role;
  end;

  -- 8 · A member named with the email box left blank takes their own account
  --     address. The club already knows who they are and the site already
  --     knows where to write to them; 0015 has required an address on every
  --     booking since tickets existed, and 0096's rule is that everything
  --     about a booking goes to the address on it.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_booking := public.club_add_event_booking(
    v_event, w.member, 'Member Eight', '', 'FAGC-TEST06', v_open, 1);
  reset role;

  select * into v_row from public.club_event_bookings where id = v_booking;
  if v_row.email is distinct from 'member8@example.com' then
    raise exception 'FAIL 11: a blank email did not fall back to the account (got %)',
      v_row.email;
  end if;

  -- 9 · A walk-in with no account and no address is refused BY NAME. Left to
  --     the check constraint it read "That did not save. Try again." about a
  --     rule nothing on the screen said, which is how this was found.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.club_add_event_booking(
      v_event, null, 'Dave At The Door', '  ', 'FAGC-TEST07', v_open, 1);
    reset role;
    raise exception 'FAIL 12: a walk-in was booked in with no address on it';
  exception when check_violation then
    reset role;
    if sqlerrm not like '%EMAIL_REQUIRED%' then
      raise exception 'FAIL 13: refused with "%" rather than EMAIL_REQUIRED', sqlerrm;
    end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'stage13 club books somebody in: all pass';
end $$;

rollback;
