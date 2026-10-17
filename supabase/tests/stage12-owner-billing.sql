-- 0161 · An owner can pick a plan and ask to be featured; nobody else can.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- A notification is readable only by the person it is for, so counting one
-- from another session reads zero whether it was written or not.
create or replace function pg_temp.notices(p_kind text)
returns bigint language sql security definer as $fn$
  select count(*) from public.notifications
   where kind = p_kind and read_at is null $fn$;

-- The seed already carries an admin (who.admin). A subscription to move
-- between plans is what this needs on top of it.
update public.listing_billing_settings
   set enabled = true, monthly_price_pence = 1500, yearly_price_pence = 15000
 where id = 1;

insert into public.listing_subscriptions
  (club_id, owner_id, plan_interval, status, price_pence)
  select c.id, w.owner, 'monthly', 'active', 1500 from c, who w;

do $$
declare
  v_club bigint := (select id from c);
  v_owner uuid := (select owner from who);
  v_member uuid := (select member from who);
  v_plan text;
  v_price integer;
begin
  set local role authenticated;

  -- 1 · The owner moves to yearly, and the price follows the settings.
  perform pg_temp.be(v_owner);
  perform public.set_listing_plan(v_club, 'yearly');

  select plan_interval, price_pence into v_plan, v_price
    from public.listing_subscriptions where club_id = v_club;
  if v_plan <> 'yearly' or v_price <> 15000 then
    raise exception 'FAIL 1: plan did not move, got % at %', v_plan, v_price;
  end if;

  -- 2 · A stranger cannot move somebody elses club.
  perform pg_temp.be(v_member);
  begin
    perform public.set_listing_plan(v_club, 'monthly');
    raise exception 'FAIL 2: a stranger changed the plan';
  exception when insufficient_privilege then null;
  end;

  -- 3 · And an interval nobody sells is refused before anything is touched.
  perform pg_temp.be(v_owner);
  begin
    perform public.set_listing_plan(v_club, 'weekly');
    raise exception 'FAIL 3: an unknown plan was accepted';
  exception when check_violation then null;
  end;

  raise notice 'sections 1-3 pass';
end $$;

do $$
declare
  v_club bigint := (select id from c);
  v_owner uuid := (select owner from who);
  v_member uuid := (select member from who);
  v_id bigint;
  v_other bigint;
  v_before bigint;
begin
  set local role authenticated;

  -- 4 · A stranger cannot ask on a club they do not run.
  perform pg_temp.be(v_member);
  begin
    perform public.request_featured_slot(v_club, null, 'go on');
    raise exception 'FAIL 4: a stranger asked to be featured';
  exception when insufficient_privilege then null;
  end;

  -- 5 · The owner asks, and every admin hears about it.
  v_before := pg_temp.notices('featured-requested');
  perform pg_temp.be(v_owner);
  v_id := public.request_featured_slot(v_club, current_date + 14, 'Our open day');

  if pg_temp.notices('featured-requested') <= v_before then
    raise exception 'FAIL 5: nobody was told a club asked';
  end if;

  -- 6 · Pressing it twice for the same week is one club wanting one slot.
  --
  -- It read "a second open request was allowed" until 0204, when the rule
  -- moved from one ask per club to one ask per date. That half still has to
  -- hold, because it is what catches the double press.
  begin
    perform public.request_featured_slot(v_club, current_date + 14, '');
    raise exception 'FAIL 6: the same week was asked for twice';
  exception when check_violation then null;
  end;

  -- 6b · A different week is a different thing to answer, which is what the
  -- client asked for. Taken back again so section 7 reads a clean bell.
  v_other := public.request_featured_slot(v_club, current_date + 28, 'And our tournament');
  perform public.withdraw_featured_request(v_other);

  -- 7 · Taking it back stops it asking anybody.
  perform public.withdraw_featured_request(v_id);
  if pg_temp.notices('featured-requested') <> v_before then
    raise exception 'FAIL 7: withdrawing left the admins still being asked';
  end if;

  -- 8 · And it cannot be withdrawn twice.
  begin
    perform public.withdraw_featured_request(v_id);
    raise exception 'FAIL 8: an answered request was withdrawn again';
  exception when check_violation then null;
  end;

  raise notice 'sections 4-8 pass';
end $$;

do $$
declare
  v_club bigint := (select id from c);
  v_owner uuid := (select owner from who);
  v_member uuid := (select member from who);
  v_admin uuid := (select admin from who);
  v_id bigint;
  v_before bigint;
begin
  set local role authenticated;

  perform pg_temp.be(v_owner);
  v_id := public.request_featured_slot(v_club, null, 'Second try');

  -- 9 · Only an admin answers one.
  perform pg_temp.be(v_member);
  begin
    perform public.answer_featured_request(v_id, null, 'no');
    raise exception 'FAIL 9: a member answered a featured request';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.be(v_owner);
  begin
    perform public.answer_featured_request(v_id, null, 'no');
    raise exception 'FAIL 10: the club answered its own request';
  exception when insufficient_privilege then null;
  end;

  -- 11 · Declining tells the club, with the reason.
  v_before := pg_temp.notices('featured-declined');
  perform pg_temp.be(v_admin);
  perform public.answer_featured_request(v_id, null, 'The month is already full.');

  if pg_temp.notices('featured-declined') <= v_before then
    raise exception 'FAIL 11: the club was not told it had been turned down';
  end if;
  if pg_temp.notices('featured-requested') <> 0 then
    raise exception 'FAIL 12: answering left the admins still being asked';
  end if;

  raise notice 'sections 9-12 pass';
end $$;

-- 13 · A booking says nothing here, because 0155 already tells the owner when
-- the slot itself appears. Two notices about one answer is the site talking
-- over itself.
do $$
declare
  v_club bigint := (select id from c);
  v_owner uuid := (select owner from who);
  v_admin uuid := (select admin from who);
  v_id bigint;
  v_slot bigint;
  v_before bigint;
begin
  set local role authenticated;

  perform pg_temp.be(v_owner);
  v_id := public.request_featured_slot(v_club, null, 'Third try');

  perform pg_temp.be(v_admin);
  v_slot := public.feature_club(v_club, current_date, current_date + 7, 2000);

  v_before := pg_temp.notices('featured-declined');
  perform public.answer_featured_request(v_id, v_slot, '');

  if pg_temp.notices('featured-declined') <> v_before then
    raise exception 'FAIL 13: a booking sent a decline notice';
  end if;

  if (select status from public.featured_requests where id = v_id) <> 'booked' then
    raise exception 'FAIL 14: the request was not marked as booked';
  end if;

  raise notice 'section 13 passes';
end $$;

\echo 'stage12-owner-billing: all pass'
