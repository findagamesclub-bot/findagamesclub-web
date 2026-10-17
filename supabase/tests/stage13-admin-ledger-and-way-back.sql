-- 0202 · the revenue ledger, the owner's way back, and the admin's pen.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

set local timezone = 'Asia/Karachi';

-- Counted as postgres: a notification is readable only by the person it is
-- for, so an ordinary session reads zero whether one was written or not.
-- Three suites have paid for that already.
create or replace function pg_temp.notices(p_kind text, p_entity text)
returns integer language sql security definer as $fn$
  select count(*)::integer from public.notifications
   where kind = p_kind and entity_id = p_entity $fn$;

-- ------------------------------------------------------------------ 9b seed
-- One listing fee and one featured slot inside a 90 day window, and one of
-- each outside it, so the window is doing work rather than passing by default.
insert into public.listing_subscriptions
  (club_id, owner_id, plan_interval, price_pence, status)
  select id, 'e0000000-0000-0000-0000-000000000001', 'yearly', 15000, 'active' from c;

insert into public.listing_payments
  (subscription_id, club_id, amount_pence, paid_at, period_start, period_end,
   kind, method, reference, note)
  -- Midday London, not midnight: `(date)::timestamptz` is read in the
  -- SESSION's zone, so in a +5 harness it lands the evening before and
  -- `london_day` answers the day before that. The same trap 0171's suite
  -- paid for. Noon cannot be moved by any zone this runs in.
  select s.id, c.id, 15000,
         ((public.london_today() - 10)::timestamp + interval '12 hours')
           at time zone 'Europe/London',
         public.london_today() - 10, public.london_today() + 355,
         'subscription', 'bank_transfer', 'INV-202', 'Paid by BACS'
    from c, public.listing_subscriptions s where s.club_id = c.id;

insert into public.listing_payments
  (subscription_id, club_id, amount_pence, paid_at, kind)
  select s.id, c.id, 9900,
         ((public.london_today() - 400)::timestamp + interval '12 hours')
           at time zone 'Europe/London', 'subscription'
    from c, public.listing_subscriptions s where s.club_id = c.id;

insert into public.featured_listings (club_id, starts_on, ends_on, price_pence, note)
  select id, public.london_today() - 5, public.london_today() + 2, 2000,
         'Front page for the open weekend' from c;

insert into public.featured_listings (club_id, starts_on, ends_on, price_pence)
  select id, public.london_today() - 300, public.london_today() - 293, 3000 from c;

-- A listing that has paid and is still in the queue: there is no club yet, so
-- the only name that money has is the one on the submission (0203). A line
-- with an amount and no payer beside it is useless in a tax file.
insert into public.club_submissions
  (owner_id, club_name, city, status, payload)
  values ('e0000000-0000-0000-0000-000000000001', 'Queued Club', 'Leeds',
          'payment_pending', '{}'::jsonb);

insert into public.listing_subscriptions
  (club_id, submission_id, owner_id, plan_interval, price_pence, status)
  select null, sub.id, 'e0000000-0000-0000-0000-000000000001', 'monthly', 1500,
         'active'
    from public.club_submissions sub where sub.club_name = 'Queued Club';

insert into public.listing_payments
  (subscription_id, amount_pence, paid_at, kind)
  select s.id, 1500,
         ((public.london_today() - 3)::timestamp + interval '12 hours')
           at time zone 'Europe/London', 'subscription'
    from public.listing_subscriptions s where s.club_id is null;

-- ------------------------------------------------------------------ 3a seed
-- A club and an event taken down, which is what there is to ask about.
insert into public.club_events (club_id, legacy_id, title, start_date, status)
  select id, 'down-202', 'Suspended Open', current_date + 30, 'published' from c;

select set_config('request.jwt.claims',
  json_build_object('sub', 'e0000000-0000-0000-0000-000000000002',
                    'role', 'authenticated')::text, true);

select public.admin_suspend_club((select id from c), 'Photos are not appropriate');
select public.admin_suspend_event(
  (select id from public.club_events where legacy_id = 'down-202'), 'Wrong address');

do $$
declare
  v_club  bigint;
  v_event bigint;
  v_from  date := public.london_today() - 90;
  v_to    date := public.london_today();
  v_lines integer;
  v_fee   record;
  v_slot  record;
  v_ledger bigint;
  v_chart  bigint;
  v_sub   bigint;
  v_asked timestamptz;
  v_note  text;
  v_told  integer;
begin
  select id into v_club from c;
  select id into v_event from public.club_events where legacy_id = 'down-202';

  -- =====================================================================
  -- 1 · Both kinds of line come back, and only the ones in the window.
  -- =====================================================================
  select count(*) into v_lines
    from public.admin_revenue_lines(v_from, v_to);
  if v_lines <> 3 then
    raise exception 'FAIL 1: the ledger has % lines rather than 3', v_lines;
  end if;

  select * into v_fee from public.admin_revenue_lines(v_from, v_to) r
   where r.kind = 'listing' and r.amount_pence = 15000;
  select * into v_slot from public.admin_revenue_lines(v_from, v_to) r
   where r.kind = 'featured';

  if v_fee.amount_pence <> 15000 or v_slot.amount_pence <> 2000 then
    raise exception 'FAIL 1: amounts read % and %',
      v_fee.amount_pence, v_slot.amount_pence;
  end if;

  -- =====================================================================
  -- 2 · The two kinds of money stay apart. A listing fee was received; a
  --     featured slot is a placement settled offline and nothing has ever
  --     written `listing_payments.kind = 'featured'`. A file that flattened
  --     them would be inventing a receipt.
  -- =====================================================================
  if not v_fee.received or v_slot.received then
    raise exception 'FAIL 2: received reads % and %', v_fee.received, v_slot.received;
  end if;

  -- =====================================================================
  -- 3 · Every column the client asked for, carrying what was recorded.
  -- =====================================================================
  if v_fee.on_date <> public.london_today() - 10
     or v_fee.period_end <> public.london_today() + 355
     or v_fee.plan <> 'yearly'
     or v_fee.note <> 'Paid by BACS'
     or v_fee.club_name = '' then
    raise exception 'FAIL 3: the fee line is missing something: % % % % %',
      v_fee.on_date, v_fee.period_end, v_fee.plan, v_fee.note, v_fee.club_name;
  end if;
  if v_slot.on_date <> public.london_today() - 5
     or v_slot.period_end <> public.london_today() + 2 then
    raise exception 'FAIL 3: the slot line is dated % to %',
      v_slot.on_date, v_slot.period_end;
  end if;

  -- =====================================================================
  -- 3b · A payment taken before the club exists still names something. The
  --      subscription is opened against the submission (0112), so the name
  --      the club typed is the only one that money has.
  -- =====================================================================
  if (select r.club_name from public.admin_revenue_lines(v_from, v_to) r
       where r.amount_pence = 1500) <> 'Queued Club' then
    raise exception 'FAIL 3b: the queued listing''s payment names %',
      (select r.club_name from public.admin_revenue_lines(v_from, v_to) r
        where r.amount_pence = 1500);
  end if;

  -- =====================================================================
  -- 4 · The file and the chart add up to the same figure for one window,
  --     which is the whole reason a treasurer can file it. Same filters,
  --     same dates, or the two quietly measure different things.
  -- =====================================================================
  select coalesce(sum(r.amount_pence), 0) into v_ledger
    from public.admin_revenue_lines(v_from, v_to) r;
  select coalesce(sum(m.listing_pence + m.featured_pence), 0) into v_chart
    from public.admin_growth_months(v_from, v_to) m;
  if v_ledger <> v_chart then
    raise exception 'FAIL 4: the ledger says % and the chart says %',
      v_ledger, v_chart;
  end if;
  if v_ledger = 0 then
    raise exception 'FAIL 4: both are zero, so they agree about nothing';
  end if;
end $$;

-- =====================================================================
-- 5 · The ledger is an admin's, and the guard is an `if` that raises
--     rather than a select whose result nothing reads.
-- =====================================================================
select set_config('request.jwt.claims',
  json_build_object('sub', 'e0000000-0000-0000-0000-000000000004',
                    'role', 'authenticated')::text, true);
do $$
begin
  perform * from public.admin_revenue_lines(null, null);
  raise exception 'FAIL 5: a stranger read the site ledger';
exception when insufficient_privilege then null;
end $$;

-- =====================================================================
-- 6 · A stranger cannot ask for another look at somebody's listing.
-- =====================================================================
do $$
declare v_club bigint;
begin
  select id into v_club from c;
  perform public.ask_suspension_review('club', v_club, 'let me back in');
  raise exception 'FAIL 6: a stranger asked for a review';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------- the owner
select set_config('request.jwt.claims',
  json_build_object('sub', 'e0000000-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text, true);

do $$
declare
  v_club  bigint;
  v_event bigint;
  v_asked timestamptz;
  v_note  text;
  v_told  integer;
  v_back  text;
begin
  select id into v_club from c;
  select id into v_event from public.club_events where legacy_id = 'down-202';

  -- =====================================================================
  -- 7 · The owner asks, the row carries it, and the reader hands it back
  --     so the banner can say it was sent.
  -- =====================================================================
  perform public.ask_suspension_review('club', v_club, 'New photos are up.');
  select r.asked_at, r.asked_note into v_asked, v_note
    from public.club_suspension(v_club) r;
  if v_asked is null or v_note <> 'New photos are up.' then
    raise exception 'FAIL 7: the ask reads % / %', v_asked, v_note;
  end if;

  -- =====================================================================
  -- 8 · Every admin is told, and nobody is told about their own doing.
  --     Counted as postgres, because a notification is readable only by the
  --     person it is for and an ordinary session reads zero either way.
  -- =====================================================================
  select pg_temp.notices('listing-review-asked', v_club::text) into v_told;
  if v_told <> 1 then
    raise exception 'FAIL 8: % admins were told rather than 1', v_told;
  end if;

  -- =====================================================================
  -- 9 · The same action works on an event, which is the half the client
  --     said club requests could never cover.
  -- =====================================================================
  perform public.ask_suspension_review('event', v_event, 'Address corrected.');
  select r.asked_note into v_note from public.event_suspension(v_event) r;
  if v_note <> 'Address corrected.' then
    raise exception 'FAIL 9: the event ask reads %', v_note;
  end if;

  -- =====================================================================
  -- 10 · Asking about something nobody has taken down is a notice about
  --      nothing, and the screen does not offer it either.
  -- =====================================================================
  begin
    perform public.ask_suspension_review(
      'club', (select id from public.clubs where slug = 'army-club' and status <> 'suspended'), '');
    -- No row matches, so the argument is null and the function refuses.
    raise exception 'FAIL 10: a club that is not down accepted an ask';
  exception when raise_exception then
    if sqlerrm like 'FAIL 10%' then raise; end if;
  end;
end $$;

-- =====================================================================
-- 11 · Putting it back clears the ask, so a second suspension does not
--      open carrying last time's sentence. And the restore still tells
--      the owner, which the first draft of 0202 silently dropped.
-- =====================================================================
select set_config('request.jwt.claims',
  json_build_object('sub', 'e0000000-0000-0000-0000-000000000002',
                    'role', 'authenticated')::text, true);

do $$
declare
  v_club  bigint;
  v_event bigint;
  v_rows  integer;
begin
  select id into v_club from c;
  select id into v_event from public.club_events where legacy_id = 'down-202';

  perform public.admin_restore_club(v_club);
  perform public.admin_restore_event(v_event);

  select count(*) into v_rows from public.clubs
   where id = v_club and review_asked_at is null and review_asked_note = '';
  if v_rows <> 1 then raise exception 'FAIL 11: the club kept its ask'; end if;

  select count(*) into v_rows from public.club_events
   where id = v_event and review_asked_at is null and review_asked_note = '';
  if v_rows <> 1 then raise exception 'FAIL 11: the event kept its ask'; end if;

  if pg_temp.notices('event-put-back', v_event::text) < 1 then
    raise exception 'FAIL 11: nobody was told the event went back up';
  end if;
end $$;

-- =====================================================================
-- 12 · An admin may edit a listing that is not published yet, and may not
--      change its status while doing it: the column grant is what makes
--      widening the row policy safe.
-- =====================================================================
insert into public.club_submissions (owner_id, club_name, city, status, payload)
  values ('e0000000-0000-0000-0000-000000000001', 'Pending Club', 'Didcot',
          'review_pending', '{"name":"Pending Club"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'e0000000-0000-0000-0000-000000000002',
                    'role', 'authenticated')::text, true);

do $$
declare v_id bigint; v_name text;
begin
  select id into v_id from public.club_submissions where club_name = 'Pending Club';

  update public.club_submissions set city = 'Oxford' where id = v_id;
  select city into v_name from public.club_submissions where id = v_id;
  if v_name <> 'Oxford' then
    raise exception 'FAIL 12: an admin could not edit a listing under review';
  end if;

  begin
    update public.club_submissions set status = 'approved' where id = v_id;
    raise exception 'FAIL 12: an admin approved a listing through the builder';
  exception when insufficient_privilege then null;
  end;
end $$;

-- And the owner still cannot, which is 0112's rule unchanged: once it is sent
-- it is ours to read, not theirs to keep typing into.
select set_config('request.jwt.claims',
  json_build_object('sub', 'e0000000-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text, true);
do $$
declare v_id bigint; v_hit integer;
begin
  select id into v_id from public.club_submissions where club_name = 'Pending Club';
  update public.club_submissions set city = 'Reading' where id = v_id;
  get diagnostics v_hit = row_count;
  if v_hit <> 0 then
    raise exception 'FAIL 12: the owner edited a listing already under review';
  end if;
end $$;

reset role;
rollback;
\echo 'stage13-admin-ledger-and-way-back: all pass'
