-- 0148/0149/0150 · Preferences, unsubscribes, what is due, and the two reads.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- The jobs hold the service role, so the test plays the job here.
create or replace function pg_temp.token(p uuid, f text) returns text
language sql security definer as $fn$
  select public.issue_unsubscribe_token(p, f) $fn$;

create or replace function pg_temp.due(n integer default 200)
returns setof record language sql security definer as $fn$
  select * from public.event_alerts_due(n) $fn$;

create or replace function pg_temp.mark(ids bigint[]) returns integer
language sql security definer as $fn$ select public.mark_event_alerts_sent(ids) $fn$;

create or replace function pg_temp.once(p uuid, k text, e text) returns boolean
language sql security definer as $fn$ select public.record_delivery(p, k, e) $fn$;

-- Backdating is how a twenty-hour window gets tested without waiting a day.
-- `authenticated` has no update grant on the table, which is itself correct:
-- `last_sent_at` belongs to the job, not to the person who saved the search.
create or replace function pg_temp.backdate(h numeric) returns void
language sql security definer as $fn$
  update public.club_event_alerts
     set last_sent_at = now() - (h || ' hours')::interval $fn$;

set local role authenticated;

-- ===========================================================================
-- 0148 · preferences
-- ===========================================================================

select pg_temp.be(member) from who;

-- A member with no rows at all. That is the default state and it is legal:
-- every family reads as on because nothing says otherwise.
do $$ begin
  if exists (select 1 from public.notification_preferences) then
    raise exception 'a new account should carry no preference rows';
  end if;
end $$;

select public.save_notification_preference('membership', true, false);
do $$
declare v record;
begin
  select * into v from public.notification_preferences where family = 'membership';
  if v.email is not false or v.bell is not true then
    raise exception 'membership row is % / %', v.bell, v.email;
  end if;
end $$;

-- Saving again is an update, not a second row.
select public.save_notification_preference('membership', true, true);
do $$
declare n integer;
begin
  select count(*) into n from public.notification_preferences where family = 'membership';
  if n <> 1 then raise exception 'save made % rows', n; end if;
  if not (select email from public.notification_preferences where family = 'membership') then
    raise exception 'the second save did not take';
  end if;
end $$;

-- Replies is locked on, and the server is where that is true.
do $$ begin
  begin
    perform public.save_notification_preference('replies', true, false);
    raise exception 'replies email was allowed off';
  exception when others then
    if sqlerrm <> 'REPLIES_EMAIL_LOCKED' then raise; end if;
  end;
end $$;

-- An invented family is refused by the check constraint rather than stored.
do $$ begin
  begin
    perform public.save_notification_preference('whatever', true, false);
    raise exception 'an unknown family was stored';
  exception when check_violation then null;
  end;
end $$;

-- Nobody can write a row directly, whatever they claim about themselves.
do $$ begin
  begin
    insert into public.notification_preferences (profile_id, family, bell, email)
    values ((select member from who), 'money', true, false);
    raise exception 'a direct insert was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- And nobody reads anybody else's.
select pg_temp.be(stranger) from who;
do $$
declare n integer;
begin
  select count(*) into n from public.notification_preferences;
  if n <> 0 then raise exception 'a stranger read % rows', n; end if;
end $$;

-- ===========================================================================
-- 0148 · unsubscribing without signing in
-- ===========================================================================

select pg_temp.be(member) from who;
select public.save_notification_preference('bookings', true, true);

do $$
declare t1 text; t2 text; v record; fam text;
begin
  t1 := pg_temp.token((select member from who), 'bookings');
  if t1 is null or length(t1) < 32 then raise exception 'token is %', t1; end if;

  -- Reused, not reissued: a link in a March email still works in September.
  t2 := pg_temp.token((select member from who), 'bookings');
  if t1 <> t2 then raise exception 'a second token was issued'; end if;

  select * into v from public.resolve_unsubscribe_token(t1);
  if v.family <> 'bookings' or v.already_off then
    raise exception 'resolve said % / %', v.family, v.already_off;
  end if;

  fam := public.apply_unsubscribe(t1);
  if fam <> 'bookings' then raise exception 'apply said %', fam; end if;
  if (select email from public.notification_preferences where family = 'bookings') then
    raise exception 'bookings email is still on';
  end if;

  -- A second press says the same thing. Telling somebody their unsubscribe
  -- link is invalid is how a spam complaint starts.
  if public.apply_unsubscribe(t1) <> 'bookings' then
    raise exception 'the second press failed';
  end if;
  select * into v from public.resolve_unsubscribe_token(t1);
  if not v.already_off then raise exception 'resolve did not notice it is off'; end if;

  -- A token nobody issued resolves to nothing rather than to somebody.
  if public.apply_unsubscribe('not-a-token') is not null then
    raise exception 'a made-up token was applied';
  end if;
end $$;

-- Unsubscribing for somebody who has no row yet writes one rather than failing.
do $$
declare t text;
begin
  t := pg_temp.token((select stranger from who), 'events');
  if public.apply_unsubscribe(t) <> 'events' then raise exception 'no row, no unsubscribe'; end if;
  if (select email from public.notification_preferences
       where profile_id = (select stranger from who) and family = 'events') then
    raise exception 'the stranger is still subscribed';
  end if;
end $$;

-- The tokens themselves are not readable. They are the secret.
do $$
declare n integer;
begin
  begin
    select count(*) into n from public.unsubscribe_tokens;
  exception when insufficient_privilege then return;
  end;
  if n <> 0 then raise exception 'a member read % tokens', n; end if;
end $$;

-- ===========================================================================
-- 0149 · what is due, and what has gone
-- ===========================================================================

insert into public.club_event_alerts (profile_id, label, filters)
  select member, 'Warhammer near Didcot', '{"q":"warhammer","city":"Didcot"}'::jsonb from who;

do $$
declare v record; n integer;
begin
  -- A brand new alert is due at once, and its window starts where it was
  -- saved, so the first digest is what has appeared since rather than the
  -- whole directory.
  select * into v from pg_temp.due(200) as t(id bigint, profile_id uuid,
    label text, filters jsonb, since timestamptz);
  if v.id is null then raise exception 'a new alert was not due'; end if;
  if v.since > now() or v.since < now() - interval '1 minute' then
    raise exception 'the first window starts at %', v.since;
  end if;

  if pg_temp.mark(array[v.id]) <> 1 then raise exception 'marking touched nothing'; end if;

  select count(*) into n from pg_temp.due(200) as t(id bigint, profile_id uuid,
    label text, filters jsonb, since timestamptz);
  if n <> 0 then raise exception 'a marked alert is still due'; end if;

  -- Twenty hours, not twenty-four, so a job that drifts does not skip a day.
  perform pg_temp.backdate(21);
  select count(*) into n from pg_temp.due(200) as t(id bigint, profile_id uuid,
    label text, filters jsonb, since timestamptz);
  if n <> 1 then raise exception 'a 21-hour-old alert is not due'; end if;

  perform pg_temp.backdate(19);
  select count(*) into n from pg_temp.due(200) as t(id bigint, profile_id uuid,
    label text, filters jsonb, since timestamptz);
  if n <> 0 then raise exception 'a 19-hour-old alert is due too soon'; end if;
end $$;

-- The ledger: true once, false after, and the key is part of the identity.
do $$ begin
  if not pg_temp.once((select member from who), 'membership_expiring', '7:2026-10-31') then
    raise exception 'the first send was refused';
  end if;
  if pg_temp.once((select member from who), 'membership_expiring', '7:2026-10-31') then
    raise exception 'the same thing was sent twice';
  end if;
  -- Next period is a different thing and goes out.
  if not pg_temp.once((select member from who), 'membership_expiring', '7:2026-11-30') then
    raise exception 'the next period was refused';
  end if;
end $$;

-- ===========================================================================
-- 0150 · tickets left, counted
-- ===========================================================================

set local role postgres;
insert into public.club_events (club_id, legacy_id, title, start_date)
  select id, '2026-11-01-open', 'The Open', current_date + 30 from c;
insert into public.club_event_ticket_types (event_id, label, price, quantity_available)
  select e.id, 'Entry', '20', 40 from public.club_events e where e.legacy_id = '2026-11-01-open';

do $$
declare v record;
begin
  select * into v from public.event_tickets_taken_many(
    array(select id from public.club_events)) limit 1;
  if v.remaining <> 40 then raise exception 'an untouched event has % left', v.remaining; end if;
end $$;

-- Sell four, and the card must say 36 rather than the 40 the club typed.
insert into public.club_event_bookings
  (club_id, event_id, profile_id, full_name, email, status, reference)
  select c.id, e.id, (select member from who), 'Member Eight',
         'member8@example.com', 'reserved', 'REF1'
    from c, public.club_events e where e.legacy_id = '2026-11-01-open';
insert into public.club_event_booking_items (booking_id, ticket_type_id, quantity, unit_amount)
  select b.id, t.id, 4, 20
    from public.club_event_bookings b, public.club_event_ticket_types t
   where b.reference = 'REF1';

do $$
declare v record;
begin
  select * into v from public.event_tickets_taken_many(
    array(select id from public.club_events)) limit 1;
  if v.remaining <> 36 then raise exception 'after four sales, % left', v.remaining; end if;
end $$;

-- An unlimited type means no answer, not "none left".
do $$
declare v record;
begin
  update public.club_event_ticket_types set quantity_available = null;
  select * into v from public.event_tickets_taken_many(
    array(select id from public.club_events)) limit 1;
  if v.remaining is not null then raise exception 'unlimited read as %', v.remaining; end if;
  update public.club_event_ticket_types set quantity_available = 40;
end $$;

-- An event selling no typed tickets returns no row at all, so the caller falls
-- back to the club's own figure rather than showing zero.
do $$
declare n integer;
begin
  insert into public.club_events (club_id, legacy_id, title, start_date)
    select id, '2026-12-01-quiet', 'Quiet Night', current_date + 60 from c;
  select count(*) into n from public.event_tickets_taken_many(
    array(select id from public.club_events e where e.legacy_id = '2026-12-01-quiet'));
  if n <> 0 then raise exception 'an event with no ticket types returned % rows', n; end if;
end $$;

-- ===========================================================================
-- 0150 · the review summary
-- ===========================================================================

do $$
declare v record;
begin
  insert into public.club_reviews (id, club_id, author_name, rating, comment)
    select 900001, id, 'A', 5, 'great' from c;
  insert into public.club_reviews (id, club_id, author_name, rating, comment)
    select 900002, id, 'B', 4, 'good' from c;

  select * into v from public.club_review_summary where club_id = (select id from c);
  if v.review_count <> 2 or v.average <> 4.50 then
    raise exception 'two reviews read % at %', v.review_count, v.average;
  end if;

  -- Removing one moves it, which is the case the Node version got right by
  -- filtering and this one has to get right by firing.
  update public.club_reviews set removed_at = now() where id = 900002;
  select * into v from public.club_review_summary where club_id = (select id from c);
  if v.review_count <> 1 or v.average <> 5.00 then
    raise exception 'after a removal, % at %', v.review_count, v.average;
  end if;

  -- And restoring it moves it back.
  update public.club_reviews set removed_at = null where id = 900002;
  select * into v from public.club_review_summary where club_id = (select id from c);
  if v.average <> 4.50 then raise exception 'after a restore, %', v.average; end if;

  -- The last visible review going leaves no row, so "no reviews" is the
  -- absence of a row rather than a zero that has to be read around.
  delete from public.club_reviews where club_id = (select id from c);
  if exists (select 1 from public.club_review_summary where club_id = (select id from c)) then
    raise exception 'an empty club kept its summary row';
  end if;
end $$;

-- The summary is public, and it is read-only.
set local role authenticated;
select pg_temp.be(stranger) from who;
do $$ begin
  begin
    insert into public.club_review_summary (club_id, review_count, rating_sum, average)
      values ((select id from c), 99, 495, 5.00);
    raise exception 'a member wrote the summary';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
