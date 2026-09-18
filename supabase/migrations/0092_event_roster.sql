-- 0092 · The door list
--
-- A booking has been readable by the club since Stage 5 and writable only by
-- the person who made it. Running an event needs the other half: marking who
-- has paid, who has turned up, and cancelling somebody's place when they ring
-- to say they cannot make it.
--
-- Money is a label here and not a transaction. Nothing in this app takes
-- payment, so `payment_status` and `refund_status` are what the club has
-- written down about what happened in the room.

alter table public.club_event_bookings
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_method text not null default '',
  add column if not exists payment_note text not null default '',
  add column if not exists paid_at timestamptz,
  add column if not exists checked_in_at timestamptz,
  add column if not exists refund_status text not null default 'not_due',
  add column if not exists cancel_reason text not null default '';

do $$
begin
  alter table public.club_event_bookings
    add constraint club_event_bookings_payment_status_check
    check (payment_status in ('unpaid', 'paid_on_the_door', 'paid_in_advance'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.club_event_bookings
    add constraint club_event_bookings_refund_status_check
    check (refund_status in ('not_due', 'due', 'refunded'));
exception when duplicate_object then null;
end $$;

create index if not exists club_event_bookings_door_idx
  on public.club_event_bookings (event_id, status, created_at desc);

-- ------------------------------------------------------------------ writes

/**
 * The club's side of a booking.
 *
 * Separate from the member's own update policy rather than widening it: the
 * member may only cancel their own, and the columns each side may write are
 * different. Two policies are OR'd, so the member keeps exactly what they had.
 */
drop policy if exists club_event_bookings_club_update on public.club_event_bookings;
create policy club_event_bookings_club_update on public.club_event_bookings
  for update to authenticated
  using (public.club_can(club_id, 'events.manage'))
  with check (public.club_can(club_id, 'events.manage'));

grant update (status, payment_status, payment_method, payment_note, paid_at,
              checked_in_at, refund_status, cancel_reason, cancelled_at, cancelled_by,
              full_name, email, notes)
  on public.club_event_bookings to authenticated;

/**
 * Paid and checked in carry their own timestamps.
 *
 * Stamped here rather than sent from the browser, because "when did they pay"
 * is a fact about the row and not something a form should be able to name.
 */
create or replace function public.club_event_bookings_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.payment_status is distinct from old.payment_status then
    new.paid_at := case when new.payment_status = 'unpaid' then null
                        else coalesce(new.paid_at, now()) end;
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    -- Somebody who paid and then lost their place is owed something. The club
    -- settles it by hand; this is the flag that stops it being forgotten.
    if new.payment_status <> 'unpaid' and new.refund_status = 'not_due' then
      new.refund_status := 'due';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists club_event_bookings_stamped on public.club_event_bookings;
create trigger club_event_bookings_stamped
  before update on public.club_event_bookings
  for each row execute function public.club_event_bookings_stamp();

-- ------------------------------------------------------- calling one off

/**
 * Cancelling an event tells everybody holding a ticket.
 *
 * A notice each, through the same helper every other notification uses, so it
 * lands on the bell and in the notifications page without a second system. The
 * email is the service's job: a mail failure must never undo the cancellation.
 */
create or replace function public.club_events_cancel_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  holder record;
  club   record;
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' then
    return new;
  end if;

  select slug, name into club from public.clubs where id = new.club_id;

  for holder in
    select distinct b.profile_id
      from public.club_event_bookings b
     where b.event_id = new.id
       and b.status <> 'cancelled'
       and b.profile_id is not null
  loop
    perform public.notify_person(
      holder.profile_id,
      'event-cancelled',
      new.title || ' has been called off',
      coalesce(nullif(btrim(new.cancel_reason), ''), 'The club has cancelled this event.'),
      '/clubs/' || club.slug || '/events/' || new.legacy_id,
      'event',
      new.id::text,
      club.name
    );
  end loop;

  -- Their place goes with it, and anybody who had paid is owed a refund.
  update public.club_event_bookings
     set status = 'cancelled',
         cancel_reason = case when btrim(cancel_reason) = ''
                              then 'The event was called off' else cancel_reason end
   where event_id = new.id and status <> 'cancelled';

  return new;
end;
$$;

drop trigger if exists club_events_cancelled on public.club_events;
create trigger club_events_cancelled
  after update of status on public.club_events
  for each row execute function public.club_events_cancel_notify();

-- ---------------------------------------------------------------- the door

/**
 * Everybody with a place, for the club running the door.
 *
 * A function rather than a view so the capability is checked once, here,
 * rather than trusted from whatever query the page happens to write.
 */
-- Dropped first: a `create or replace` cannot change a function's return type,
-- and this one is re-run whenever the door list gains a column.
drop function if exists public.club_event_door_list(bigint);

create function public.club_event_door_list(p_event bigint)
returns table (
  booking_id bigint,
  profile_id uuid,
  full_name text,
  email text,
  reference text,
  status text,
  payment_status text,
  payment_method text,
  checked_in_at timestamptz,
  refund_status text,
  cancel_reason text,
  notes text,
  tickets integer,
  total numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_club bigint;
begin
  select club_id into owner_club from public.club_events where id = p_event;
  if owner_club is null then
    return;
  end if;
  if not public.club_can(owner_club, 'events.manage') then
    raise exception 'NOT_PERMITTED';
  end if;

  return query
    select b.id, b.profile_id, b.full_name, b.email, b.reference, b.status,
           b.payment_status, b.payment_method, b.checked_in_at, b.refund_status,
           b.cancel_reason, b.notes,
           coalesce((select sum(i.quantity)::integer from public.club_event_booking_items i
                      where i.booking_id = b.id), 0),
           b.total,
           b.created_at
      from public.club_event_bookings b
     where b.event_id = p_event
     order by b.created_at;
end;
$$;

revoke all on function public.club_event_door_list(bigint) from public, anon;
grant execute on function public.club_event_door_list(bigint) to authenticated;

do $$
declare bad boolean;
begin
  select bool_or(column_name is null) into bad from (
    select null::text as column_name from information_schema.role_table_grants
     where table_name = 'club_event_bookings' and grantee = 'authenticated'
       and privilege_type in ('INSERT', 'UPDATE')
    union all
    select column_name from information_schema.role_column_grants
     where table_name = 'club_event_bookings' and grantee = 'authenticated'
       and privilege_type in ('INSERT', 'UPDATE')
  ) g;
  if bad then
    raise exception 'club_event_bookings carries a whole-table grant';
  end if;
end $$;
