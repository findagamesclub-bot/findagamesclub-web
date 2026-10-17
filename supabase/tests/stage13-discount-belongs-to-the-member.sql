-- 0197 · a member's discount stays on the member's own place.
--
-- 0179 priced a place off the named member's tier, which is right. What it did
-- not do is stop a club naming a member for the discount and typing somebody
-- else onto the door, so a non-member attended on a member's price and the
-- member collected the points. A place is a member's or it is a guest's.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

insert into public.club_membership_tiers (club_id, tier_key, label, position, benefits)
  select id, 'premium', 'Premium', 2,
         '{"eventDiscountPercent": 10}'::jsonb from c;
update public.club_memberships set tier_key = 'premium'
 where profile_id = 'e0000000-0000-0000-0000-000000000003';

insert into public.club_events
  (club_id, legacy_id, title, start_date, status, featured_games)
  select id, 'test-event-197', 'Test Open', current_date + 30, 'published',
         array['Warhammer 40,000'] from c;

create temp table ev as
  select id from public.club_events where legacy_id = 'test-event-197';

insert into public.club_event_ticket_types
  (event_id, label, price, audience, position, quantity_available)
  select id, 'Standard', 'GBP 20', 'all', 1, 20 from ev;

create temp table tt as select id as open_one
  from public.club_event_ticket_types where event_id = (select id from ev);

do $$
declare
  w record; v_event bigint; v_open bigint;
  v_booking bigint; v_row public.club_event_bookings%rowtype;
begin
  select * into w from who;
  select id into v_event from ev;
  select open_one into v_open from tt;

  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1 · Naming a member and typing a different name puts the MEMBER on the
  -- door. The place is theirs, so it carries their name, not the guest's.
  v_booking := public.club_add_event_booking(
    v_event, w.member, 'Dave At The Door', 'dave@example.com',
    'FAGC-T197A', v_open, 1);
  reset role;
  select * into v_row from public.club_event_bookings where id = v_booking;
  if v_row.full_name <> 'Member Eight' then
    raise exception 'FAIL 1: a member''s place went on the door under "%"', v_row.full_name;
  end if;

  -- 2 · And it is still priced off their tier, which 0179 already did. Both
  -- halves have to stay true: the discount follows the member, and so does
  -- the name, so the two can never describe different people.
  if v_row.tier_discount_percent <> 10 or v_row.total <> 18.00 then
    raise exception 'FAIL 2: the member''s own place lost its discount: % at %',
      v_row.tier_discount_percent, v_row.total;
  end if;

  -- 3 · A guest is a guest. No member named, so the typed name stands and the
  -- list price is what they pay.
  set local role authenticated;
  v_booking := public.club_add_event_booking(
    v_event, null, 'Dave At The Door', 'dave@example.com',
    'FAGC-T197B', v_open, 1);
  reset role;
  select * into v_row from public.club_event_bookings where id = v_booking;
  if v_row.full_name <> 'Dave At The Door' then
    raise exception 'FAIL 3: a guest''s own name did not survive: "%"', v_row.full_name;
  end if;
  if v_row.tier_discount_percent <> 0 or v_row.total <> 20.00 then
    raise exception 'FAIL 4: a guest was given a member''s price: % at %',
      v_row.tier_discount_percent, v_row.total;
  end if;

  -- 5 · The points follow the same line. A guest has no profile, so 0050 has
  -- nobody to mint to, and the member's place is the member's to earn from.
  if exists (
    select 1 from public.club_loyalty_transactions
     where profile_id is null) then
    raise exception 'FAIL 5: loyalty points were minted against nobody';
  end if;

  raise notice 'all five pass';
end $$;

rollback;
