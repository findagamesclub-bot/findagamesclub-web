-- 0233 · one way of writing money down, everywhere
--
-- The client, item 16: "when any payments or refunds are recorded across any
-- part of the site (table bookings, coaching, events, shop, membership
-- renewals), we should store the date of the original payment, and the date of
-- the refund. This should be shown on the front end for both owner and member.
-- I like how we do it for the shop orders, as this stores the history of each
-- update and the date and notes. Please can we change all others to work like
-- the shop payment recording and refunds work? This would then make the
-- recording of payment and refunds consistent across the site, as it's
-- different for each section currently."
--
-- They are right that it is different for each section, and the reason is that
-- each section was built in its own stage against its own screen. Six ways of
-- saying "this was paid":
--
--   a TABLE BOOKING   payment_status + paid_at per side (0205, 0221), refund
--                     columns per side (0229)
--   a COACHING PLACE  payment_status + paid_at (0020), refund_status and
--                     nothing else — no date, no method, no note (0158)
--   an EVENT PLACE    payment_status + paid_at + method + note (0092), refund
--                     the same shape (0224)
--   a SHOP ORDER      one status, and an append-only log of every move with
--                     the date, the author and a note (0020)
--   a RENEWAL         an insert-only ledger row, correctable since 0195, with
--                     no notion of a refund at all
--   a LISTING         an insert-only ledger row that nothing may correct
--
-- Five of those can answer "is it paid" and only one can answer "what has
-- happened to this money". That last one is the shop, which is the one the
-- client likes, and it is the shape the other five get here.
--
-- `club_money_events` is that log, for all six. One append-only row per thing
-- that happened, written by triggers rather than by the writers, because the
-- payment on a table booking moves from the bookings list, from the session
-- card, from the member's own cancellation and from an admin, and a log that
-- fires on one path is worse than none. Same reasoning as 0095's booking
-- notices and 0141's result sync.
--
-- The shop moves onto it rather than keeping its own. Two implementations of
-- one history match on the day they are written and drift the first time
-- either is touched, which is rule 11 in CLAUDE.md, and the whole point of the
-- client's ask is that there should be one.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-one-way-of-writing-money-down.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. The log
-- ---------------------------------------------------------------------------

create table if not exists public.club_money_events (
  id          bigint generated always as identity primary key,
  -- Nullable, because a listing subscription can belong to a submission that
  -- has no club yet. Every other scope always has one.
  club_id     bigint references public.clubs (id) on delete cascade,
  scope       text   not null,
  entity_id   bigint not null,
  -- A table booking is paid for a side at a time since 0221. Everything else
  -- is one payment and leaves this empty.
  side        text   not null default '',
  -- Whose money it is. This is what lets a member read their own history
  -- without the reader needing to know which table the row came from.
  profile_id  uuid   references public.profiles (id) on delete set null,
  kind        text   not null,
  -- The word that section uses, in that section's own vocabulary. The screen
  -- turns it into English; storing English here would mean translating it
  -- twice the first time a label changes.
  state       text   not null default '',
  method      text   not null default '',
  note        text   not null default '',
  -- When the money moved, which is not always when the row was written: a
  -- club marking Saturday's table paid on Monday means Saturday.
  happened_at timestamptz not null default now(),
  author_id   uuid   references public.profiles (id) on delete set null,
  automatic   boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint club_money_events_scope_check
    check (scope in ('booking', 'coaching', 'event', 'order', 'membership', 'listing')),
  constraint club_money_events_kind_check
    check (kind in ('payment', 'refund', 'status', 'note')),
  constraint club_money_events_side_check
    check (side in ('', 'booker', 'opponent')),
  constraint club_money_events_note_len
    check (char_length(note) <= 2000)
);

create index if not exists club_money_events_entity_idx
  on public.club_money_events (scope, entity_id, happened_at, id);

create index if not exists club_money_events_club_idx
  on public.club_money_events (club_id, happened_at desc);

comment on table public.club_money_events is
  'Every payment, refund, status move and note about money, for all six '
  'sections. Append-only: written by triggers and by add_money_note, read '
  'through club_money_history. Nothing may update or delete a row.';

alter table public.club_money_events enable row level security;

-- Supabase hands out a whole-table grant on every new table. The reads go
-- through a definer function and the writes through triggers, so nothing here
-- is for `authenticated` at all.
revoke insert, update, delete on public.club_money_events from anon, authenticated;
revoke select on public.club_money_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Writing one
-- ---------------------------------------------------------------------------

/**
 * The one insert, so every trigger below writes the same shape.
 *
 * `author_id` is auth.uid() and never an argument: a log that could be told
 * who wrote a line is a log that can be made to say somebody else did it.
 * `automatic` separates "the club typed this" from "this happened", which is
 * the distinction the shop's own log has always drawn and the one the screen
 * renders differently.
 */
create or replace function public.log_money_event(
  p_club bigint, p_scope text, p_entity bigint, p_side text,
  p_profile uuid, p_kind text, p_state text, p_method text, p_note text,
  p_at timestamptz, p_automatic boolean
) returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.club_money_events (
    club_id, scope, entity_id, side, profile_id, kind, state, method, note,
    happened_at, author_id, automatic)
  values (
    p_club, p_scope, p_entity, coalesce(p_side, ''), p_profile, p_kind,
    coalesce(p_state, ''), coalesce(p_method, ''),
    left(coalesce(p_note, ''), 2000),
    coalesce(p_at, now()), auth.uid(), coalesce(p_automatic, true));
$$;

revoke all on function public.log_money_event(
  bigint, text, bigint, text, uuid, text, text, text, text, timestamptz, boolean)
  from public, anon, authenticated;

/**
 * A note somebody typed, on anything.
 *
 * The shop has had this since 0020 and nothing else did, so a club that gave
 * a refund in two halves could record the second one nowhere. One function for
 * all six, guarded the same way the reader is.
 */
create or replace function public.add_money_note(
  p_scope text, p_entity bigint, p_side text default '', p_note text default ''
) returns bigint
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_club bigint;
  v_profile uuid;
  v_id bigint;
begin
  if btrim(coalesce(p_note, '')) = '' then
    raise exception 'NOTE_EMPTY' using errcode = 'check_violation';
  end if;

  select club_id, profile_id into v_club, v_profile
    from public.money_entity_owner(p_scope, p_entity);

  if not found then
    raise exception 'ENTITY_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- The club's team writes notes about its own money; an admin writes them
  -- about a listing, which has no club team. A member reads and does not
  -- write: the log is the club's record of what arrived.
  if not (public.is_admin()
          or (v_club is not null and public.can_manage_club(v_club))) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  insert into public.club_money_events (
    club_id, scope, entity_id, side, profile_id, kind, note,
    happened_at, author_id, automatic)
  values (v_club, p_scope, p_entity, coalesce(p_side, ''), v_profile, 'note',
          left(btrim(p_note), 2000), now(), auth.uid(), false)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.add_money_note(text, bigint, text, text)
  from public, anon;
grant execute on function public.add_money_note(text, bigint, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Who a row belongs to, in one place
-- ---------------------------------------------------------------------------

/**
 * The club and the person behind one entity, whatever section it is in.
 *
 * Both the note writer and the reader need this and neither should carry its
 * own copy of six joins. A listing has no club team, so its `profile_id` is
 * the subscription's owner, which is who reads their own billing page.
 */
create or replace function public.money_entity_owner(p_scope text, p_entity bigint)
returns table (club_id bigint, profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select b.club_id, b.booked_by
    from public.club_bookings b
   where p_scope = 'booking' and b.id = p_entity
  union all
  select s.club_id, c.profile_id
    from public.club_coaching_bookings c
    join public.club_coaching_slots s on s.id = c.slot_id
   where p_scope = 'coaching' and c.id = p_entity
  union all
  select e.club_id, e.profile_id
    from public.club_event_bookings e
   where p_scope = 'event' and e.id = p_entity
  union all
  select o.club_id, o.profile_id
    from public.club_merchandise_orders o
   where p_scope = 'order' and o.id = p_entity
  union all
  select m.club_id, m.profile_id
    from public.club_membership_payments m
   where p_scope = 'membership' and m.id = p_entity
  union all
  select coalesce(p.club_id, s.club_id), s.owner_id
    from public.listing_payments p
    join public.listing_subscriptions s on s.id = p.subscription_id
   where p_scope = 'listing' and p.id = p_entity
$$;

revoke all on function public.money_entity_owner(text, bigint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Reading it
-- ---------------------------------------------------------------------------

/**
 * One history, for one or many rows at once.
 *
 * An array rather than a single id because a bookings list is twenty rows and
 * twenty round trips is the thing the Stage 3 timings section is about. The
 * guard is per row rather than per call: a club reads its own, an admin reads
 * everything, and a member reads the money that is theirs, so one call can
 * safely carry ids from a page that mixes them.
 */
create or replace function public.club_money_history(
  p_scope text, p_entities bigint[]
) returns table (
  id bigint, entity_id bigint, side text, kind text, state text,
  method text, note text, happened_at timestamptz, automatic boolean,
  author_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.entity_id, e.side, e.kind, e.state, e.method, e.note,
         e.happened_at, e.automatic,
         coalesce(p.full_name, '')
    from public.club_money_events e
    left join public.profiles p on p.id = e.author_id
   where e.scope = p_scope
     and e.entity_id = any (coalesce(p_entities, array[]::bigint[]))
     and (public.is_admin()
          or (e.club_id is not null and public.can_manage_club(e.club_id))
          -- A member reads the money that is theirs, and only the money. The
          -- club's own typed notes stay the club's: the shop's log has been
          -- described as "the club's own working log, members never see
          -- these" since 0020, and making the whole site consistent must not
          -- quietly open that up. Every automatic line — paid, refunded, the
          -- club's reason for the refund — is about them and goes to them.
          or (e.profile_id is not null and e.profile_id = auth.uid()
              and e.kind <> 'note'))
   order by e.happened_at, e.id
$$;

revoke all on function public.club_money_history(text, bigint[])
  from public, anon;
grant execute on function public.club_money_history(text, bigint[])
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The three sections that could not say when, or how
-- ---------------------------------------------------------------------------

-- A COACHING PLACE had `refund_status` and nothing beside it (0158), so a club
-- could say money was owed back and never say it went. The same three columns
-- an event place and a table booking already carry.
alter table public.club_coaching_bookings
  add column if not exists refunded_at   timestamptz,
  add column if not exists refund_method text not null default '',
  add column if not exists refund_note   text not null default '';

-- Not granted. `club_set_coaching_refund` below is the only way in, for the
-- reason 0229 gives about a table booking: when money went back is a fact
-- about the row, not something a form gets to name.

-- A RENEWAL had no notion of a refund at all. The client, item 17: "in the
-- renewals section when logged in as club owner, you should be able to edit
-- any previous payment history and if required mark as refunded along with a
-- note for the refund." 0195 gave the edit; this is the other half.
alter table public.club_membership_payments
  add column if not exists refund_status text not null default 'not_due',
  add column if not exists refunded_at   timestamptz,
  add column if not exists refund_method text not null default '',
  add column if not exists refund_note   text not null default '';

do $$
begin
  alter table public.club_membership_payments
    add constraint club_membership_payments_refund_status_check
    check (refund_status in ('not_due', 'due', 'refunded'));
exception when duplicate_object then null;
end $$;

-- A LISTING PAYMENT was insert-only for everybody, including an admin, and the
-- screen said so in as many words. The client, item 18: "admin also needs a
-- method to edit a payment that was recorded previously, and record refunds in
-- the billing section."
--
-- It keeps the mark 0195 put on a renewal rather than inventing a second way
-- of saying the same thing, and it keeps the no-delete: a correction leaves a
-- trace, a disappearance does not.
alter table public.listing_payments
  add column if not exists edited_at     timestamptz,
  add column if not exists edited_by     uuid references public.profiles (id) on delete set null,
  add column if not exists refund_status text not null default 'not_due',
  add column if not exists refunded_at   timestamptz,
  add column if not exists refund_method text not null default '',
  add column if not exists refund_note   text not null default '';

do $$
begin
  alter table public.listing_payments
    add constraint listing_payments_refund_status_check
    check (refund_status in ('not_due', 'due', 'refunded'));
exception when duplicate_object then null;
end $$;

-- Said again rather than assumed, the same way 0195 ends. Nothing on this
-- table is writable by hand; the two functions below are the way in, and both
-- are an admin's.
revoke insert, update, delete on public.listing_payments from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. The stamps, extended
-- ---------------------------------------------------------------------------

/**
 * A coaching place, stamped like an event place.
 *
 * 0158's body is kept word for word and the refund half is added after it.
 * Moving the status off `refunded` clears the date, the method and the note
 * with it, which is 0224's rule and the assertion its suite breaks on: a row
 * reading "Refunded by bank transfer" under a status saying the money is still
 * owed is worse than one saying nothing.
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

  if new.refund_status = 'refunded' and old.refund_status <> 'refunded' then
    new.refunded_at := coalesce(new.refunded_at, now());
  end if;

  if new.refund_status <> 'refunded' and old.refund_status = 'refunded' then
    new.refunded_at   := null;
    new.refund_method := '';
    new.refund_note   := '';
  end if;

  return new;
end;
$$;

/**
 * A renewal, corrected or refunded.
 *
 * 0195 stamped every update as a correction, which was right when an update
 * could only be one. A refund is not a correction: the row is still exactly
 * what the club wrote down, and marking it "Corrected 16 Nov" because money
 * went back would say the original entry was wrong. So the mark is only put on
 * when something other than the refund moved.
 */
create or replace function public.club_payment_corrected()
returns trigger
language plpgsql
as $$
declare
  v_refund_only boolean;
begin
  v_refund_only :=
        new.tier_key             is not distinct from old.tier_key
    and new.tier_label           is not distinct from old.tier_label
    and new.billing_option_label is not distinct from old.billing_option_label
    and new.price                is not distinct from old.price
    and new.price_duration       is not distinct from old.price_duration
    and new.period_start_at      is not distinct from old.period_start_at
    and new.period_end_at        is not distinct from old.period_end_at
    and new.note                 is not distinct from old.note;

  if new.refund_status = 'refunded' and old.refund_status <> 'refunded' then
    new.refunded_at := coalesce(new.refunded_at, now());
  end if;

  if new.refund_status <> 'refunded' and old.refund_status = 'refunded' then
    new.refunded_at   := null;
    new.refund_method := '';
    new.refund_note   := '';
  end if;

  if not v_refund_only then
    new.edited_at := now();
    new.edited_by := auth.uid();
  end if;

  return new;
end;
$$;

/** A listing payment, corrected or refunded. Same shape, same reasoning. */
create or replace function public.listing_payment_stamp()
returns trigger
language plpgsql
as $$
declare
  v_refund_only boolean;
begin
  v_refund_only :=
        new.amount_pence is not distinct from old.amount_pence
    and new.currency     is not distinct from old.currency
    and new.method       is not distinct from old.method
    and new.paid_at      is not distinct from old.paid_at
    and new.reference    is not distinct from old.reference
    and new.note         is not distinct from old.note
    and new.period_start is not distinct from old.period_start
    and new.period_end   is not distinct from old.period_end;

  if new.refund_status = 'refunded' and old.refund_status <> 'refunded' then
    new.refunded_at := coalesce(new.refunded_at, now());
  end if;

  if new.refund_status <> 'refunded' and old.refund_status = 'refunded' then
    new.refunded_at   := null;
    new.refund_method := '';
    new.refund_note   := '';
  end if;

  if not v_refund_only then
    new.edited_at := now();
    new.edited_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists listing_payments_stamp on public.listing_payments;

create trigger listing_payments_stamp
  before update on public.listing_payments
  for each row
  execute function public.listing_payment_stamp();

-- ---------------------------------------------------------------------------
-- 7. Six triggers, one log
-- ---------------------------------------------------------------------------
--
-- Every one of these is AFTER, fires on the whole row rather than a column
-- list, and compares inside. A column list on a trigger is a filter and not
-- documentation — 0229 found that out when `club_bookings_payment` was still
-- listed against two columns four migrations after it needed four — and a log
-- that silently stops recording is worse than one that was never written.

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
  if new.payment_status is distinct from old.payment_status then
    perform public.log_money_event(
      new.club_id, 'booking', new.id, 'booker', new.booked_by,
      'payment', new.payment_status, new.payment_method, new.payment_note,
      coalesce(new.paid_at, now()), true);
  end if;

  if new.refund_status is distinct from old.refund_status then
    perform public.log_money_event(
      new.club_id, 'booking', new.id, 'booker', new.booked_by,
      'refund', new.refund_status, new.refund_method, new.refund_note,
      coalesce(new.refunded_at, now()), true);
  end if;

  if new.opponent_payment_status is distinct from old.opponent_payment_status then
    perform public.log_money_event(
      new.club_id, 'booking', new.id, 'opponent', v_opponent,
      'payment', new.opponent_payment_status, new.opponent_payment_method,
      new.opponent_payment_note, coalesce(new.opponent_paid_at, now()), true);
  end if;

  if new.opponent_refund_status is distinct from old.opponent_refund_status then
    perform public.log_money_event(
      new.club_id, 'booking', new.id, 'opponent', v_opponent,
      'refund', new.opponent_refund_status, new.opponent_refund_method,
      new.opponent_refund_note, coalesce(new.opponent_refunded_at, now()), true);
  end if;

  return null;
end;
$$;

drop trigger if exists club_bookings_money on public.club_bookings;
create trigger club_bookings_money
  after update on public.club_bookings
  for each row
  execute function public.club_bookings_money_log();

/** A coaching place. */
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

  if new.payment_status is distinct from old.payment_status then
    perform public.log_money_event(
      v_club, 'coaching', new.id, '', new.profile_id,
      'payment', new.payment_status, '', new.payment_note,
      coalesce(new.paid_at, now()), true);
  end if;

  if new.refund_status is distinct from old.refund_status then
    perform public.log_money_event(
      v_club, 'coaching', new.id, '', new.profile_id,
      'refund', new.refund_status, new.refund_method, new.refund_note,
      coalesce(new.refunded_at, now()), true);
  end if;

  return null;
end;
$$;

drop trigger if exists club_coaching_bookings_money on public.club_coaching_bookings;
create trigger club_coaching_bookings_money
  after update on public.club_coaching_bookings
  for each row
  execute function public.club_coaching_money_log();

/** An event place. */
create or replace function public.club_event_bookings_money_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status is distinct from old.payment_status then
    perform public.log_money_event(
      new.club_id, 'event', new.id, '', new.profile_id,
      'payment', new.payment_status, new.payment_method, new.payment_note,
      coalesce(new.paid_at, now()), true);
  end if;

  if new.refund_status is distinct from old.refund_status then
    perform public.log_money_event(
      new.club_id, 'event', new.id, '', new.profile_id,
      'refund', new.refund_status, new.refund_method, new.refund_note,
      coalesce(new.refunded_at, now()), true);
  end if;

  return null;
end;
$$;

drop trigger if exists club_event_bookings_money on public.club_event_bookings;
create trigger club_event_bookings_money
  after update on public.club_event_bookings
  for each row
  execute function public.club_event_bookings_money_log();

/**
 * A shop order, which is where this shape came from.
 *
 * It replaces `club_merchandise_orders_log_status`, whose rows are backfilled
 * below. The one behavioural difference is that the kind is read off the
 * status rather than every move being one word: "Marked refunded" and "Marked
 * fulfilled" were the same kind of line in the old log, and the client's whole
 * ask is that money reads as money.
 */
create or replace function public.club_merchandise_orders_money_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  perform public.log_money_event(
    new.club_id, 'order', new.id, '', new.profile_id,
    case when new.status = 'paid' then 'payment'
         when new.status in ('refunded', 'refund_due') then 'refund'
         else 'status' end,
    new.status, '', '', now(), true);

  return null;
end;
$$;

drop trigger if exists club_merchandise_orders_status_log on public.club_merchandise_orders;
drop trigger if exists club_merchandise_orders_money on public.club_merchandise_orders;
create trigger club_merchandise_orders_money
  after update on public.club_merchandise_orders
  for each row
  execute function public.club_merchandise_orders_money_log();

/**
 * A renewal.
 *
 * This one logs the insert as well, because unlike the other five the row IS
 * the payment: there is no earlier state for it to move out of, and a ledger
 * whose history began at the first correction would be a history of
 * corrections.
 */
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

  if new.refund_status is distinct from old.refund_status then
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

drop trigger if exists club_membership_payments_money on public.club_membership_payments;
create trigger club_membership_payments_money
  after insert or update on public.club_membership_payments
  for each row
  execute function public.club_membership_payments_money_log();

/** A listing payment. Same shape as a renewal, different owner. */
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

  if new.refund_status is distinct from old.refund_status then
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

drop trigger if exists listing_payments_money on public.listing_payments;
create trigger listing_payments_money
  after insert or update on public.listing_payments
  for each row
  execute function public.listing_payments_money_log();

-- ---------------------------------------------------------------------------
-- 8. Recording a refund where there was no way to
-- ---------------------------------------------------------------------------

/**
 * A coaching place, refunded. The family `club_set_booking_refund` started.
 *
 * `refund_status` is in 0158's column grant and stays there, because the
 * cancel path writes it. This is what a club presses, and it is the only way
 * to write the method and the note beside it.
 */
create or replace function public.club_set_coaching_refund(
  p_booking bigint, p_status text, p_method text default '', p_note text default ''
) returns table (
  booking_id bigint, refund_status text, refund_method text,
  refund_note text, refunded_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_club bigint;
  v_paid text;
begin
  if p_status not in ('not_due', 'due', 'refunded') then
    raise exception 'REFUND_STATUS_UNKNOWN' using errcode = 'check_violation';
  end if;

  select s.club_id, b.payment_status into v_club, v_paid
    from public.club_coaching_bookings b
    join public.club_coaching_slots s on s.id = b.slot_id
   where b.id = p_booking;

  if v_club is null then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if not (public.club_can(v_club, 'coaching.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- Nothing was taken, so there is nothing to give back. 0229's rule, said
  -- again here because a club can reach this screen on an unpaid place.
  if p_status = 'refunded' and v_paid = 'unpaid' then
    raise exception 'BOOKING_NOT_PAID' using errcode = 'check_violation';
  end if;

  return query
  update public.club_coaching_bookings b
     set refund_status = p_status,
         refund_method = btrim(coalesce(p_method, '')),
         refund_note   = left(btrim(coalesce(p_note, '')), 300)
   where b.id = p_booking
  returning b.id, b.refund_status, b.refund_method, b.refund_note, b.refunded_at;
end;
$$;

revoke all on function public.club_set_coaching_refund(bigint, text, text, text)
  from public, anon;
grant execute on function public.club_set_coaching_refund(bigint, text, text, text)
  to authenticated;

/** A renewal, refunded. The club's, because the renewal is the club's money. */
create or replace function public.club_set_membership_payment_refund(
  p_payment bigint, p_status text, p_method text default '', p_note text default ''
) returns table (
  payment_id bigint, refund_status text, refund_method text,
  refund_note text, refunded_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_club bigint;
begin
  if p_status not in ('not_due', 'due', 'refunded') then
    raise exception 'REFUND_STATUS_UNKNOWN' using errcode = 'check_violation';
  end if;

  select m.club_id into v_club
    from public.club_membership_payments m where m.id = p_payment;

  if v_club is null then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if not (public.can_manage_club(v_club) or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  update public.club_membership_payments m
     set refund_status = p_status,
         refund_method = btrim(coalesce(p_method, '')),
         refund_note   = left(btrim(coalesce(p_note, '')), 300)
   where m.id = p_payment
  returning m.id, m.refund_status, m.refund_method, m.refund_note, m.refunded_at;
end;
$$;

revoke all on function public.club_set_membership_payment_refund(bigint, text, text, text)
  from public, anon;
grant execute on function public.club_set_membership_payment_refund(bigint, text, text, text)
  to authenticated;

/**
 * A listing payment, corrected.
 *
 * An admin's, not a club's: the club is the one who paid it and the row is our
 * record of receiving it. Everything the admin typed is correctable and the
 * row's identity is not, which is the line 0195 drew — moving a payment to
 * another subscription is a different payment, not a correction.
 */
create or replace function public.admin_correct_listing_payment(
  p_payment bigint, p_amount_pence integer, p_method text,
  p_paid_at date, p_reference text default '', p_note text default ''
) returns bigint
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_amount_pence, -1) < 0 then
    raise exception 'AMOUNT_INVALID' using errcode = 'check_violation';
  end if;

  update public.listing_payments p
     set amount_pence = p_amount_pence,
         method    = btrim(coalesce(p_method, '')),
         paid_at   = coalesce(p_paid_at, p.paid_at),
         reference = left(btrim(coalesce(p_reference, '')), 120),
         note      = left(btrim(coalesce(p_note, '')), 300)
   where p.id = p_payment
  returning p.id into v_id;

  if v_id is null then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_correct_listing_payment(
  bigint, integer, text, date, text, text) from public, anon;
grant execute on function public.admin_correct_listing_payment(
  bigint, integer, text, date, text, text) to authenticated;

/** A listing payment, refunded. */
create or replace function public.admin_set_listing_payment_refund(
  p_payment bigint, p_status text, p_method text default '', p_note text default ''
) returns table (
  payment_id bigint, refund_status text, refund_method text,
  refund_note text, refunded_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('not_due', 'due', 'refunded') then
    raise exception 'REFUND_STATUS_UNKNOWN' using errcode = 'check_violation';
  end if;

  return query
  update public.listing_payments p
     set refund_status = p_status,
         refund_method = btrim(coalesce(p_method, '')),
         refund_note   = left(btrim(coalesce(p_note, '')), 300)
   where p.id = p_payment
  returning p.id, p.refund_status, p.refund_method, p.refund_note, p.refunded_at;
end;
$$;

revoke all on function public.admin_set_listing_payment_refund(bigint, text, text, text)
  from public, anon;
grant execute on function public.admin_set_listing_payment_refund(bigint, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 9. What already happened
-- ---------------------------------------------------------------------------
--
-- Without this every row already paid for would open on an empty history, and
-- the client's own ask is to see the date of the original payment. The dates
-- are on the rows already; this is them, said in the one place that now reads
-- them. Guarded by `not exists` so a re-run adds nothing.

insert into public.club_money_events (
  club_id, scope, entity_id, side, profile_id, kind, state, method, note,
  happened_at, author_id, automatic, created_at)
-- An automatic line is one of the six moves, written by 0020 as
-- `'Marked ' || new.status`. It comes across as the typed event it always
-- meant rather than as a note reading "Marked refund_due" with the underscore
-- showing. Anything a person typed stays exactly as they typed it.
select o.club_id, 'order', n.order_id, '', o.profile_id,
       case when not n.automatic then 'note'
            when w.status = 'paid' then 'payment'
            when w.status in ('refunded', 'refund_due') then 'refund'
            when w.status is not null then 'status'
            else 'note' end,
       coalesce(w.status, ''), '',
       case when n.automatic and w.status is not null then '' else n.body end,
       n.created_at, n.author_id, n.automatic, n.created_at
  from public.club_merchandise_order_notes n
  join public.club_merchandise_orders o on o.id = n.order_id
  left join lateral (
    select s.status from (
      select substring(n.body from '^Marked ([a-z_]+)$') as status
    ) s
    where s.status in ('placed', 'paid', 'fulfilled', 'cancelled',
                       'refund_due', 'refunded')
  ) w on true
 where not exists (select 1 from public.club_money_events e
                    where e.scope = 'order' and e.entity_id = n.order_id);

insert into public.club_money_events (
  club_id, scope, entity_id, side, profile_id, kind, state, method, note,
  happened_at, automatic, created_at)
select b.club_id, 'booking', b.id, 'booker', b.booked_by, 'payment',
       b.payment_status, b.payment_method, b.payment_note,
       b.paid_at, true, b.paid_at
  from public.club_bookings b
 where b.paid_at is not null
   and not exists (select 1 from public.club_money_events e
                    where e.scope = 'booking' and e.entity_id = b.id
                      and e.side = 'booker' and e.kind = 'payment');

insert into public.club_money_events (
  club_id, scope, entity_id, side, profile_id, kind, state, method, note,
  happened_at, automatic, created_at)
select b.club_id, 'booking', b.id, 'opponent',
       coalesce(b.accepted_by, b.opponent_profile_id), 'payment',
       b.opponent_payment_status, b.opponent_payment_method,
       b.opponent_payment_note, b.opponent_paid_at, true, b.opponent_paid_at
  from public.club_bookings b
 where b.opponent_paid_at is not null
   and not exists (select 1 from public.club_money_events e
                    where e.scope = 'booking' and e.entity_id = b.id
                      and e.side = 'opponent' and e.kind = 'payment');

insert into public.club_money_events (
  club_id, scope, entity_id, side, profile_id, kind, state, method, note,
  happened_at, automatic, created_at)
select b.club_id, 'booking', b.id, 'booker', b.booked_by, 'refund',
       b.refund_status, b.refund_method, b.refund_note,
       -- Never before the money arrived. Where a refund has no date of its
       -- own, `cancelled_at` can predate the payment and the log then reads
       -- backwards; 0235 is this same floor, applied to rows already written.
       greatest(coalesce(b.refunded_at, b.cancelled_at, b.updated_at),
                coalesce(b.paid_at, '-infinity'::timestamptz)), true, now()
  from public.club_bookings b
 where b.refund_status <> 'not_due'
   and not exists (select 1 from public.club_money_events e
                    where e.scope = 'booking' and e.entity_id = b.id
                      and e.side = 'booker' and e.kind = 'refund');

insert into public.club_money_events (
  club_id, scope, entity_id, side, profile_id, kind, state, method, note,
  happened_at, automatic, created_at)
select b.club_id, 'booking', b.id, 'opponent',
       coalesce(b.accepted_by, b.opponent_profile_id), 'refund',
       b.opponent_refund_status, b.opponent_refund_method, b.opponent_refund_note,
       greatest(coalesce(b.opponent_refunded_at, b.cancelled_at, b.updated_at),
                coalesce(b.opponent_paid_at, '-infinity'::timestamptz)), true, now()
  from public.club_bookings b
 where b.opponent_refund_status <> 'not_due'
   and not exists (select 1 from public.club_money_events e
                    where e.scope = 'booking' and e.entity_id = b.id
                      and e.side = 'opponent' and e.kind = 'refund');

insert into public.club_money_events (
  club_id, scope, entity_id, side, profile_id, kind, state, method, note,
  happened_at, automatic, created_at)
select s.club_id, 'coaching', c.id, '', c.profile_id, 'payment',
       c.payment_status, '', coalesce(c.payment_note, ''),
       c.paid_at, true, c.paid_at
  from public.club_coaching_bookings c
  join public.club_coaching_slots s on s.id = c.slot_id
 where c.paid_at is not null
   and not exists (select 1 from public.club_money_events e
                    where e.scope = 'coaching' and e.entity_id = c.id
                      and e.kind = 'payment');

insert into public.club_money_events (
  club_id, scope, entity_id, side, profile_id, kind, state, method, note,
  happened_at, automatic, created_at)
select s.club_id, 'coaching', c.id, '', c.profile_id, 'refund',
       c.refund_status, '', '',
       greatest(coalesce(c.cancelled_at, c.booked_at),
                coalesce(c.paid_at, '-infinity'::timestamptz)), true, now()
  from public.club_coaching_bookings c
  join public.club_coaching_slots s on s.id = c.slot_id
 where c.refund_status <> 'not_due'
   and not exists (select 1 from public.club_money_events e
                    where e.scope = 'coaching' and e.entity_id = c.id
                      and e.kind = 'refund');

insert into public.club_money_events (
  club_id, scope, entity_id, side, profile_id, kind, state, method, note,
  happened_at, automatic, created_at)
select b.club_id, 'event', b.id, '', b.profile_id, 'payment',
       b.payment_status, b.payment_method, b.payment_note,
       b.paid_at, true, b.paid_at
  from public.club_event_bookings b
 where b.paid_at is not null
   and not exists (select 1 from public.club_money_events e
                    where e.scope = 'event' and e.entity_id = b.id
                      and e.kind = 'payment');

insert into public.club_money_events (
  club_id, scope, entity_id, side, profile_id, kind, state, method, note,
  happened_at, automatic, created_at)
select b.club_id, 'event', b.id, '', b.profile_id, 'refund',
       b.refund_status, b.refund_method, b.refund_note,
       greatest(coalesce(b.refunded_at, b.cancelled_at, b.updated_at),
                coalesce(b.paid_at, '-infinity'::timestamptz)), true, now()
  from public.club_event_bookings b
 where b.refund_status <> 'not_due'
   and not exists (select 1 from public.club_money_events e
                    where e.scope = 'event' and e.entity_id = b.id
                      and e.kind = 'refund');

insert into public.club_money_events (
  club_id, scope, entity_id, side, profile_id, kind, state, method, note,
  happened_at, author_id, automatic, created_at)
select m.club_id, 'membership', m.id, '', m.profile_id, 'payment', 'recorded',
       '', coalesce(m.note, ''),
       m.created_at, m.recorded_by, true, m.created_at
  from public.club_membership_payments m
 where not exists (select 1 from public.club_money_events e
                    where e.scope = 'membership' and e.entity_id = m.id
                      and e.kind = 'payment');

insert into public.club_money_events (
  club_id, scope, entity_id, side, profile_id, kind, state, method, note,
  happened_at, author_id, automatic, created_at)
select m.club_id, 'membership', m.id, '', m.profile_id, 'status', 'corrected',
       '', coalesce(m.note, ''),
       m.edited_at, m.edited_by, true, m.edited_at
  from public.club_membership_payments m
 where m.edited_at is not null
   and not exists (select 1 from public.club_money_events e
                    where e.scope = 'membership' and e.entity_id = m.id
                      and e.kind = 'status');

insert into public.club_money_events (
  club_id, scope, entity_id, side, profile_id, kind, state, method, note,
  happened_at, author_id, automatic, created_at)
select coalesce(p.club_id, s.club_id), 'listing', p.id, '', s.owner_id,
       'payment', coalesce(p.kind, 'payment'), p.method, coalesce(p.note, ''),
       p.paid_at, p.recorded_by, true, p.created_at
  from public.listing_payments p
  join public.listing_subscriptions s on s.id = p.subscription_id
 where not exists (select 1 from public.club_money_events e
                    where e.scope = 'listing' and e.entity_id = p.id
                      and e.kind = 'payment');

-- ---------------------------------------------------------------------------
-- 10. And the coaching list carries the new columns back
-- ---------------------------------------------------------------------------
--
-- A club that can record how a refund went back and cannot see it on the list
-- has recorded it into a drawer. `create or replace` cannot change a
-- `returns table` signature, so this drops first and restates its grants,
-- which is the dance 0178 and 0220 already did to this same function. Built
-- from 0220's text rather than retyped.

drop function if exists public.club_coaching_bookings_list(bigint);

create function public.club_coaching_bookings_list(p_club bigint)
returns table (
  booking_id bigint, slot_id bigint, slot_title text, slot_date date,
  start_time text, profile_id uuid, member_name text, status text,
  payment_status text, refund_status text, cancel_reason text,
  payment_note text, base_price numeric, price_currency text,
  tier_label text, tier_percent smallint, tier_amount numeric,
  loyalty_points_spent integer, points_amount numeric, total_price numeric,
  booked_at timestamptz,
  paid_at timestamptz, refunded_at timestamptz,
  refund_method text, refund_note text
)
language plpgsql
stable
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
         b.payment_note,
         b.base_price, b.price_currency,
         b.membership_tier_label, b.tier_discount_percent, b.tier_discount_amount,
         b.loyalty_points_spent, b.loyalty_discount_amount, b.total_price,
         b.booked_at,
         b.paid_at, b.refunded_at, b.refund_method, b.refund_note
    from public.club_coaching_bookings b
    join public.club_coaching_slots s on s.id = b.slot_id
    left join public.profiles p on p.id = b.profile_id
   where s.club_id = p_club
   order by s.slot_date desc, s.start_time desc, b.id;
end;
$$;

revoke all on function public.club_coaching_bookings_list(bigint) from public, anon;
grant execute on function public.club_coaching_bookings_list(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. And the billing screen can read what it just gained
-- ---------------------------------------------------------------------------

/**
 * The five columns this migration added to `listing_payments`.
 *
 * Through a function rather than a wider select, for the reason 0224 gives
 * about an event booking: `src/types/database.ts` is generated from the live
 * schema and has never carried them, and `npm run check:columns` is right to
 * refuse a select naming a column the schema it knows does not have.
 *
 * `security invoker`, so the row's own policies decide. An admin reads
 * everything; the club whose listing it is reads its own, which is what makes
 * the owner's billing page able to show a refund it was given.
 */
create or replace function public.listing_payment_extras(p_payments bigint[])
returns table (
  payment_id bigint, edited_at timestamptz, refund_status text,
  refunded_at timestamptz, refund_method text, refund_note text
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.edited_at, p.refund_status, p.refunded_at,
         p.refund_method, p.refund_note
    from public.listing_payments p
   where p.id = any (coalesce(p_payments, array[]::bigint[]))
$$;

revoke all on function public.listing_payment_extras(bigint[]) from public, anon;
grant execute on function public.listing_payment_extras(bigint[]) to authenticated;

commit;
