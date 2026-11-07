-- 0224 · a refund carries when and how, and a team name reaches the person
-- who booked under it.
--
-- Section 2 is the break test: a refund taken back has to take its method and
-- its note with it, or a booking reads "Refunded by bank transfer" under a
-- status that says the money is still owed. That is the same rule `paid_at`
-- has followed since 0092 and it is the one an accounts record depends on.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.row_of(p_booking bigint)
returns public.club_event_bookings language sql security definer as $fn$
  select * from public.club_event_bookings where id = p_booking $fn$;

insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select id, 'teams-open', 'Teams Open', public.london_today() + 30, 'published' from c;

create temp table ev as select id from public.club_events where legacy_id = 'teams-open';
grant select on ev to authenticated;

-- A place the member holds, booked under a team name and paid for.
insert into public.club_event_bookings
  (event_id, club_id, profile_id, full_name, email, reference, status,
   subtotal, total, currency, team_name, payment_status, payment_method)
select e.id, c.id, (select member from who), 'Member Eight', 'member8@example.com',
       'FAGC-TEAM01', 'reserved', 30, 30, 'GBP', 'Red Dice', 'paid_in_advance',
       'Bank transfer'
  from ev e, c;

create temp table bkg as
  select id from public.club_event_bookings where reference = 'FAGC-TEAM01';
grant select on bkg to authenticated;

do $$
declare
  v_b   bigint;
  v_row public.club_event_bookings%rowtype;
  v_n   int;
  v_team text;
begin
  select id into v_b from bkg;

  -- ====================================================================== 1
  -- Cancelling a paid place leaves a refund owed, which 0092 already did.
  -- ====================================================================== 1
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  update public.club_event_bookings
     set status = 'cancelled', cancel_reason = 'Event oversold' where id = v_b;
  reset role;

  v_row := pg_temp.row_of(v_b);
  if v_row.refund_status <> 'due' then
    raise exception 'FAIL 1: a paid place was cancelled and nothing is owed (%)',
      v_row.refund_status;
  end if;
  if v_row.refunded_at is not null then
    raise exception 'FAIL 1: money that has not gone back carries a date';
  end if;
  raise notice 'PASS 1: cancelling a paid place leaves a refund owed and undated';

  -- ====================================================================== 2
  -- The club settles it, with how and a note. The date is stamped, never sent.
  -- ====================================================================== 2
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  update public.club_event_bookings
     set refund_status = 'refunded', refund_method = 'Bank transfer',
         refund_note = 'Sent 7 Nov, ref REFUND-01'
   where id = v_b;
  reset role;

  v_row := pg_temp.row_of(v_b);
  if v_row.refunded_at is null then
    raise exception 'FAIL 2: a refund was recorded with no date on it';
  end if;
  if v_row.refund_method <> 'Bank transfer'
     or v_row.refund_note <> 'Sent 7 Nov, ref REFUND-01' then
    raise exception 'FAIL 2: how it went back was not kept (% / %)',
      v_row.refund_method, v_row.refund_note;
  end if;
  raise notice 'PASS 2: a refund carries when, how, and what was written beside it';

  -- ====================================================================== 3
  -- BREAK TEST. Taking it back takes all three with it. Without this a
  -- booking reads "Refunded by bank transfer" under a status saying the money
  -- is still owed, which is worse than saying nothing.
  -- ====================================================================== 3
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  update public.club_event_bookings set refund_status = 'due' where id = v_b;
  reset role;

  v_row := pg_temp.row_of(v_b);
  if v_row.refunded_at is not null
     or v_row.refund_method <> '' or v_row.refund_note <> '' then
    raise exception
      'FAIL 3: a refund that was taken back still says it went out on % by % (%)',
      v_row.refunded_at, v_row.refund_method, v_row.refund_note;
  end if;
  raise notice 'PASS 3: break test — taking a refund back clears when and how';

  -- ====================================================================== 4
  -- The member reads their own team name back. It is the whole of 21g: the
  -- column has existed since 0211 and only the club could see it.
  -- ====================================================================== 4
  set local role authenticated;
  perform pg_temp.be((select member from who));
  select team_name into v_team from public.event_booking_extras(array[v_b]);
  reset role;

  if coalesce(v_team, '') <> 'Red Dice' then
    raise exception 'FAIL 4: the member got "%" back for their own team', v_team;
  end if;
  raise notice 'PASS 4: the member reads the team they booked under';

  -- ====================================================================== 5
  -- And the club does, because it runs the event.
  -- ====================================================================== 5
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  select count(*) into v_n from public.event_booking_extras(array[v_b]);
  reset role;
  if v_n <> 1 then
    raise exception 'FAIL 5: the club could not read its own event''s booking';
  end if;
  raise notice 'PASS 5: and so does the club running it';

  -- ====================================================================== 6
  -- A stranger reads nothing. `security invoker` means the booking's own
  -- select policy decides, and this must not be the hole in it.
  -- ====================================================================== 6
  set local role authenticated;
  perform pg_temp.be((select stranger from who));
  select count(*) into v_n from public.event_booking_extras(array[v_b]);
  reset role;
  if v_n <> 0 then
    raise exception 'FAIL 6: a stranger read % rows of somebody else''s booking', v_n;
  end if;
  raise notice 'PASS 6: a stranger reads nothing';

  -- ====================================================================== 7
  -- The club can change the team name, which is 21f. A team renames itself
  -- between entering and turning up.
  -- ====================================================================== 7
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  update public.club_event_bookings set team_name = 'Blue Dice' where id = v_b;
  reset role;

  v_row := pg_temp.row_of(v_b);
  if v_row.team_name <> 'Blue Dice' then
    raise exception 'FAIL 7: the club could not rename the team on a booking';
  end if;
  raise notice 'PASS 7: the club can change the team name on a booking';

  raise notice 'ALL PASS · 0224 a refund is a record and a team is a name';
end $$;

rollback;
