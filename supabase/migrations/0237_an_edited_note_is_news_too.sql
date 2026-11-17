-- 0237 · an edited note is news too, and an order can say how the money went
--
-- Two of the client's new issues, and the first is mine.
--
--   17  "when a booking has been marked as refunded and a note added, if you
--        go back and edit that note, the updated note is not shown on the
--        front end. Please ensure this works across all booking types."
--
--        0233's triggers compare the STATUS and nothing else. Editing the
--        note leaves the status where it was, so no line is written, and the
--        log goes on showing the words that were there before. The row itself
--        updated the whole time; what everybody reads did not.
--
--        It is the same fault 0229 found on a column list — a trigger that
--        watches less than it reports on — and the fix is the same: watch the
--        whole fact. A payment is a status, a method and what the club wrote,
--        and a change to any of the three is a change to the payment.
--
--   18  "for a merchandise order, when club owner marks as refund due or
--        refunded, they can add a note. However, this note is not shown to
--        the club member on their order page."
--
--        An order is the one section with no refund note of its own. 0230
--        said so out loud and called the asymmetry honest; it is not honest
--        any more now that every other section has one and a club typing a
--        refund note into an order has nowhere for it to go that the member
--        can read. The free-text log beside it stays the club's own, which is
--        what it has been since 0020.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-an-edited-note-is-news-too.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. An order can say how the money went back
-- ---------------------------------------------------------------------------

alter table public.club_merchandise_orders
  add column if not exists refunded_at   timestamptz,
  add column if not exists refund_method text not null default '',
  add column if not exists refund_note   text not null default '';

comment on column public.club_merchandise_orders.refund_note is
  'Why the money went back, in the club''s words. The MEMBER reads this, '
  'unlike club_merchandise_order_notes, which is the club''s working log.';

-- Not granted. `club_set_order_refund` is the way in, so the date cannot be
-- claimed by a form and a member cannot write themselves a refund.
revoke update on public.club_merchandise_orders from anon, authenticated;
grant update (status) on public.club_merchandise_orders to authenticated;

/**
 * The stamp, the shape every other section already has.
 *
 * Moving the status off a refund clears the date, the method and the note
 * with it, because they describe a refund that is no longer recorded. That is
 * 0224's rule and the one its suite breaks on.
 */
create or replace function public.club_merchandise_orders_refund_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'refunded' and old.status is distinct from 'refunded' then
    new.refunded_at := coalesce(new.refunded_at, now());
  end if;

  if new.status not in ('refunded', 'refund_due')
     and old.status in ('refunded', 'refund_due') then
    new.refunded_at   := null;
    new.refund_method := '';
    new.refund_note   := '';
  end if;

  return new;
end;
$$;

drop trigger if exists club_merchandise_orders_refund on public.club_merchandise_orders;
create trigger club_merchandise_orders_refund
  before update on public.club_merchandise_orders
  for each row
  execute function public.club_merchandise_orders_refund_stamp();

/** What the club presses. The only way to write the method and the note. */
create or replace function public.club_set_order_refund(
  p_order bigint, p_status text, p_method text default '', p_note text default ''
) returns table (
  order_id bigint, status text, refund_method text,
  refund_note text, refunded_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_club bigint;
  v_was text;
begin
  if p_status not in ('refund_due', 'refunded') then
    raise exception 'REFUND_STATUS_UNKNOWN' using errcode = 'check_violation';
  end if;

  select o.club_id, o.status into v_club, v_was
    from public.club_merchandise_orders o where o.id = p_order;

  if v_club is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if not (public.can_manage_club(v_club) or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- Nothing was taken, so there is nothing to give back. An order still
  -- sitting at `placed` was never paid for, which is the same guard 0229 put
  -- on a table booking.
  if v_was = 'placed' then
    raise exception 'ORDER_NOT_PAID' using errcode = 'check_violation';
  end if;

  return query
  update public.club_merchandise_orders o
     set status        = p_status,
         refund_method = btrim(coalesce(p_method, '')),
         refund_note   = left(btrim(coalesce(p_note, '')), 300)
   where o.id = p_order
  returning o.id, o.status, o.refund_method, o.refund_note, o.refunded_at;
end;
$$;

revoke all on function public.club_set_order_refund(bigint, text, text, text)
  from public, anon;
grant execute on function public.club_set_order_refund(bigint, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. A payment is a status, a method and what the club wrote
-- ---------------------------------------------------------------------------
--
-- Every one of these compared `status is distinct from status` and nothing
-- else, so editing a note wrote no line and the screens went on showing the
-- words that were there before. They compare the whole fact now.
--
-- The refund half carries one extra condition: a note typed against a row
-- that owes nothing back must not write a refund line. Without it, clearing a
-- method on a `not_due` row would log "No refund due" at a club that never
-- discussed a refund.

/** A table booking, a side at a time. */
create or replace function public.club_bookings_money_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opponent uuid := coalesce(new.accepted_by, new.opponent_profile_id);
begin
  if (new.payment_status, new.payment_method, new.payment_note)
     is distinct from (old.payment_status, old.payment_method, old.payment_note) then
    perform public.log_money_event(
      new.club_id, 'booking', new.id, 'booker', new.booked_by,
      'payment', new.payment_status, new.payment_method, new.payment_note,
      coalesce(new.paid_at, now()), true);
  end if;

  if (new.refund_status, new.refund_method, new.refund_note)
     is distinct from (old.refund_status, old.refund_method, old.refund_note)
     and (new.refund_status <> 'not_due'
          or new.refund_status is distinct from old.refund_status) then
    perform public.log_money_event(
      new.club_id, 'booking', new.id, 'booker', new.booked_by,
      'refund', new.refund_status, new.refund_method, new.refund_note,
      coalesce(new.refunded_at, now()), true);
  end if;

  if (new.opponent_payment_status, new.opponent_payment_method, new.opponent_payment_note)
     is distinct from (old.opponent_payment_status, old.opponent_payment_method,
                       old.opponent_payment_note) then
    perform public.log_money_event(
      new.club_id, 'booking', new.id, 'opponent', v_opponent,
      'payment', new.opponent_payment_status, new.opponent_payment_method,
      new.opponent_payment_note, coalesce(new.opponent_paid_at, now()), true);
  end if;

  if (new.opponent_refund_status, new.opponent_refund_method, new.opponent_refund_note)
     is distinct from (old.opponent_refund_status, old.opponent_refund_method,
                       old.opponent_refund_note)
     and (new.opponent_refund_status <> 'not_due'
          or new.opponent_refund_status is distinct from old.opponent_refund_status) then
    perform public.log_money_event(
      new.club_id, 'booking', new.id, 'opponent', v_opponent,
      'refund', new.opponent_refund_status, new.opponent_refund_method,
      new.opponent_refund_note, coalesce(new.opponent_refunded_at, now()), true);
  end if;

  return null;
end;
$$;

/** A coaching place. No payment method column here; the note is the half. */
create or replace function public.club_coaching_money_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club bigint;
begin
  select s.club_id into v_club
    from public.club_coaching_slots s where s.id = new.slot_id;

  if (new.payment_status, new.payment_note)
     is distinct from (old.payment_status, old.payment_note) then
    perform public.log_money_event(
      v_club, 'coaching', new.id, '', new.profile_id,
      'payment', new.payment_status, '', new.payment_note,
      coalesce(new.paid_at, now()), true);
  end if;

  if (new.refund_status, new.refund_method, new.refund_note)
     is distinct from (old.refund_status, old.refund_method, old.refund_note)
     and (new.refund_status <> 'not_due'
          or new.refund_status is distinct from old.refund_status) then
    perform public.log_money_event(
      v_club, 'coaching', new.id, '', new.profile_id,
      'refund', new.refund_status, new.refund_method, new.refund_note,
      coalesce(new.refunded_at, now()), true);
  end if;

  return null;
end;
$$;

/** An event place. */
create or replace function public.club_event_bookings_money_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.payment_status, new.payment_method, new.payment_note)
     is distinct from (old.payment_status, old.payment_method, old.payment_note) then
    perform public.log_money_event(
      new.club_id, 'event', new.id, '', new.profile_id,
      'payment', new.payment_status, new.payment_method, new.payment_note,
      coalesce(new.paid_at, now()), true);
  end if;

  if (new.refund_status, new.refund_method, new.refund_note)
     is distinct from (old.refund_status, old.refund_method, old.refund_note)
     and (new.refund_status <> 'not_due'
          or new.refund_status is distinct from old.refund_status) then
    perform public.log_money_event(
      new.club_id, 'event', new.id, '', new.profile_id,
      'refund', new.refund_status, new.refund_method, new.refund_note,
      coalesce(new.refunded_at, now()), true);
  end if;

  return null;
end;
$$;

/** A shop order, which now has a method and a note of its own to carry. */
create or replace function public.club_merchandise_orders_money_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status, new.refund_method, new.refund_note)
     is not distinct from (old.status, old.refund_method, old.refund_note) then
    return null;
  end if;

  perform public.log_money_event(
    new.club_id, 'order', new.id, '', new.profile_id,
    case when new.status = 'paid' then 'payment'
         when new.status in ('refunded', 'refund_due') then 'refund'
         else 'status' end,
    new.status,
    case when new.status in ('refunded', 'refund_due') then new.refund_method else '' end,
    case when new.status in ('refunded', 'refund_due') then new.refund_note else '' end,
    coalesce(new.refunded_at, now()), true);

  return null;
end;
$$;

/** A renewal. */
create or replace function public.club_membership_payments_money_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_money_event(
      new.club_id, 'membership', new.id, '', new.profile_id,
      'payment', 'recorded', '', coalesce(new.note, ''),
      new.created_at, true);
    return null;
  end if;

  if (new.refund_status, new.refund_method, new.refund_note)
     is distinct from (old.refund_status, old.refund_method, old.refund_note)
     and (new.refund_status <> 'not_due'
          or new.refund_status is distinct from old.refund_status) then
    perform public.log_money_event(
      new.club_id, 'membership', new.id, '', new.profile_id,
      'refund', new.refund_status, new.refund_method, new.refund_note,
      coalesce(new.refunded_at, now()), true);
  end if;

  if new.edited_at is distinct from old.edited_at then
    perform public.log_money_event(
      new.club_id, 'membership', new.id, '', new.profile_id,
      'status', 'corrected', '', coalesce(new.note, ''),
      coalesce(new.edited_at, now()), true);
  end if;

  return null;
end;
$$;

/** A listing payment. */
create or replace function public.listing_payments_money_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club bigint;
  v_owner uuid;
begin
  select coalesce(new.club_id, s.club_id), s.owner_id into v_club, v_owner
    from public.listing_subscriptions s where s.id = new.subscription_id;

  if tg_op = 'INSERT' then
    perform public.log_money_event(
      v_club, 'listing', new.id, '', v_owner,
      'payment', coalesce(new.kind, 'payment'), new.method, coalesce(new.note, ''),
      coalesce(new.paid_at, now()), true);
    return null;
  end if;

  if (new.refund_status, new.refund_method, new.refund_note)
     is distinct from (old.refund_status, old.refund_method, old.refund_note)
     and (new.refund_status <> 'not_due'
          or new.refund_status is distinct from old.refund_status) then
    perform public.log_money_event(
      v_club, 'listing', new.id, '', v_owner,
      'refund', new.refund_status, new.refund_method, new.refund_note,
      coalesce(new.refunded_at, now()), true);
  end if;

  if new.edited_at is distinct from old.edited_at then
    perform public.log_money_event(
      v_club, 'listing', new.id, '', v_owner,
      'status', 'corrected', '', coalesce(new.note, ''),
      coalesce(new.edited_at, now()), true);
  end if;

  return null;
end;
$$;

commit;
