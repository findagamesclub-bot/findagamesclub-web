-- 0188 · an admin takes a listing down, and the club cannot put it back.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

-- Two more clubs so "newest first" has something to order. Their own
-- timestamps, because every club in this seed is inserted in one statement and
-- would otherwise share one.
-- The seed's own club lands at `now()`, which would make it the newest.
update public.clubs set created_at = now() - interval '10 days' where slug = 'army-club';

insert into public.clubs (slug, name, city, status, created_at, legacy_created_at)
values ('older-club', 'Older Club', 'Leeds', 'active',
        now() - interval '2 days', now() - interval '400 days'),
       ('newest-club', 'Newest Club', 'Hull', 'active',
        now() - interval '1 day', null);

insert into public.club_events
  (club_id, legacy_id, title, start_date, status)
  select id, 'test-event-188', 'Test Open', current_date + 30, 'published' from c;
insert into public.club_events
  (club_id, legacy_id, title, start_date, status)
  select id, 'draft-event-188', 'Half Written', current_date + 45, 'draft' from c;

create temp table ev as select
  (select id from public.club_events where legacy_id = 'test-event-188') as live,
  (select id from public.club_events where legacy_id = 'draft-event-188') as draft;

insert into public.club_event_ticket_types
  (event_id, label, price, audience, position, quantity_available)
  select live, 'Standard', 'GBP 20', 'all', 1, 10 from ev;

-- A notification is readable only by the person it is for, so an ordinary
-- session counting somebody else's reads zero whether one was written or not.
-- Fourth suite to need this.
-- Keyed on the entity as well, because this suite takes two events down and
-- a bare count by kind would pass on the wrong row.
create or replace function pg_temp.notices(p_who uuid, p_kind text, p_entity text default null)
returns bigint language sql security definer set search_path = public as
$$ select count(*) from public.notifications
    where profile_id = p_who and kind = p_kind
      and (p_entity is null or entity_id = p_entity) $$;

-- The words, not just the count. "With a reason for the owner" is the item,
-- and a notice that fires with nothing in it would pass a count assertion.
create or replace function pg_temp.notice_body(
  p_who uuid, p_kind text, p_entity text default null)
returns text language sql security definer set search_path = public as
$$ select coalesce(body, '') from public.notifications
    where profile_id = p_who and kind = p_kind
      and (p_entity is null or entity_id = p_entity)
    order by id desc limit 1 $$;

do $$
declare
  w record; v_club bigint; v_live bigint; v_draft bigint;
  v_row public.clubs%rowtype; v_ev public.club_events%rowtype;
  v_reason text; v_back text; v_names text[];
begin
  select * into w from who;
  select id into v_club from c;
  select live, draft into v_live, v_draft from ev;

  -- 1 · A stranger cannot take a listing down.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_suspend_club(v_club, 'Because I said so.');
    reset role;
    raise exception 'FAIL 1: a stranger suspended a club';
  exception when insufficient_privilege then reset role;
  end;

  -- 2 · Nor can the owner, which is the half the client actually asked about.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_suspend_club(v_club, 'Taking myself down.');
    reset role;
    raise exception 'FAIL 2: the owner suspended their own club';
  exception when insufficient_privilege then reset role;
  end;

  -- 3 · An admin with no reason is refused. The reason is the item.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_suspend_club(v_club, '   ');
    reset role;
    raise exception 'FAIL 3: a listing came down with no reason on it';
  exception when check_violation then reset role;
  end;

  -- 4 · And with one, it comes down and records who said what.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_suspend_club(v_club, 'The venue address is somebody else''s.');
  reset role;

  select * into v_row from public.clubs where id = v_club;
  if v_row.status <> 'suspended' then
    raise exception 'FAIL 4: status is % rather than suspended', v_row.status;
  end if;
  if v_row.suspended_reason <> 'The venue address is somebody else''s.' then
    raise exception 'FAIL 5: the reason was not kept (got %)', v_row.suspended_reason;
  end if;
  if v_row.suspended_by is distinct from w.admin or v_row.suspended_at is null then
    raise exception 'FAIL 6: nobody is recorded as having taken it down';
  end if;
  if v_row.suspended_from <> 'active' then
    raise exception 'FAIL 7: suspended_from is % rather than active', v_row.suspended_from;
  end if;

  -- 5 · The owner cannot put it back. This is the whole requirement.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.resume_club_listing(v_club);
    reset role;
    raise exception 'FAIL 8: the owner lifted an admin suspension';
  exception when check_violation then reset role;
  end;

  -- 6 · Nor can they relabel it as merely paused on the way out.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.pause_club_listing(v_club);
    reset role;
    raise exception 'FAIL 9: a suspension was relabelled as a pause';
  exception when check_violation then reset role;
  end;

  -- 7 · Nobody new gets in while it is down. Triggers, not screens, because
  --     the anon key is public.
  begin
    insert into public.club_memberships (club_id, profile_id, status)
    values (v_club, w.stranger, 'pending');
    raise exception 'FAIL 10: somebody joined a suspended club';
  exception when check_violation then null;
  end;

  -- 8 · The owner can read why. A stranger cannot.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select reason into v_reason from public.club_suspension(v_club);
  reset role;
  if coalesce(v_reason, '') not like 'The venue address%' then
    raise exception 'FAIL 11: the owner cannot read the reason (got %)', v_reason;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', w.stranger, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_reason := null;
  select reason into v_reason from public.club_suspension(v_club);
  reset role;
  if v_reason is not null then
    raise exception 'FAIL 12: a stranger read the suspension reason';
  end if;

  -- 9 · And they were told, with the reason in the notice rather than a
  --     pointer to it.
  if pg_temp.notices(w.owner, 'listing-suspended') <> 1 then
    raise exception 'FAIL 13: the owner was not told their listing came down';
  end if;
  if pg_temp.notice_body(w.owner, 'listing-suspended')
     not like 'The venue address%' then
    raise exception 'FAIL 13b: the notice does not carry the reason (got %)',
      pg_temp.notice_body(w.owner, 'listing-suspended');
  end if;

  -- 10 · Putting it back, by an admin, returns it to where it came from.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_back := public.admin_restore_club(v_club);
  reset role;
  if v_back <> 'active' then
    raise exception 'FAIL 14: restored to % rather than active', v_back;
  end if;
  select * into v_row from public.clubs where id = v_club;
  if v_row.suspended_reason <> '' or v_row.suspended_at is not null then
    raise exception 'FAIL 15: the reason outlived the suspension';
  end if;
  if pg_temp.notices(w.owner, 'listing-restored') <> 1 then
    raise exception 'FAIL 16: the owner was not told it came back';
  end if;

  -- 11 · A club that had paused ITSELF comes back paused, not active. Lifting
  --      our sanction is not overruling their own decision to close.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.pause_club_listing(v_club);
  reset role;

  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_suspend_club(v_club, 'Checked while they were closed.');
  v_back := public.admin_restore_club(v_club);
  reset role;
  if v_back <> 'paused' then
    raise exception 'FAIL 17: a paused club came back as % rather than paused', v_back;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.resume_club_listing(v_club);
  reset role;

  -- ------------------------------------------------------------- events

  -- 12 · The club cannot write the suspended status itself. `status` is in
  --      their own column grant, so the function is not the guard here.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.club_events set status = 'suspended' where id = v_live;
    reset role;
    raise exception 'FAIL 18: the club suspended its own event';
  exception when insufficient_privilege then reset role;
  end;

  -- 13 · An admin can, with a reason. Somebody holds a place on it first, so
  --      what happens to them is measurable rather than assumed.
  insert into public.club_event_bookings
    (event_id, club_id, profile_id, full_name, email, reference, status)
  values (v_live, v_club, w.member, 'Member Eight', 'm@example.com',
          'FAGC-HOLD88', 'reserved');

  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_suspend_event(v_live, 'The poster is somebody else''s artwork.');
  reset role;

  select * into v_ev from public.club_events where id = v_live;
  if v_ev.status <> 'suspended' or v_ev.suspended_from <> 'published' then
    raise exception 'FAIL 19: the event is % from %', v_ev.status, v_ev.suspended_from;
  end if;
  -- The club's own cancellation reason is untouched: two different facts.
  if coalesce(v_ev.cancel_reason, '') <> '' then
    raise exception 'FAIL 20: the suspension overwrote the club''s cancel reason';
  end if;

  -- 14 · And the club cannot put it back on, which is the requirement.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.club_events set status = 'published' where id = v_live;
    reset role;
    raise exception 'FAIL 21: the club lifted an admin suspension on an event';
  exception when insufficient_privilege then reset role;
  end;

  -- 15 · Nor by calling it off and putting it back, which is the two-press
  --      route the ordinary console already offers.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.club_events set status = 'cancelled', cancel_reason = 'x'
     where id = v_live;
    reset role;
    raise exception 'FAIL 22: a suspended event was cancelled out of its suspension';
  exception when insufficient_privilege then reset role;
  end;

  -- 15b · Nor by deleting it. The write policy is `for all`, so guarding the
  --       update and leaving the delete open is a guard with a door beside it.
  --       On the draft, which nobody holds a ticket for: the live one is
  --       already refused by 0090's own delete guard, which would have passed
  --       this for the wrong reason.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_suspend_event(v_draft, 'Checking the venue.');
  reset role;

  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    delete from public.club_events where id = v_draft;
    reset role;
    raise exception 'FAIL 22b: a suspended event was deleted out of its suspension';
  exception when insufficient_privilege then reset role;
  end;

  -- 16 · Everything else about it stays editable. An admin saying the
  --      description breaks the rules is no use if the club cannot fix it.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.club_events set summary = 'Rewritten after the complaint.'
   where id = v_live;
  reset role;

  -- 17 · No new places while it is down.
  begin
    insert into public.club_event_bookings
      (event_id, club_id, profile_id, full_name, email, reference, status)
    values (v_live, v_club, w.stranger, 'Walk In', 'w@example.com',
            'FAGC-TEST88', 'reserved');
    raise exception 'FAIL 23: a place was taken on a suspended event';
  exception when check_violation then null;
  end;

  -- 18 · The club was told, and so was anybody holding a place.
  if pg_temp.notices(w.owner, 'event-taken-down', v_live::text) <> 1 then
    raise exception 'FAIL 24: the club was not told its event came down';
  end if;
  if pg_temp.notice_body(w.owner, 'event-taken-down', v_live::text) not like 'The poster%' then
    raise exception 'FAIL 24d: the event notice does not carry the reason (got %)',
      pg_temp.notice_body(w.owner, 'event-taken-down', v_live::text);
  end if;
  if pg_temp.notices(w.member, 'event-suspended', v_live::text) <> 1 then
    raise exception 'FAIL 24b: the person holding a place was not told';
  end if;
  -- And their place is still held. A suspension can be lifted and 0096
  -- settled that cancelled places cannot be, so cancelling them here would
  -- make the reversible half irreversible.
  if (select status from public.club_event_bookings where reference = 'FAGC-HOLD88')
     <> 'reserved' then
    raise exception 'FAIL 24c: a suspension cancelled somebody''s place';
  end if;

  -- 19 · A draft comes back a draft. Restoring everything to published would
  --      publish an event the club had not finished writing. It was suspended
  --      in 15b, which is where the delete was proved.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_back := public.admin_restore_event(v_draft);
  reset role;
  if v_back <> 'draft' then
    raise exception 'FAIL 25: a draft came back as %', v_back;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_back := public.admin_restore_event(v_live);
  reset role;
  if v_back <> 'published' then
    raise exception 'FAIL 26: the live event came back as %', v_back;
  end if;
  if pg_temp.notices(w.owner, 'event-put-back', v_live::text) <> 1 then
    raise exception 'FAIL 27: the club was not told its event came back';
  end if;

  -- ------------------------------------------------------- newest first

  -- 20 · Newest first means the club that started most recently, which is not
  --      the row that was inserted last: eleven clubs imported in one
  --      afternoon all share a `created_at`, and the legacy date is what says
  --      how old they really are.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select array_agg(name order by ord) into v_names from (
    select name, row_number() over () as ord
      from public.admin_clubs('', '', 'newest', 25, 0)) t;
  reset role;

  if v_names[1] <> 'Newest Club' then
    raise exception 'FAIL 28: newest first led with % (%)', v_names[1], v_names;
  end if;
  if v_names[array_length(v_names, 1)] <> 'Older Club' then
    raise exception 'FAIL 29: the 400-day-old club is not last (%)', v_names;
  end if;

  -- 21 · And by name still orders by name.
  perform set_config('request.jwt.claims',
    json_build_object('sub', w.admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select array_agg(name order by ord) into v_names from (
    select name, row_number() over () as ord
      from public.admin_clubs('', '', 'name', 25, 0)) t;
  reset role;
  if v_names[1] <> 'Army Club' then
    raise exception 'FAIL 30: by name led with % (%)', v_names[1], v_names;
  end if;

  -- 22 · The four-argument version is gone, so nothing can quietly keep
  --      ordering by name after forgetting to pass the sort.
  if to_regprocedure('public.admin_clubs(text, text, integer, integer)') is not null then
    raise exception 'FAIL 31: the old admin_clubs signature is still callable';
  end if;
end $$;

rollback;
\echo '0188 taken down: all pass'
