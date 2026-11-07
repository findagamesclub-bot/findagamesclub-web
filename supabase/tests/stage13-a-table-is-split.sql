-- 0221 · a table is split between the people on it, and each half is priced
-- off that person's own tier.
--
-- Section 2 is the client's own example and the one that fails under the old
-- rule: a Life Member whose tier waives the fee books a table against a Basic
-- member, and the club used to be owed nothing by either of them.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Read as postgres. The booking's own select policy is wider than this test
-- needs and narrower than its assertions: a figure hidden by RLS reads as
-- zero, which is also a wrong answer.
create or replace function pg_temp.row_of(p_booking bigint)
returns public.club_bookings language sql security definer as $fn$
  select * from public.club_bookings where id = p_booking $fn$;

-- The club charges a fiver a table.
insert into public.club_booking_settings (club_id, table_booking_price, price_currency)
  select id, 5.00, 'GBP' from c
on conflict (club_id) do update set table_booking_price = 5.00;

-- Two tiers: one that waives the table fee, one that does not.
insert into public.club_membership_tiers (club_id, tier_key, label, benefits)
  select id, 'life', 'Life Member', '{"waiveGameBookingFee": true}'::jsonb from c;
insert into public.club_membership_tiers (club_id, tier_key, label, benefits)
  select id, 'basic', 'Basic', '{}'::jsonb from c;

-- The seed puts the owner and the member on 'basic' already.
update public.club_memberships m set tier_key = 'basic'
  from c where m.club_id = c.id;

create temp table night as
  select s.id from public.club_sessions s, c where s.club_id = c.id limit 1;
grant select on night to authenticated;

-- A Thursday far enough out that the past-date guard cannot fire.
create or replace function pg_temp.next_thursday(n integer default 1) returns date
language sql as $$
  select (current_date + (((4 - extract(isodow from current_date))::int + 6) % 7 + 1)
          + (n - 1) * 7)::date $$;

-- A booking as it looks from BEFORE the split: an opponent named, and no
-- share against their seat, because per-seat pricing did not exist when it was
-- made. Every row at a live club is one of these, so a test without one is a
-- test of a database nobody has.
update public.club_bookings b
   set opponent_base_price = 0, opponent_total_price = 0,
       opponent_tier_discount_amount = 0, opponent_tier_discount_percent = 0
  from c
 where b.club_id = c.id;

do $$
declare
  v_club    bigint;
  v_b       bigint;
  v_row     public.club_bookings%rowtype;
  v_n       integer;
  v_money   jsonb;
  v_home    numeric(10,2);
  v_away    numeric(10,2);
begin
  select id into v_club from c;

  -- ====================================================================== 1
  -- Two basic members: half each, nothing waived.
  -- ====================================================================== 1
  set local role authenticated;
  perform pg_temp.be((select member from who));
  -- Only the seven columns a member may name; `booked_by` defaults to
  -- auth.uid() and the whole money block is the trigger's (0014).
  insert into public.club_bookings
    (club_id, club_session_id, session_date, opponent_profile_id,
     opponent_name, game_title)
  select v_club, n.id, pg_temp.next_thursday(2),
         (select owner from who), 'Owner Eight', 'Warhammer 40,000'
    from night n returning id into v_b;
  reset role;

  v_row := pg_temp.row_of(v_b);
  if v_row.base_price <> 2.50 or v_row.opponent_base_price <> 2.50 then
    raise exception 'FAIL 1: the halves came back as % and %',
      v_row.base_price, v_row.opponent_base_price;
  end if;
  if v_row.total_price <> 2.50 or v_row.opponent_total_price <> 2.50 then
    raise exception 'FAIL 1: the totals came back as % and %',
      v_row.total_price, v_row.opponent_total_price;
  end if;
  raise notice 'PASS 1: a fiver between two basic members is £2.50 each';

  -- ====================================================================== 2
  -- THE CLIENT'S OWN CASE. The booker's tier waives the fee; the opponent's
  -- does not. Under the old rule the whole table was free, because only the
  -- booker's tier was ever read.
  -- ====================================================================== 2
  update public.club_memberships set tier_key = 'life'
   where club_id = v_club and profile_id = (select member from who);

  set local role authenticated;
  perform pg_temp.be((select member from who));
  insert into public.club_bookings
    (club_id, club_session_id, session_date, opponent_profile_id,
     opponent_name, game_title)
  select v_club, n.id, pg_temp.next_thursday(3),
         (select owner from who), 'Owner Eight', 'Warhammer 40,000'
    from night n returning id into v_b;
  reset role;

  v_row := pg_temp.row_of(v_b);
  if v_row.total_price <> 0 then
    raise exception 'FAIL 2: the Life Member was charged %', v_row.total_price;
  end if;
  if v_row.opponent_total_price <> 2.50 then
    raise exception 'FAIL 2: the basic member owes % and should owe 2.50',
      v_row.opponent_total_price;
  end if;
  if v_row.opponent_tier_label <> 'Basic' then
    raise exception 'FAIL 2: the opponent''s tier came back as "%"',
      v_row.opponent_tier_label;
  end if;
  raise notice 'PASS 2: one half included in a membership, the other still owed';

  -- ====================================================================== 3
  -- Nobody else on the table: the booker is reserving the whole thing.
  -- ====================================================================== 3
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  insert into public.club_bookings
    (club_id, club_session_id, session_date, game_title)
  select v_club, n.id, pg_temp.next_thursday(4), 'Warhammer 40,000'
    from night n returning id into v_b;
  reset role;

  v_row := pg_temp.row_of(v_b);
  if v_row.base_price <> 5.00 or v_row.opponent_base_price <> 0 then
    raise exception 'FAIL 3: a table nobody else is on split into % and %',
      v_row.base_price, v_row.opponent_base_price;
  end if;
  raise notice 'PASS 3: a table nobody else is on is the booker''s whole table';

  -- ====================================================================== 4
  -- BREAK TEST. Somebody joins and the table re-splits. This is the half the
  -- old code could not do at all: pricing fired on insert only, so an opponent
  -- added afterwards changed nothing about the money.
  -- ====================================================================== 4
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  perform public.edit_booking_details(v_b, 'Warhammer 40,000', '',
                                      '', false, null,
                                      (select member from who), true);
  reset role;

  v_row := pg_temp.row_of(v_b);
  if v_row.base_price <> 2.50 or v_row.opponent_base_price <> 2.50 then
    raise exception
      'FAIL 4: an opponent was added and the halves are still % and % — '
      'the price is not following the people', v_row.base_price, v_row.opponent_base_price;
  end if;
  -- And the newcomer's own tier decides their half, not the booker's.
  if v_row.opponent_total_price <> 0 then
    raise exception 'FAIL 4: the Life Member who joined was charged %',
      v_row.opponent_total_price;
  end if;
  raise notice 'PASS 4: break test — adding somebody re-splits, on their own tier';

  -- ====================================================================== 5
  -- Money already recorded is never re-priced.
  -- ====================================================================== 5
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  perform public.club_set_booking_payment(v_b, 'booker', 'paid_on_the_door', 'Cash', 'Took a fiver');
  -- Now take the opponent back off. The booker's half would otherwise jump
  -- back to the whole table under somebody who has already settled it.
  perform public.edit_booking_details(v_b, 'Warhammer 40,000', '',
                                      '', false, null, null, true);
  reset role;

  v_row := pg_temp.row_of(v_b);
  if v_row.base_price <> 2.50 then
    raise exception 'FAIL 5: a settled half was re-priced to %', v_row.base_price;
  end if;
  raise notice 'PASS 5: a half somebody has settled is not re-priced underneath them';

  -- ====================================================================== 6
  -- Per member per table: A has paid, B has not.
  -- ====================================================================== 6
  set local role authenticated;
  perform pg_temp.be((select member from who));
  insert into public.club_bookings
    (club_id, club_session_id, session_date, opponent_profile_id,
     opponent_name, game_title)
  select v_club, n.id, pg_temp.next_thursday(5),
         (select owner from who), 'Owner Eight', 'Warhammer 40,000'
    from night n returning id into v_b;

  perform pg_temp.be((select owner from who));
  perform public.club_set_booking_payment(v_b, 'opponent', 'paid_in_advance', 'Transfer', 'B paid up');
  reset role;

  v_row := pg_temp.row_of(v_b);
  if v_row.opponent_payment_status <> 'paid_in_advance' then
    raise exception 'FAIL 6: the opponent''s half reads %', v_row.opponent_payment_status;
  end if;
  if v_row.payment_status <> 'unpaid' then
    raise exception 'FAIL 6: settling one half settled the other (%)', v_row.payment_status;
  end if;
  if v_row.opponent_paid_at is null or v_row.paid_at is not null then
    raise exception 'FAIL 6: the stamps do not match the statuses';
  end if;
  raise notice 'PASS 6: one half can be paid while the other is not';

  -- ====================================================================== 7
  -- A member cannot record their own payment, which is the club's word.
  -- ====================================================================== 7
  set local role authenticated;
  perform pg_temp.be((select member from who));
  begin
    perform public.club_set_booking_payment(v_b, 'booker', 'paid_on_the_door', '', 'I paid');
    reset role;
    raise exception 'FAIL 7: a member recorded their own table payment';
  exception
    when insufficient_privilege then
      reset role;
      raise notice 'PASS 7: a member cannot record their own table payment';
  end;

  -- ====================================================================== 8
  -- An empty second seat has no half to settle.
  -- ====================================================================== 8
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  insert into public.club_bookings
    (club_id, club_session_id, session_date, game_title)
  select v_club, n.id, pg_temp.next_thursday(6), 'Warhammer 40,000'
    from night n returning id into v_b;
  begin
    perform public.club_set_booking_payment(v_b, 'opponent', 'paid_on_the_door', '', '');
    reset role;
    raise exception 'FAIL 8: a payment was recorded against an empty seat';
  exception
    when check_violation then
      reset role;
      raise notice 'PASS 8: an empty second seat has no half to settle';
  end;

  -- ====================================================================== 9
  -- The list is one row per person, and a solo table is one row.
  -- ====================================================================== 9
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  select count(*) into v_n from public.club_table_bookings(v_club, 'all', '', '', 'newest', 1, 100);
  reset role;

  -- Rather than pin the arithmetic, assert the shape that matters: one row
  -- for every booker, and one more for every second seat that was charged a
  -- share. 0222 is the second half of that test — a seat with no share is a
  -- row nobody can collect, and the seed's own booking predates the split.
  if v_n <> (select count(*) from public.club_bookings b where b.club_id = v_club)
           + (select count(*) from public.club_bookings b
               where b.club_id = v_club
                 and (coalesce(b.opponent_profile_id, b.accepted_by) is not null
                      or btrim(coalesce(b.opponent_name, '')) <> '')
                 and b.opponent_base_price > 0) then
    raise exception 'FAIL 9: the list returned % rows, which is not one per charged seat', v_n;
  end if;
  if not exists (select 1 from public.club_bookings b
                  where b.club_id = v_club and b.opponent_base_price = 0
                    and btrim(coalesce(b.opponent_name, '')) <> '') then
    raise exception 'FAIL 9: no unsplit booking in the fixture, so 0222 proves nothing here';
  end if;
  raise notice 'PASS 9: one row per person, and none for a seat never charged';

  -- ===================================================================== 10
  -- The counts answer about the same set the list does.
  -- ===================================================================== 10
  set local role authenticated;
  perform pg_temp.be((select owner from who));
  select all_rows into v_n from public.club_table_booking_counts(v_club, '', '');
  reset role;

  if v_n <> (select count(*) from public.club_table_bookings(v_club, 'all', '', '', 'newest', 1, 500)) then
    raise exception 'FAIL 10: the counts say % and the list says something else', v_n;
  end if;
  raise notice 'PASS 10: the counts and the list answer about one set';

  -- ===================================================================== 11
  -- The accounts count both halves of a table, or a club's table income is
  -- short by every opponent who owes one.
  -- ===================================================================== 11
  select coalesce(sum(b.total_price), 0), coalesce(sum(b.opponent_total_price), 0)
    into v_home, v_away
    from public.club_bookings b
   where b.club_id = v_club and b.status <> 'cancelled'
     and b.session_date between public.london_today() and public.london_today() + 90;

  set local role authenticated;
  perform pg_temp.be((select owner from who));
  v_money := public.club_analytics_money(v_club, public.london_today(),
                                         public.london_today() + 90);
  reset role;

  if (v_money -> 'tables' ->> 'net')::numeric <> v_home + v_away then
    raise exception 'FAIL 11: the money report says % and the two halves come to %',
      v_money -> 'tables' ->> 'net', v_home + v_away;
  end if;
  if v_away <= 0 then
    raise exception 'FAIL 11: the fixture has no opponent half, so assertion 11 proves nothing';
  end if;
  raise notice 'PASS 11: the accounts count both halves of a table';

  raise notice 'ALL PASS · 0221 a table is split between the people on it';
end $$;

rollback;
