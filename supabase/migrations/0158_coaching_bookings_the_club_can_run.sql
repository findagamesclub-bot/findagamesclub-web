/**
 * The club's side of a coaching booking.
 *
 * The client's words: "Coaching Events and bookings made for a coaching event
 * cannot be edited. Bookings cannot be cancelled or set to refunded by owner."
 *
 * Three of those four are app gaps rather than database ones, and it is worth
 * saying which is which. A manager has been able to UPDATE a slot and a
 * booking since 0020 (`club_coaching_slots_manage`,
 * `club_coaching_bookings_change`), and `status` has been grantable the whole
 * time. **Nothing on any screen called it.** So editing a slot and cancelling
 * somebody's place need no migration at all.
 *
 * What is genuinely missing from the database is the refund. Coaching has
 * `payment_status` and no `refund_status`, so a club that cancels a place
 * somebody paid for has nowhere to write down that they owe them money. Event
 * bookings have had exactly that since 0092 and this is the same three states,
 * in the same words, because a refund is a refund.
 *
 * And the member has to be told. 0095 tells a ticket holder when the club
 * changes their booking and coaching has only ever had a confirmation, so a
 * club could cancel somebody's session and the first they would know is the
 * night it did not happen. Same trigger shape, same rule: nobody is told about
 * their own doing.
 *
 * Checked on a throwaway Postgres built from every migration with
 * supabase/tests/stage12-coaching-club-side.sql.
 */

alter table public.club_coaching_bookings
  add column if not exists refund_status text not null default 'not_due',
  add column if not exists cancel_reason text not null default '';

do $$
begin
  alter table public.club_coaching_bookings
    add constraint club_coaching_bookings_refund_status_check
    check (refund_status in ('not_due', 'due', 'refunded'));
exception when duplicate_object then null;
end $$;

-- The two the club writes. Everything about the money a booking was priced at
-- stays the trigger's (0157), and a member still cannot name either of these:
-- `club_coaching_bookings_change` admits them only for their own row, and the
-- app never offers it.
grant update (refund_status, cancel_reason) on public.club_coaching_bookings
  to authenticated;

/**
 * The stamp, extended rather than replaced.
 *
 * 0020 already set `cancelled_at`, `cancelled_by` and `paid_at` here. The new
 * half is the one 0092 added for a ticket: somebody who paid and then lost
 * their place is owed something, and this is the flag that stops it being
 * forgotten. Points are not part of it — 0157 gives those back by itself, and
 * a refund status is about money the club actually took.
 */
create or replace function public.club_coaching_bookings_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancelled_by := coalesce(new.cancelled_by, (select auth.uid()));

    if new.payment_status <> 'unpaid' and new.refund_status = 'not_due' then
      new.refund_status := 'due';
    end if;
  end if;

  if new.payment_status = 'paid' and old.payment_status <> 'paid' then
    new.paid_at := coalesce(new.paid_at, now());
  end if;

  -- Un-marking a payment takes the date with it, or a booking reads as paid on
  -- a day nobody paid.
  if new.payment_status = 'unpaid' and old.payment_status <> 'unpaid' then
    new.paid_at := null;
  end if;

  return new;
end;
$$;

/**
 * What the club did to somebody's booking.
 *
 * 0095 for the other half of the club. Two things are worth telling a member
 * about: their place being cancelled by somebody other than them, and a refund
 * being settled. Nobody is told about their own doing, which is what
 * `auth.uid() = new.profile_id` is for: a member giving up their own place
 * does not need a notice saying so.
 */
create or replace function public.club_coaching_bookings_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club  record;
  v_title text;
  v_href  text;
begin
  -- Their own doing needs no telling.
  if (select auth.uid()) = new.profile_id then
    return new;
  end if;

  select c.name, c.slug, s.title
    into v_club
    from public.club_coaching_slots s
    join public.clubs c on c.id = s.club_id
   where s.id = new.slot_id;

  if v_club is null then
    return new;
  end if;

  v_title := coalesce(v_club.title, 'a coaching session');
  v_href  := '/clubs/' || v_club.slug || '/coaching';

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    perform public.notify_person(
      new.profile_id,
      'coaching-cancelled-by-club',
      'Your coaching place has been cancelled',
      coalesce(nullif(btrim(new.cancel_reason), ''),
               coalesce(v_club.name, 'The club')
                 || ' has cancelled your place on ' || v_title || '.'),
      v_href, 'coaching_booking', new.id::text);
  end if;

  if new.refund_status is distinct from old.refund_status
     and new.refund_status = 'refunded' then
    perform public.notify_person(
      new.profile_id,
      'coaching-refunded',
      'Your coaching refund is settled',
      coalesce(v_club.name, 'The club') || ' has marked your refund for '
        || v_title || ' as sorted.',
      v_href, 'coaching_booking', new.id::text);
  end if;

  return new;
end;
$$;

revoke all on function public.club_coaching_bookings_notify() from public, anon, authenticated;

drop trigger if exists club_coaching_bookings_notified on public.club_coaching_bookings;
create trigger club_coaching_bookings_notified
  after update on public.club_coaching_bookings
  for each row execute function public.club_coaching_bookings_notify();

-- ------------------------------------------------------------- the club's list

/**
 * Every coaching booking at a club, including the cancelled ones.
 *
 * A function rather than a wider select, for the reason `club_event_door_list`
 * is one: the club's list answers a different question from the session cards.
 * The cards show who is coming, so they read booked rows only; the list answers
 * "who still owes me, and who am I out of pocket to", and a cancelled booking
 * that was paid for is the most important row on it. Filtering those out of the
 * card read and then asking the browser to show them was never going to work.
 *
 * It also keeps the money out of the cards. 0157 put seven columns on a
 * booking and a member looking at a session card has no business reading what
 * the club charged somebody else.
 *
 * Guarded, and `perform`ed rather than selected, because a `stable` guard whose
 * result nothing reads is one the planner may drop: 0117 shipped that and a
 * stranger read a club's takings.
 */
create or replace function public.club_coaching_bookings_list(p_club bigint)
returns table (
  booking_id   bigint,
  slot_id      bigint,
  slot_title   text,
  slot_date    date,
  start_time   text,
  profile_id   uuid,
  member_name  text,
  status       text,
  payment_status text,
  refund_status  text,
  cancel_reason  text,
  base_price     numeric(10,2),
  loyalty_points_spent integer,
  total_price    numeric(10,2),
  booked_at      timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not (public.club_can(p_club, 'coaching.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select b.id, s.id, s.title, s.slot_date, s.start_time,
         b.profile_id,
         coalesce(nullif(btrim(p.full_name), ''), 'A member'),
         b.status, b.payment_status, b.refund_status, b.cancel_reason,
         b.base_price, b.loyalty_points_spent, b.total_price, b.booked_at
    from public.club_coaching_bookings b
    join public.club_coaching_slots s on s.id = b.slot_id
    left join public.profiles p on p.id = b.profile_id
   where s.club_id = p_club
   order by s.slot_date desc, s.start_time desc, b.id;
end;
$$;

revoke all on function public.club_coaching_bookings_list(bigint) from public, anon;
grant execute on function public.club_coaching_bookings_list(bigint) to authenticated;
