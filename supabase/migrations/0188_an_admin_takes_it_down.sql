-- 0188 · An admin takes a listing down, and the club cannot put it back
--
-- The client's words: "There should be a separate admin function to take down
-- or suspend a club listing or event listing, with a reason given to the
-- owner. The owner should not be able to reinstate it without the admin."
--
-- Three of the four halves already existed and none of them met.
--
--   · `clubs.status` has allowed 'suspended' since 0002, and 0111's lapse job
--     is the only thing that has ever written it. There was no admin function,
--     no reason, and no screen. `resume_club_listing` already refuses anything
--     that is not 'paused' (0108), so the "owner cannot reinstate" half has
--     been true the whole time and nothing could get a club into the state
--     where it mattered.
--   · `findClubDetail` filters `.in('status', ('active','paused'))`, so a
--     suspended club is Not Found for its own owner. A reason nobody can read
--     is not a reason, which is why that filter moves with this.
--   · `club_events` has draft / published / cancelled and nothing else, and
--     `status` is in the club's own column grant: an admin writing 'cancelled'
--     is a sanction the club lifts with one press of "Put it back on".
--
-- The two tables store it the same way on purpose, because the screens are the
-- same screen twice: an admin types a reason and presses Take it down, the
-- owner reads it on a banner, and only an admin can clear it. What differs is
-- the guard, and it differs because the tables do. `clubs.status` is not in any
-- column grant, so the function IS the guard. `club_events.status` is granted,
-- so a trigger has to refuse the club directly: the anon key is public and the
-- screens are not what stops anybody.
--
-- `suspended_from` is the status it was in. Restoring a club that had paused
-- itself back to 'active' would put it in the directory it had deliberately
-- left, and restoring an event back to 'published' would publish somebody
-- else's draft. The column is written and read only inside these functions, so
-- nothing selects it and `check:columns` has nothing to say about it.
--
-- The reason is read through `club_suspension` / `event_suspension` rather than
-- selected, for the reason `club_tier_requests` and `my_coaching_bookings`
-- exist: `src/types/database.ts` has not been regenerated and `check:columns`
-- is right to refuse a select naming a column it has never heard of. It costs a
-- round trip only on a listing that is actually down.
--
-- What a suspension does, and does not do:
--
--   · gone from the directory, the map, search, the events list and the
--     homepage, exactly as a pause is
--   · the owner and any admin can still open the club, its console and its
--     billing page, so a club that was hidden for an unpaid subscription can
--     still pay. Nobody else can: a member of a suspended club gets Not Found,
--     which is the line 0108 deliberately drew between a club stopping itself
--     and us stopping it
--   · joining, table bookings and event tickets are refused in the database,
--     by widening 0108's own trigger rather than writing a second one
--   · a suspended event keeps its reserved places. A suspension can be lifted
--     and 0096 already settled that places taken back cannot be, so the
--     holders are told rather than cancelled
--   · the owner, the other admins and anybody holding a ticket are all told,
--     both ways round, because the undo is news as well

-- ------------------------------------------------------------------- clubs

alter table public.clubs
  add column if not exists suspended_reason text not null default '',
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users (id) on delete set null,
  add column if not exists suspended_from text;

-- Belt and braces. `clubs` is granted by column list (0002), so a new column
-- arrives ungranted, and 0151 took the whole-table grants back across the
-- schema. Saying it anyway costs nothing and survives somebody re-running an
-- older grant block.
revoke update (suspended_reason, suspended_at, suspended_by, suspended_from)
  on public.clubs from authenticated, anon;

/**
 * Take a club out of the directory, with the reason the owner will read.
 *
 * From 'active' or 'paused' only. 'pending' is a listing nobody has approved
 * and 'archived' is already over, so there is nothing to take down in either.
 */
create or replace function public.admin_suspend_club(p_club bigint, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- The reason is the whole point of the item, so an empty one is refused
  -- here as well as on the screen. A form field is a claim, not a fact.
  if v_reason = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'check_violation';
  end if;

  select status into v_status from public.clubs where id = p_club for update;

  if v_status is null then
    raise exception 'CLUB_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_status = 'suspended' then
    raise exception 'CLUB_ALREADY_DOWN' using errcode = 'check_violation';
  end if;
  if v_status not in ('active', 'paused') then
    raise exception 'CLUB_NOT_LIVE' using errcode = 'check_violation';
  end if;

  update public.clubs
     set status = 'suspended',
         suspended_reason = left(v_reason, 1000),
         suspended_at = now(),
         suspended_by = (select auth.uid()),
         suspended_from = v_status,
         updated_at = now()
   where id = p_club;

  return 'suspended';
end;
$$;

/**
 * Put it back where it was.
 *
 * To `suspended_from` rather than to 'active'. A club that had paused itself
 * and was then suspended comes back paused: lifting our sanction is not the
 * same as overruling their own decision to close for the summer.
 */
create or replace function public.admin_restore_club(p_club bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_back   text;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select status, suspended_from into v_status, v_back
    from public.clubs where id = p_club for update;

  if v_status is null then
    raise exception 'CLUB_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_status <> 'suspended' then
    raise exception 'CLUB_NOT_DOWN' using errcode = 'check_violation';
  end if;

  -- 0111's lapse job suspends without going through this file, so a club can
  -- be suspended with nothing recorded about where it came from. Active is the
  -- honest default for one of those: it was in the directory when we hid it.
  if coalesce(v_back, '') not in ('active', 'paused') then
    v_back := 'active';
  end if;

  update public.clubs
     set status = v_back,
         suspended_reason = '', suspended_at = null,
         suspended_by = null, suspended_from = null,
         updated_at = now()
   where id = p_club;

  return v_back;
end;
$$;

/**
 * Why this club is down, for the banner the owner reads.
 *
 * Definer, and it hands back less than the row does: the reason, the day and
 * who wrote it. Readable by the owner and by an admin, which is the audience
 * `clubs_select_own` already draws, said once here rather than left to a
 * policy that was written about a different question.
 */
create or replace function public.club_suspension(p_club bigint)
returns table (reason text, suspended_at timestamptz, by_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.clubs where id = p_club;
  if v_owner is null and not public.is_admin() then
    return;
  end if;
  if not public.is_admin() and v_owner is distinct from (select auth.uid()) then
    return;
  end if;

  return query
  select c.suspended_reason, c.suspended_at, coalesce(p.full_name, '')
    from public.clubs c
    left join public.profiles p on p.id = c.suspended_by
   where c.id = p_club and c.status = 'suspended';
end;
$$;

revoke all on function public.admin_suspend_club(bigint, text) from public, anon;
revoke all on function public.admin_restore_club(bigint) from public, anon;
revoke all on function public.club_suspension(bigint) from public, anon;
grant execute on function public.admin_suspend_club(bigint, text) to authenticated;
grant execute on function public.admin_restore_club(bigint) to authenticated;
grant execute on function public.club_suspension(bigint) to authenticated;

-- 0108's own trigger, widened. Three tables hang off this one function, so a
-- second copy for suspension would be three more triggers to keep in step.
create or replace function public.club_is_taking_people()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.clubs where id = new.club_id;

  if v_status = 'paused' then
    raise exception 'CLUB_PAUSED' using errcode = 'check_violation';
  end if;

  -- Its own code, because the two are not the same thing to say to anybody:
  -- one is the club's own decision and the other is ours.
  if v_status = 'suspended' then
    raise exception 'CLUB_SUSPENDED' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.club_is_taking_people() from public, anon, authenticated;

-- 0110's trigger, with the other two states on it. A trigger rather than the
-- functions above, for the reason 0110 gives: `clubs.status` moves from the
-- owner's console, from these functions and from the lapse job, and a notice
-- that fires on one path is worse than none.
create or replace function public.clubs_status_told()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin  record;
  v_actor  uuid := (select auth.uid());
  v_kind   text;
  v_stale  text;
  v_stale_owner text;
  v_owner_kind  text;
  v_title  text;
  v_body   text;
  v_owner_title text;
  v_owner_body  text;
  v_owner_href  text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'paused' then
    v_kind  := 'club-paused';
    v_stale := 'club-resumed';
    v_stale_owner := 'listing-resumed';
    v_owner_kind  := 'listing-paused';
    v_title := new.name || ' has paused its listing';
    v_body  := 'It is out of the directory. Nobody new can find the club, join it '
               || 'or book a table, and its members still have everything.';
    v_owner_title := new.name || ' has been taken out of the directory';
    v_owner_body  := 'Nobody new can find your club, join it or book a table. Your members '
               || 'still have everything. Get in touch if this is not what you expected.';
    v_owner_href  := '/clubs/' || new.slug || '/manage/listing/review';

  elsif new.status = 'suspended' then
    v_kind  := 'club-suspended';
    v_stale := 'club-restored';
    v_stale_owner := 'listing-restored';
    v_owner_kind  := 'listing-suspended';
    v_title := new.name || ' has been taken down';
    v_body  := 'An admin has taken the listing out of the directory. It is not '
               || 'something the club can put back.';
    v_owner_title := new.name || ' has been taken out of the directory by an admin';
    -- The reason itself rather than a pointer to it. A notice saying something
    -- happened and not why is a notice that costs somebody a second click to
    -- learn the one thing they opened it for.
    v_owner_body  := case when btrim(coalesce(new.suspended_reason, '')) = ''
                          then 'Your club page and everything under it still open for you. '
                               || 'Only an admin can put the listing back.'
                          else new.suspended_reason
                               || ' Your club page and everything under it still open for '
                               || 'you. Only an admin can put the listing back.' end;
    v_owner_href  := '/clubs/' || new.slug || '/manage/listing/review';

  elsif old.status = 'suspended' then
    v_kind  := 'club-restored';
    v_stale := 'club-suspended';
    v_stale_owner := 'listing-suspended';
    v_owner_kind  := 'listing-restored';
    v_title := new.name || ' is back in the directory';
    v_body  := 'An admin has put the listing back.';
    v_owner_title := new.name || ' is back in the directory';
    v_owner_body  := 'People can find your club again, join it and book tables.';
    v_owner_href  := '/clubs/' || new.slug;

  elsif old.status = 'paused' and new.status = 'active' then
    v_kind  := 'club-resumed';
    v_stale := 'club-paused';
    v_stale_owner := 'listing-paused';
    v_owner_kind  := 'listing-resumed';
    v_title := new.name || ' is back in the directory';
    v_body  := 'The club has put its listing back. People can find it again.';
    v_owner_title := new.name || ' is back in the directory';
    v_owner_body  := 'People can find your club again, join it and book tables.';
    v_owner_href  := '/clubs/' || new.slug;

  else
    return new;
  end if;

  -- The opposite notice is about something that stopped being true the moment
  -- this one happened. Same reasoning as 0105, and it covers the owner's own
  -- rail as well as the admins'.
  update public.notifications
     set read_at = now()
   where kind in (v_stale, v_stale_owner)
     and entity_type = 'club'
     and entity_id = new.id::text
     and read_at is null;

  for v_admin in
    select id from public.profiles
     where role = 'admin' and coalesce(is_active, true)
       and id is distinct from v_actor
  loop
    perform public.notify_person(
      v_admin.id, v_kind, v_title, v_body,
      '/clubs/' || new.slug,
      'club', new.id::text);
  end loop;

  -- And the club, when the hand on the switch was not theirs. Different words,
  -- because "your club has paused its listing" said to the person who did not
  -- pause it is the product describing them rather than telling them something.
  if new.owner_id is not null and new.owner_id is distinct from v_actor then
    perform public.notify_person(
      new.owner_id, v_owner_kind, v_owner_title, v_owner_body,
      v_owner_href, 'club', new.id::text);
  end if;

  return new;
end;
$$;

revoke all on function public.clubs_status_told() from public, anon, authenticated;

-- ------------------------------------------------------------------ events

alter table public.club_events
  add column if not exists suspended_reason text not null default '',
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users (id) on delete set null,
  add column if not exists suspended_from text;

-- `club_events` IS granted by column list (0090) and `status` is on it, so the
-- new columns have to be kept off it explicitly or a hand-rolled PostgREST
-- call could write its own reason.
revoke update (suspended_reason, suspended_at, suspended_by, suspended_from)
  on public.club_events from authenticated, anon;
revoke insert (suspended_reason, suspended_at, suspended_by, suspended_from)
  on public.club_events from authenticated, anon;

alter table public.club_events drop constraint if exists club_events_status_check;
alter table public.club_events
  add constraint club_events_status_check
  check (status in ('draft', 'published', 'cancelled', 'suspended'));

/**
 * The club cannot reach the suspended state, in either direction.
 *
 * `status` is in the club's own update grant, so the two admin functions below
 * are not the guard: this is. Without it "Put it back on" lifts a sanction in
 * one press, which is the exact thing the client asked to make impossible.
 *
 * Everything else about a suspended event stays editable on purpose. An admin
 * says the description breaks the rules; the club has to be able to fix it
 * before asking for the event back.
 */
create or replace function public.club_events_suspension_is_ours()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or public.is_service_request() then
    return new;
  end if;

  if new.status = 'suspended' and old.status is distinct from 'suspended' then
    raise exception 'EVENT_SUSPEND_NOT_YOURS' using errcode = 'insufficient_privilege';
  end if;

  if old.status = 'suspended' and new.status is distinct from 'suspended' then
    raise exception 'EVENT_SUSPENDED' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke all on function public.club_events_suspension_is_ours()
  from public, anon, authenticated;

drop trigger if exists club_events_suspension_guard on public.club_events;
create trigger club_events_suspension_guard
  before update on public.club_events
  for each row execute function public.club_events_suspension_is_ours();

/**
 * And they cannot delete their way out of it either.
 *
 * `club_events_write` is `for all`, so the policy that lets a club edit an
 * event lets them remove it, and removing one takes the suspension, its reason
 * and everybody's places with it. Guarding the update and leaving the delete
 * open would be a guard with a door beside it.
 */
create or replace function public.club_events_suspended_stay()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'suspended'
     and not (public.is_admin() or public.is_service_request()) then
    raise exception 'EVENT_SUSPENDED' using errcode = 'insufficient_privilege';
  end if;
  return old;
end;
$$;

revoke all on function public.club_events_suspended_stay()
  from public, anon, authenticated;

-- Named to sort before `club_events_delete_guard`, because Postgres fires
-- BEFORE triggers in name order and that one refuses a delete with the words
-- "1 person holds a ticket". True, and not the reason: a club told that would
-- go and cancel the ticket to get past it.
drop trigger if exists club_events_suspended_stay on public.club_events;
drop trigger if exists club_events_admin_hold on public.club_events;
create trigger club_events_admin_hold
  before delete on public.club_events
  for each row execute function public.club_events_suspended_stay();

/**
 * Who hears, and why there are four kinds for two events.
 *
 * `notify_person` de-duplicates on (profile, kind, entity_type, entity_id)
 * while a notice is unread, so a suspension and the restore that follows it
 * cannot share a kind: the second would rewrite the first in place and the
 * count would never move. Fifth time, after 0104, 0112, 0126 and 0155.
 *
 * Holders and the club get different words because they are asking different
 * questions. A holder wants to know whether they still have a place; the club
 * wants to know what we said about them.
 */
create or replace function public.event_suspension_told(
  p_event bigint, p_down boolean, p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    record;
  v_actor  uuid := (select auth.uid());
  v_person record;
begin
  select e.id, e.title, e.legacy_id, e.club_id,
         c.slug as club_slug, c.name as club_name, c.owner_id
    into v_row
    from public.club_events e
    join public.clubs c on c.id = e.club_id
   where e.id = p_event;

  if v_row.id is null then
    return;
  end if;

  update public.notifications
     set read_at = now()
   where kind in (case when p_down then 'event-restored' else 'event-suspended' end,
                  case when p_down then 'event-put-back' else 'event-taken-down' end)
     and entity_type = 'event'
     and entity_id = p_event::text
     and read_at is null;

  -- The people with a place. Theirs is still held either way, which is the one
  -- thing they need told: 0096 settled that places taken back do not come
  -- back, so a suspension that cancelled them would be irreversible where the
  -- suspension itself is not.
  for v_person in
    select distinct b.profile_id
      from public.club_event_bookings b
     where b.event_id = p_event
       and b.status = 'reserved'
       and b.profile_id is not null
  loop
    perform public.notify_person(
      v_person.profile_id,
      case when p_down then 'event-suspended' else 'event-restored' end,
      case when p_down
           then v_row.title || ' is off the site for now'
           else v_row.title || ' is back on the site' end,
      case when p_down
           then 'An admin has taken the event listing down while they look at it. '
                || 'Your place is still held and nothing has been cancelled.'
           else 'The listing is back and your place is unchanged.' end,
      '/clubs/' || v_row.club_slug || '/events/' || v_row.legacy_id,
      'event', p_event::text);
  end loop;

  if v_row.owner_id is not null and v_row.owner_id is distinct from v_actor then
    perform public.notify_person(
      v_row.owner_id,
      case when p_down then 'event-taken-down' else 'event-put-back' end,
      case when p_down
           then v_row.title || ' has been taken down'
           else v_row.title || ' is back on the site' end,
      case when p_down
           then coalesce(nullif(btrim(p_reason), ''),
                         'An admin has taken this event listing down.')
                || ' Anybody who booked keeps their place. Only an admin can put it back.'
           else 'An admin has put the event listing back where it was.' end,
      '/clubs/' || v_row.club_slug || '/manage/events/' || p_event::text,
      'event', p_event::text);
  end if;

  for v_person in
    select id as profile_id from public.profiles
     where role = 'admin' and coalesce(is_active, true)
       and id is distinct from v_actor
  loop
    perform public.notify_person(
      v_person.profile_id,
      case when p_down then 'event-taken-down' else 'event-put-back' end,
      case when p_down
           then v_row.title || ' has been taken down'
           else v_row.title || ' is back on the site' end,
      v_row.club_name,
      '/clubs/' || v_row.club_slug || '/events/' || v_row.legacy_id,
      'event', p_event::text);
  end loop;
end;
$$;

revoke all on function public.event_suspension_told(bigint, boolean, text)
  from public, anon, authenticated;

create or replace function public.admin_suspend_event(p_event bigint, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if v_reason = '' then
    raise exception 'REASON_REQUIRED' using errcode = 'check_violation';
  end if;

  select status into v_status from public.club_events where id = p_event for update;

  if v_status is null then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_status = 'suspended' then
    raise exception 'EVENT_ALREADY_DOWN' using errcode = 'check_violation';
  end if;

  update public.club_events
     set status = 'suspended',
         suspended_reason = left(v_reason, 1000),
         suspended_at = now(),
         suspended_by = (select auth.uid()),
         suspended_from = v_status
   where id = p_event;

  perform public.event_suspension_told(p_event, true, v_reason);
  return 'suspended';
end;
$$;

/**
 * Back to where it was, which for a draft is a draft.
 *
 * Restoring everything to 'published' would publish an event the club had not
 * finished writing, which is a different and worse mistake than the one being
 * undone.
 */
create or replace function public.admin_restore_event(p_event bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_back   text;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select status, suspended_from into v_status, v_back
    from public.club_events where id = p_event for update;

  if v_status is null then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_status <> 'suspended' then
    raise exception 'EVENT_NOT_DOWN' using errcode = 'check_violation';
  end if;

  if coalesce(v_back, '') not in ('draft', 'published', 'cancelled') then
    v_back := 'draft';
  end if;

  update public.club_events
     set status = v_back,
         suspended_reason = '', suspended_at = null,
         suspended_by = null, suspended_from = null
   where id = p_event;

  perform public.event_suspension_told(p_event, false, '');
  return v_back;
end;
$$;

create or replace function public.event_suspension(p_event bigint)
returns table (reason text, suspended_at timestamptz, by_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select e.suspended_reason, e.suspended_at, coalesce(p.full_name, '')
    from public.club_events e
    join public.clubs c on c.id = e.club_id
    left join public.profiles p on p.id = e.suspended_by
   where e.id = p_event
     and e.status = 'suspended'
     and (public.is_admin() or c.owner_id = (select auth.uid())
          or public.club_can(e.club_id, 'events.manage'));
end;
$$;

revoke all on function public.admin_suspend_event(bigint, text) from public, anon;
revoke all on function public.admin_restore_event(bigint) from public, anon;
revoke all on function public.event_suspension(bigint) from public, anon;
grant execute on function public.admin_suspend_event(bigint, text) to authenticated;
grant execute on function public.admin_restore_event(bigint) to authenticated;
grant execute on function public.event_suspension(bigint) to authenticated;

-- 0097's guard, with the fourth state on it. Without this a stale tab could
-- still check out against an event we had taken down.
create or replace function public.club_event_bookings_event_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select e.status into v_status
    from public.club_events e where e.id = new.event_id;

  if v_status = 'cancelled' then
    raise exception 'EVENT_CANCELLED' using errcode = 'check_violation';
  end if;

  if v_status = 'suspended' then
    raise exception 'EVENT_SUSPENDED' using errcode = 'check_violation';
  end if;

  if v_status = 'draft' then
    raise exception 'EVENT_NOT_ON_SALE' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.club_event_bookings_event_open()
  from public, anon, authenticated;

-- --------------------------------------------------- the newest club first
--
-- `admin_clubs` ended `order by m.name` with no way to ask for anything else,
-- and the filter bar above it offered one sort option, which is a control that
-- cannot do anything. The client asked for newest first.
--
-- `coalesce(legacy_created_at, created_at)` rather than `created_at`: every
-- club that came across from legacy was inserted on the same afternoon, so
-- `created_at` alone puts all eleven of them above a club that listed
-- yesterday and calls them the newest clubs on the site. 0020 already indexes
-- `legacy_created_at` for the same reason.
--
-- A new parameter in the middle of the list, so the four-argument version is
-- dropped first: Postgres keeps both otherwise and a caller that forgets to
-- pass the sort picks up the old one and quietly orders by name. Sixth time,
-- after 0136, 0165, 0171, 0186 and 0187.

create index if not exists clubs_started_idx
  on public.clubs ((coalesce(legacy_created_at, created_at)) desc);

drop function if exists public.admin_clubs(text, text, integer, integer);

create or replace function public.admin_clubs(
  p_query text default '', p_status text default '', p_sort text default 'name',
  p_limit integer default 25, p_offset integer default 0
) returns table (
  id bigint, slug text, name text, city text, status text,
  claimable boolean, spotlight boolean, owner_name text,
  members bigint, started timestamptz, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_like text := '%' || btrim(coalesce(p_query, '')) || '%';
  v_sort text := case when coalesce(p_sort, '') = 'newest' then 'newest' else 'name' end;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with matching as (
    select c.*
      from public.clubs c
     where (btrim(coalesce(p_query, '')) = ''
            or c.name ilike v_like or c.city ilike v_like or c.slug ilike v_like)
       and (btrim(coalesce(p_status, '')) = '' or c.status = p_status)
  ),
  counted as (select count(*) as n from matching)
  select m.id, m.slug::text, m.name, m.city, m.status,
         coalesce(m.claimable, false), coalesce(m.spotlight, false),
         coalesce(p.full_name, '') as owner_name,
         (select count(*) from public.club_memberships cm
           where cm.club_id = m.id and cm.status = 'approved') as members,
         coalesce(m.legacy_created_at, m.created_at) as started,
         counted.n
    from matching m
    left join public.profiles p on p.id = m.owner_id
    cross join counted
   -- The id breaks the tie in the direction the sort runs. Eleven clubs
   -- imported in one statement share a timestamp, and "newest first" handing
   -- back the oldest of them is the bug 0130 already paid for once.
   order by case when v_sort = 'newest'
                 then coalesce(m.legacy_created_at, m.created_at) end desc,
            case when v_sort = 'newest' then m.id end desc,
            case when v_sort = 'name' then m.name end asc
   limit greatest(coalesce(p_limit, 25), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

revoke all on function public.admin_clubs(text, text, text, integer, integer)
  from public, anon;
grant execute on function public.admin_clubs(text, text, text, integer, integer)
  to authenticated;
