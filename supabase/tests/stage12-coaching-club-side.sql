-- 0158 · The club can cancel a coaching place, mark a refund, and the member hears.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- A notification is readable only by the person it is for.
-- Clearing them needs postgres too, so it is a definer helper rather than a
-- bare delete inside a block running as the member.
create or replace function pg_temp.clear_notices() returns void
language sql security definer as $fn$
  delete from public.notifications where kind like 'coaching-%' $fn$;

create or replace function pg_temp.notices(p uuid)
returns setof public.notifications language sql security definer as $fn$
  select * from public.notifications
   where profile_id = p and kind like 'coaching-%' order by id $fn$;

insert into public.club_coaching_settings (club_id, enabled)
  select id, true from c;
insert into public.club_coaching_slots
  (club_id, title, slot_date, start_time, price, coaching_type, capacity, status)
  select id, 'List clinic', public.london_today() + 7, '19:00', 'GBP 10',
         'one-to-one', 5, 'open' from c;

create temp table slot as
  select id from public.club_coaching_slots where title = 'List clinic';
grant select on slot to authenticated;

/*
 * Everything below runs as `authenticated`, which is the whole point: the
 * session is postgres until this line and postgres bypasses row security, so
 * a block testing that a stranger is refused would pass whatever the policy
 * said. The first draft of this file did exactly that and reported the
 * opposite of the truth.
 */
set local role authenticated;

-- ===========================================================================
-- 1. The club can cancel somebody else's place, and they are told
-- ===========================================================================

do $$
declare v_booking bigint; v_row public.club_coaching_bookings%rowtype; v_n integer;
begin
  perform pg_temp.be('e0000000-0000-0000-0000-000000000003');
  insert into public.club_coaching_bookings (slot_id)
    select id from slot returning id into v_booking;

  -- The member paid, which is what makes a refund owed later.
  update public.club_coaching_bookings set payment_status = 'paid' where id = v_booking;

  -- Now the club cancels it. This is the thing the client said was impossible.
  perform pg_temp.be((select owner from who));
  update public.club_coaching_bookings
     set status = 'cancelled', cancel_reason = 'Coach is ill'
   where id = v_booking;

  select * into v_row from public.club_coaching_bookings where id = v_booking;
  if v_row.status <> 'cancelled' then
    raise exception 'the club could not cancel a place';
  end if;
  if v_row.cancelled_at is null or v_row.cancelled_by is null then
    raise exception 'the cancellation was not stamped';
  end if;

  -- Somebody who paid and lost their place is owed something, and the flag is
  -- what stops it being forgotten.
  if v_row.refund_status <> 'due' then
    raise exception 'refund_status came back as %, expected due', v_row.refund_status;
  end if;

  select count(*) into v_n
    from pg_temp.notices('e0000000-0000-0000-0000-000000000003')
   where kind = 'coaching-cancelled-by-club';
  if v_n <> 1 then
    raise exception 'the member got % cancellation notices', v_n;
  end if;

  -- The club's own words, not a generic line, when they gave a reason.
  if not exists (select 1 from pg_temp.notices('e0000000-0000-0000-0000-000000000003')
                  where body = 'Coach is ill') then
    raise exception 'the reason the club typed did not reach the member';
  end if;
end $$;

set local role postgres;
delete from public.notifications where kind like 'coaching-%';
delete from public.club_coaching_bookings;
set local role authenticated;

-- ===========================================================================
-- 2. A member giving up their own place is told nothing
-- ===========================================================================

do $$
declare v_booking bigint; v_n integer;
begin
  perform pg_temp.be('e0000000-0000-0000-0000-000000000003');
  insert into public.club_coaching_bookings (slot_id)
    select id from slot returning id into v_booking;
  update public.club_coaching_bookings set status = 'cancelled' where id = v_booking;

  select count(*) into v_n from pg_temp.notices('e0000000-0000-0000-0000-000000000003');
  if v_n <> 0 then
    raise exception 'somebody cancelling their own place got % notices', v_n;
  end if;

  -- And nothing is owed: they never paid.
  if (select refund_status from public.club_coaching_bookings where id = v_booking)
     <> 'not_due' then
    raise exception 'a refund was flagged on a place nobody paid for';
  end if;
end $$;

set local role postgres;
delete from public.club_coaching_bookings;
set local role authenticated;

-- ===========================================================================
-- 3. Marking the refund settled tells them, and only on the way to refunded
-- ===========================================================================

do $$
declare v_booking bigint; v_n integer;
begin
  perform pg_temp.be('e0000000-0000-0000-0000-000000000003');
  insert into public.club_coaching_bookings (slot_id)
    select id from slot returning id into v_booking;
  update public.club_coaching_bookings set payment_status = 'paid' where id = v_booking;

  perform pg_temp.be((select owner from who));
  update public.club_coaching_bookings set status = 'cancelled' where id = v_booking;
  perform pg_temp.clear_notices();

  -- 'due' is a note to the club, not news for the member.
  select count(*) into v_n from pg_temp.notices('e0000000-0000-0000-0000-000000000003');
  if v_n <> 0 then raise exception 'marking a refund due told the member'; end if;

  update public.club_coaching_bookings set refund_status = 'refunded' where id = v_booking;

  select count(*) into v_n
    from pg_temp.notices('e0000000-0000-0000-0000-000000000003')
   where kind = 'coaching-refunded';
  if v_n <> 1 then raise exception 'settling the refund sent % notices', v_n; end if;

  -- Writing the same status again says nothing twice.
  update public.club_coaching_bookings set refund_status = 'refunded' where id = v_booking;
  select count(*) into v_n
    from pg_temp.notices('e0000000-0000-0000-0000-000000000003');
  if v_n <> 1 then raise exception 'a repeated write sent % notices', v_n; end if;
end $$;

set local role postgres;
delete from public.notifications where kind like 'coaching-%';
delete from public.club_coaching_bookings;
set local role authenticated;

-- ===========================================================================
-- 4. A stranger cannot touch somebody else's booking
-- ===========================================================================

do $$
declare v_booking bigint; v_hit integer;
begin
  perform pg_temp.be('e0000000-0000-0000-0000-000000000003');
  insert into public.club_coaching_bookings (slot_id)
    select id from slot returning id into v_booking;

  perform pg_temp.be((select stranger from who));
  update public.club_coaching_bookings set status = 'cancelled' where id = v_booking;
  get diagnostics v_hit = row_count;
  -- RLS filters it out rather than raising, which is the zero-row trap: the
  -- write "succeeds" and touches nothing.
  if v_hit <> 0 then
    raise exception 'a stranger cancelled somebody else''s place';
  end if;
end $$;

-- ===========================================================================
-- 5. A slot has always been editable by the club, which is the other half
-- ===========================================================================

do $$
declare v_hit integer;
begin
  perform pg_temp.be((select owner from who));
  update public.club_coaching_slots
     set title = 'List clinic, bring a draft', price = 'GBP 12', capacity = 6
   where id = (select id from slot);
  get diagnostics v_hit = row_count;
  if v_hit <> 1 then
    raise exception 'the club could not edit its own slot';
  end if;

  perform pg_temp.be((select stranger from who));
  update public.club_coaching_slots set title = 'Hijacked' where id = (select id from slot);
  get diagnostics v_hit = row_count;
  if v_hit <> 0 then raise exception 'a stranger edited a club''s slot'; end if;
end $$;

-- Section 4 leaves its booking behind, and one live booking per member per
-- slot is a unique index.
set local role postgres;
delete from public.club_coaching_bookings;
delete from public.notifications where kind like 'coaching-%';
set local role authenticated;

-- ===========================================================================
-- 6. The club's list carries the cancelled ones, and nobody else may read it
-- ===========================================================================

do $$
declare v_n integer; v_row record;
begin
  perform pg_temp.be('e0000000-0000-0000-0000-000000000003');
  insert into public.club_coaching_bookings (slot_id) select id from slot;
end $$;

do $$
declare v_n integer; v_row record; v_booking bigint;
begin
  perform pg_temp.be((select owner from who));

  select booking_id into v_booking
    from public.club_coaching_bookings_list((select id from c)) limit 1;
  update public.club_coaching_bookings
     set payment_status = 'paid' where id = v_booking;
  update public.club_coaching_bookings
     set status = 'cancelled' where id = v_booking;

  -- The whole point: a cancelled booking somebody paid for is the row the club
  -- most needs to see, and the session cards deliberately never show it.
  select count(*) into v_n
    from public.club_coaching_bookings_list((select id from c))
   where status = 'cancelled';
  if v_n <> 1 then
    raise exception 'the list showed % cancelled bookings, expected 1', v_n;
  end if;

  select * into v_row
    from public.club_coaching_bookings_list((select id from c)) limit 1;
  if v_row.refund_status <> 'due' then
    raise exception 'the list reported refund_status %', v_row.refund_status;
  end if;
  if v_row.member_name is null or v_row.member_name = '' then
    raise exception 'the list gave no name to act on';
  end if;
end $$;

do $$
declare v_n integer;
begin
  -- A member of the club, not its team: the takings are not theirs.
  perform pg_temp.be('e0000000-0000-0000-0000-000000000003');
  begin
    select count(*) into v_n
      from public.club_coaching_bookings_list((select id from c));
    raise exception 'an ordinary member read the club''s coaching takings';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===========================================================================
-- 7. A session that has happened can still be administered (0159)
-- ===========================================================================

do $$
declare v_past bigint; v_booking bigint; v_row public.club_coaching_bookings%rowtype;
begin
  -- Booked while the session was still ahead, which is the only way in: the
  -- guard still refuses a booking taken on a past date, and should.
  set local role postgres;
  insert into public.club_coaching_slots
    (club_id, title, slot_date, start_time, price, coaching_type, capacity, status)
    select id, 'Last month', public.london_today() + 3, '19:00', 'GBP 10',
           'one-to-one', 1, 'open' from c
    returning id into v_past;
  insert into public.club_coaching_bookings (slot_id, profile_id)
    values (v_past, 'e0000000-0000-0000-0000-000000000003')
    returning id into v_booking;
  -- Now the session is behind us.
  update public.club_coaching_slots
     set slot_date = public.london_today() - 3 where id = v_past;
  set local role authenticated;

  perform pg_temp.be((select owner from who));

  -- The whole point. Coaching is paid offline after booking, so marking
  -- somebody paid once the session is over is the normal case, and the guard
  -- refused it with SLOT_PASSED for every session in the past.
  update public.club_coaching_bookings
     set payment_status = 'paid' where id = v_booking;

  select * into v_row from public.club_coaching_bookings where id = v_booking;
  if v_row.payment_status <> 'paid' then
    raise exception 'the club still cannot mark a past session paid';
  end if;
  if v_row.paid_at is null then
    raise exception 'paid_at was not stamped';
  end if;

  -- And cancelling it afterwards still owes them a refund.
  update public.club_coaching_bookings
     set status = 'cancelled' where id = v_booking;
  select * into v_row from public.club_coaching_bookings where id = v_booking;
  if v_row.refund_status <> 'due' then
    raise exception 'a past cancellation reported refund_status %', v_row.refund_status;
  end if;
end $$;

do $$
declare v_past bigint; v_code text;
begin
  -- The seat rules are untouched for anything that takes a seat. A booking
  -- made on a session that has already happened is still refused.
  select id into v_past from public.club_coaching_slots where title = 'Last month';
  perform pg_temp.be('e0000000-0000-0000-0000-000000000004');
  begin
    insert into public.club_coaching_bookings (slot_id) values (v_past);
    raise exception 'a place was taken on a session that has already happened';
  exception when check_violation or insufficient_privilege then null;
  end;
end $$;

set local role postgres;

rollback;

\echo 'stage12-coaching-club-side: all pass'
