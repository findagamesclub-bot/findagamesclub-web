-- 0229 · money going back, on a table and on an order
--
-- The client, item 15: "we need the ability to also mark table booking
-- payments as refunded and also merchandise orders as refunded status."
--
-- Two different shapes, because the two things are shaped differently and
-- forcing one model on both would be worse than either.
--
--   A MERCHANDISE ORDER has one status that is already its payment state:
--      placed, paid, fulfilled, cancelled. "Refunded" is a fifth state of
--      that one thing, which is what the client's own words say.
--
--   A TABLE BOOKING has a payment per SIDE since 0221, and a refund is a
--      second fact about that payment rather than a replacement for it: a
--      club needs to know it was paid in cash on the night AND handed back by
--      transfer a week later. So it mirrors an event booking (0092, 0224):
--      its own status, its own date, its own method and note, per side.
--
-- Folding the refund into `payment_status` was the tempting shortcut and it
-- loses how the money came in, which is the half an accounts record is for.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-money-going-back.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. A merchandise order can be refunded
-- ---------------------------------------------------------------------------

alter table public.club_merchandise_orders
  drop constraint if exists club_merchandise_orders_status_check;
alter table public.club_merchandise_orders
  add constraint club_merchandise_orders_status_check
  check (status in ('placed', 'paid', 'fulfilled', 'cancelled', 'refunded'));

-- ---------------------------------------------------------------------------
-- 2. A table booking can be refunded, a side at a time
-- ---------------------------------------------------------------------------

alter table public.club_bookings
  add column if not exists refund_status  text not null default 'not_due',
  add column if not exists refunded_at    timestamptz,
  add column if not exists refund_method  text not null default '',
  add column if not exists refund_note    text not null default '',
  add column if not exists opponent_refund_status text not null default 'not_due',
  add column if not exists opponent_refunded_at   timestamptz,
  add column if not exists opponent_refund_method text not null default '',
  add column if not exists opponent_refund_note   text not null default '';

alter table public.club_bookings
  drop constraint if exists club_bookings_refund_status_check;
alter table public.club_bookings
  add constraint club_bookings_refund_status_check
  check (refund_status in ('not_due', 'due', 'refunded')
         and opponent_refund_status in ('not_due', 'due', 'refunded'));

-- The columns are NOT granted to `authenticated`. 0221 already revoked the
-- whole-table write on this table and grants a named list, so a column added
-- here is unreachable until something names it. The setter below is the only
-- way in, and the suite asserts a member cannot write these directly.

comment on column public.club_bookings.refund_status is
  'not_due, due or refunded, for the booker''s half. Set through '
  'club_set_booking_refund; the date, method and note follow it.';

/**
 * The stamp, extended.
 *
 * `paid_at` has been written by this trigger since 0221 and the refund date
 * joins it, for the reason 0224 gives about an event booking: when money went
 * back is a fact about the row, not something a form should be able to name.
 *
 * Taking a refund back clears the date, the method and the note with it. A row
 * reading "Refunded by bank transfer" under a status saying the money is still
 * owed is worse than one saying nothing, and that is the assertion 0224's own
 * suite breaks on.
 *
 * A cancelled table that somebody paid for leaves a refund DUE rather than
 * silently nothing, which is 0092's rule for an event place. The club is the
 * one holding money it no longer has a table for, and a queue that does not
 * say so is a queue that loses it.
 */
create or replace function public.club_bookings_payment_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.payment_status is distinct from old.payment_status then
    new.paid_at := case when new.payment_status = 'unpaid' then null
                        else coalesce(new.paid_at, now()) end;
  end if;
  if new.opponent_payment_status is distinct from old.opponent_payment_status then
    new.opponent_paid_at := case when new.opponent_payment_status = 'unpaid' then null
                                 else coalesce(new.opponent_paid_at, now()) end;
  end if;

  if new.refund_status is distinct from old.refund_status then
    if new.refund_status = 'refunded' then
      new.refunded_at := coalesce(new.refunded_at, now());
    else
      new.refunded_at   := null;
      new.refund_method := '';
      new.refund_note   := '';
    end if;
  end if;
  if new.opponent_refund_status is distinct from old.opponent_refund_status then
    if new.opponent_refund_status = 'refunded' then
      new.opponent_refunded_at := coalesce(new.opponent_refunded_at, now());
    else
      new.opponent_refunded_at   := null;
      new.opponent_refund_method := '';
      new.opponent_refund_note   := '';
    end if;
  end if;

  -- Called off with money on it: the club owes it back.
  if new.status is distinct from old.status and new.status <> 'booked' then
    if new.payment_status <> 'unpaid' and new.refund_status = 'not_due' then
      new.refund_status := 'due';
    end if;
    if new.opponent_payment_status <> 'unpaid'
       and new.opponent_refund_status = 'not_due' then
      new.opponent_refund_status := 'due';
    end if;
  end if;

  return new;
end;
$$;

-- The trigger only fired `of payment_status, opponent_payment_status`, so a
-- refund-only update never reached it and the date was never stamped. A
-- column list on a BEFORE UPDATE trigger is a filter, not documentation: the
-- new columns have to be named or the function above is dead code. `status`
-- joins them for the called-off rule.
--
-- Found by the suite on its first run, which is the argument for writing it.
drop trigger if exists club_bookings_payment on public.club_bookings;
create trigger club_bookings_payment
  before update of payment_status, opponent_payment_status,
                   refund_status, opponent_refund_status, status
  on public.club_bookings
  for each row execute function public.club_bookings_payment_stamp();

/**
 * The club records a refund on one half of a table.
 *
 * Its own function rather than another argument on `club_set_booking_payment`,
 * because the two answer different questions and 0221 already learned what
 * happens when a side argument lands in the middle of an existing signature:
 * every older four-argument call went on resolving and read the status as the
 * side. A separate name cannot do that.
 *
 * A cancelled table IS allowed here, which is the one place this parts company
 * with the payment setter. Refunding is precisely what a club does after
 * calling a table off, so refusing it on a cancelled row would refuse the
 * normal case.
 */
create or replace function public.club_set_booking_refund(
  p_booking bigint,
  p_side    text,
  p_status  text,
  p_method  text default '',
  p_note    text default ''
) returns table (
  booking_id              bigint,
  refund_status           text,
  refund_method           text,
  refund_note             text,
  refunded_at             timestamptz,
  opponent_refund_status  text,
  opponent_refund_method  text,
  opponent_refund_note    text,
  opponent_refunded_at    timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_club bigint;
  v_row  public.club_bookings%rowtype;
begin
  if p_side not in ('booker', 'opponent') then
    raise exception 'BOOKING_SIDE_UNKNOWN' using errcode = 'check_violation';
  end if;
  if p_status not in ('not_due', 'due', 'refunded') then
    raise exception 'REFUND_STATUS_UNKNOWN' using errcode = 'check_violation';
  end if;

  select * into v_row from public.club_bookings b where b.id = p_booking;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  v_club := v_row.club_id;

  if not (public.club_can(v_club, 'bookings.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if p_side = 'opponent'
     and coalesce(v_row.opponent_profile_id, v_row.accepted_by) is null
     and btrim(coalesce(v_row.opponent_name, '')) = '' then
    raise exception 'BOOKING_NO_OPPONENT' using errcode = 'check_violation';
  end if;

  -- Nothing was taken, so there is nothing to give back. Without this a club
  -- could record a refund against a half nobody ever paid, and the takings
  -- would read as money leaving that never arrived.
  if p_status = 'refunded'
     and ((p_side = 'booker'   and v_row.payment_status = 'unpaid')
       or (p_side = 'opponent' and v_row.opponent_payment_status = 'unpaid')) then
    raise exception 'BOOKING_NOT_PAID' using errcode = 'check_violation';
  end if;

  return query
  update public.club_bookings b
     set refund_status = case when p_side = 'booker' then p_status
                              else b.refund_status end,
         refund_method = case when p_side = 'booker' then btrim(coalesce(p_method, ''))
                              else b.refund_method end,
         refund_note   = case when p_side = 'booker' then left(btrim(coalesce(p_note, '')), 300)
                              else b.refund_note end,
         opponent_refund_status = case when p_side = 'opponent' then p_status
                                       else b.opponent_refund_status end,
         opponent_refund_method = case when p_side = 'opponent' then btrim(coalesce(p_method, ''))
                                       else b.opponent_refund_method end,
         opponent_refund_note   = case when p_side = 'opponent'
                                       then left(btrim(coalesce(p_note, '')), 300)
                                       else b.opponent_refund_note end
   where b.id = p_booking
  returning b.id, b.refund_status, b.refund_method, b.refund_note, b.refunded_at,
            b.opponent_refund_status, b.opponent_refund_method,
            b.opponent_refund_note, b.opponent_refunded_at;
end;
$$;

revoke all on function public.club_set_booking_refund(bigint, text, text, text, text)
  from public, anon;
grant execute on function public.club_set_booking_refund(bigint, text, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. And both lists carry it, or the club cannot see what it recorded
-- ---------------------------------------------------------------------------

drop function if exists public.club_booking_sides(bigint);
CREATE OR REPLACE FUNCTION public.club_booking_sides(p_club bigint)
 RETURNS TABLE(booking_id bigint, side text, person_id uuid, person_name text, against_name text, session_date date, session_label text, session_time text, table_index smallint, game_title text, status text, payment_status text, payment_method text, payment_note text, paid_at timestamp with time zone, base_price numeric, tier_label text, tier_percent smallint, tier_amount numeric, points_spent integer, points_amount numeric, total_price numeric, currency text, booked_at timestamp with time zone, refund_status text, refunded_at timestamp with time zone, refund_method text, refund_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.id, 'booker', b.booked_by,
         coalesce(nullif(btrim(p.full_name), ''), 'A member'),
         coalesce(nullif(btrim(o.full_name), ''), nullif(btrim(a.full_name), ''),
                  nullif(btrim(b.opponent_name), ''), ''),
         b.session_date, b.session_label, b.session_time, b.table_index,
         b.game_title, b.status,
         b.payment_status, b.payment_method, b.payment_note, b.paid_at,
         b.base_price, b.membership_tier_label, b.tier_discount_percent,
         b.tier_discount_amount, b.loyalty_points_spent, b.loyalty_discount_amount,
         b.total_price, b.price_currency, b.created_at,
         b.refund_status, b.refunded_at, b.refund_method, b.refund_note
    from public.club_bookings b
    left join public.profiles p on p.id = b.booked_by
    left join public.profiles o on o.id = b.opponent_profile_id
    left join public.profiles a on a.id = b.accepted_by
   where b.club_id = p_club

  union all

  -- A guest has no account and still owes their half, so the name falls back
  -- through the two member seats to whatever was typed.
  select b.id, 'opponent', coalesce(b.opponent_profile_id, b.accepted_by),
         coalesce(nullif(btrim(o.full_name), ''), nullif(btrim(a.full_name), ''),
                  nullif(btrim(b.opponent_name), ''), 'A guest'),
         coalesce(nullif(btrim(p.full_name), ''), 'A member'),
         b.session_date, b.session_label, b.session_time, b.table_index,
         b.game_title, b.status,
         b.opponent_payment_status, b.opponent_payment_method,
         b.opponent_payment_note, b.opponent_paid_at,
         b.opponent_base_price, b.opponent_tier_label, b.opponent_tier_discount_percent,
         b.opponent_tier_discount_amount,
         -- Points are the booker's and are spent against the booker's half.
         0, 0::numeric(10,2),
         b.opponent_total_price, b.price_currency, b.created_at,
         b.opponent_refund_status, b.opponent_refunded_at,
         b.opponent_refund_method, b.opponent_refund_note
    from public.club_bookings b
    left join public.profiles p on p.id = b.booked_by
    left join public.profiles o on o.id = b.opponent_profile_id
    left join public.profiles a on a.id = b.accepted_by
   where b.club_id = p_club
     and (coalesce(b.opponent_profile_id, b.accepted_by) is not null
          or btrim(coalesce(b.opponent_name, '')) <> '')
     -- The seat was charged a share. See the header: a booking from before
     -- 0221 has none, and carrying a row that can never be collected is the
     -- thing this migration takes off the list.
     and b.opponent_base_price > 0
$function$;

revoke all on function public.club_booking_sides(bigint)
  from public, anon, authenticated;

drop function if exists
  public.club_table_bookings(bigint, text, text, text, date, text, integer, integer);
CREATE OR REPLACE FUNCTION public.club_table_bookings(p_club bigint, p_tab text DEFAULT 'all'::text, p_query text DEFAULT ''::text, p_month text DEFAULT ''::text, p_night date DEFAULT NULL::date, p_sort text DEFAULT 'newest'::text, p_page integer DEFAULT 1, p_per integer DEFAULT 25)
 RETURNS TABLE(booking_id bigint, side text, person_id uuid, person_name text, against_name text, session_date date, session_label text, session_time text, table_index smallint, game_title text, status text, payment_status text, payment_method text, payment_note text, paid_at timestamp with time zone, base_price numeric, tier_label text, tier_percent smallint, tier_amount numeric, points_spent integer, points_amount numeric, total_price numeric, currency text, booked_at timestamp with time zone, refund_status text, refunded_at timestamp with time zone, refund_method text, refund_note text, total_rows bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_needle text := nullif(btrim(coalesce(p_query, '')), '');
  v_month  text := nullif(btrim(coalesce(p_month, '')), '');
  v_from   integer := greatest(0, (greatest(1, coalesce(p_page, 1)) - 1) * greatest(1, coalesce(p_per, 25)));
begin
  if not (public.club_can(p_club, 'bookings.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with rows as (
    select * from public.club_booking_sides(p_club) s
     where (v_month is null or to_char(s.session_date, 'YYYY-MM') = v_month)
       -- One club night, which is what a club actually works down. Since
       -- 0221 a table is two rows, so a month at a busy club is twice the
       -- list it used to be and the month alone stopped being enough.
       and (p_night is null or s.session_date = p_night)
       and (p_tab is null or p_tab = 'all'
            or (p_tab = 'cancelled' and s.status <> 'booked')
            or (p_tab = 'paid'  and s.status = 'booked' and s.payment_status <> 'unpaid')
            or (p_tab = 'free'   and s.status = 'booked' and s.total_price <= 0)
            or (p_tab = 'topay'  and s.status = 'booked' and s.payment_status = 'unpaid'
                                 and s.total_price > 0))
       and (v_needle is null
            or s.person_name ilike '%' || v_needle || '%'
            or s.against_name ilike '%' || v_needle || '%'
            or s.game_title ilike '%' || v_needle || '%'
            or s.payment_note ilike '%' || v_needle || '%')
  )
  select r.booking_id, r.side, r.person_id, r.person_name, r.against_name,
         r.session_date, r.session_label, r.session_time, r.table_index,
         r.game_title, r.status,
         r.payment_status, r.payment_method, r.payment_note, r.paid_at,
         r.base_price, r.tier_label, r.tier_percent, r.tier_amount,
         r.points_spent, r.points_amount, r.total_price, r.currency, r.booked_at,
         r.refund_status, r.refunded_at, r.refund_method, r.refund_note,
         count(*) over () as total_rows
    from rows r
   order by
     -- The id breaks every tie in the direction the sort runs. Three tables on
     -- one night share a date, and 0130 paid for a tie-break pointing the
     -- other way: "oldest first" handing back the newest of them. The side
     -- goes on the end so the two halves of one table never swap places.
     case when p_sort = 'oldest' then r.session_date end asc,
     case when p_sort = 'oldest' then r.table_index end asc,
     case when p_sort = 'name'   then lower(r.person_name) end asc,
     case when p_sort = 'value'  then r.total_price end desc,
     case when p_sort not in ('oldest', 'name', 'value') then r.session_date end desc,
     case when p_sort = 'oldest' then r.booking_id end asc,
     r.booking_id desc, r.side asc
   offset v_from limit greatest(1, coalesce(p_per, 25));
end;
$function$;

revoke all on function
  public.club_table_bookings(bigint, text, text, text, date, text, integer, integer)
  from public, anon;
grant execute on function
  public.club_table_bookings(bigint, text, text, text, date, text, integer, integer)
  to authenticated;

commit;
