-- 0220 · what the club wrote down when the money came in
--
-- The client, item u: "coaching payments - please also allow owner to leave a
-- note against the payment when recording payment. This should show on front
-- end for both club owner and member."
--
-- A club takes coaching money in cash on the night, by bank transfer a week
-- early, or half now and half later, and `payment_status` is one word with no
-- room for any of that. The club remembers for a fortnight and then cannot
-- answer the member who asks.
--
-- Two halves, and the second is why this is a migration rather than a column.
--
-- 1. `payment_note`, written beside the payment and read by both sides.
--
-- 2. `record_coaching_payment`, because the note cannot be grantable. The
--    update policy `club_coaching_bookings_change` (0020) admits the member
--    for THEIR OWN ROW, so a column granted to `authenticated` is a column the
--    member can write, and a member writing "paid in full" against their own
--    place is the one thing this must not allow. The note is therefore
--    writable only through a definer function that asks `club_can`, and the
--    same function moves `payment_status` so that the two cannot be set apart.
--
-- UN-MARKING CLEARS THE NOTE. It is a note about a payment, so leaving it on a
-- booking that is no longer paid leaves the member reading "£30 cash, thanks"
-- under TO PAY. Nothing is lost quietly: the club is the only one who can
-- un-mark, and the screen says the note goes with it.
--
-- A NULL NOTE LEAVES WHAT IS THERE. Two screens mark somebody paid: the
-- bookings list, which has the note field, and the quick tick-off on a session
-- card, which is for working down a room on a club night and has no room for
-- one. The second passes null and keeps whatever the first wrote, so a tick on
-- the card cannot silently empty it.
--
-- `payment_status` stays grantable, because 0020 granted it and taking it away
-- is a separate decision from adding this: the app's only writer is the one
-- below. Worth saying out loud so the next reader does not assume the hole is
-- closed everywhere.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-coaching-payment-note.sql.

begin;

alter table public.club_coaching_bookings
  add column if not exists payment_note text not null default '';

-- Deliberately NOT granted. `add column` does not trigger Supabase's
-- whole-table default privileges the way `create table` does, and the only
-- writer is the definer function below.
revoke update (payment_note) on public.club_coaching_bookings from authenticated, anon;

/**
 * The club records a coaching payment, and what it wants to remember about it.
 *
 * Definer and guarded, for the reason in the header. A helper counts: 0069
 * opts them into the capabilities a club chooses, and `coaching.manage` is
 * what every other coaching write on this screen already asks for.
 *
 * The before-update trigger (0158) still stamps `paid_at` and clears it on the
 * way back, so this writes the two columns it owns and nothing else.
 */
create or replace function public.record_coaching_payment(
  p_booking bigint, p_paid boolean, p_note text default null
) returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_club bigint;
  v_live boolean;
begin
  select s.club_id, b.status <> 'cancelled'
    into v_club, v_live
    from public.club_coaching_bookings b
    join public.club_coaching_slots s on s.id = b.slot_id
   where b.id = p_booking;

  if v_club is null then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if not (public.club_can(v_club, 'coaching.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- A place that was called off has no payment to record. The screens do not
  -- offer it; this is what stops a stale tab.
  if not v_live then
    raise exception 'BOOKING_CANCELLED' using errcode = 'check_violation';
  end if;

  -- Null means "I am not the screen that knows about notes". The session
  -- card's quick tick-off on a club night has no note field and must not wipe
  -- what the bookings list wrote; passing the empty string is a club clearing
  -- it on purpose. Un-marking clears it either way, because the note is about
  -- a payment that is no longer recorded.
  update public.club_coaching_bookings
     set payment_status = case when p_paid then 'paid' else 'unpaid' end,
         payment_note = case when not p_paid then ''
                             when p_note is null then payment_note
                             else left(btrim(p_note), 300) end
   where id = p_booking;
end;
$$;

revoke all on function public.record_coaching_payment(bigint, boolean, text) from public, anon;
grant execute on function public.record_coaching_payment(bigint, boolean, text) to authenticated;

-- ------------------------------------------- and both lists carry it back --
--
-- `create or replace` cannot change a `returns table` signature, so both drop
-- first and both restate their grants. Copied from 0178, their latest
-- definition, with one column added in two places each.

drop function if exists public.club_coaching_bookings_list(bigint);

create function public.club_coaching_bookings_list(p_club bigint)
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
  payment_note   text,
  base_price     numeric(10,2),
  price_currency text,
  tier_label     text,
  tier_percent   smallint,
  tier_amount    numeric(10,2),
  loyalty_points_spent integer,
  points_amount  numeric(10,2),
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
         b.payment_note,
         b.base_price, b.price_currency,
         b.membership_tier_label, b.tier_discount_percent, b.tier_discount_amount,
         b.loyalty_points_spent, b.loyalty_discount_amount, b.total_price,
         b.booked_at
    from public.club_coaching_bookings b
    join public.club_coaching_slots s on s.id = b.slot_id
    left join public.profiles p on p.id = b.profile_id
   where s.club_id = p_club
   order by s.slot_date desc, s.start_time desc, b.id;
end;
$$;

revoke all on function public.club_coaching_bookings_list(bigint) from public, anon;
grant execute on function public.club_coaching_bookings_list(bigint) to authenticated;

drop function if exists public.my_coaching_bookings();

create function public.my_coaching_bookings()
returns table (
  booking_id      bigint,
  slot_id         bigint,
  title           text,
  description     text,
  slot_date       date,
  start_time      text,
  end_time        text,
  price           text,
  coaching_type   text,
  capacity        integer,
  club_slug       citext,
  club_name       text,
  club_logo_url   text,
  club_logo_path  text,
  status          text,
  payment_status  text,
  refund_status   text,
  cancel_reason   text,
  payment_note    text,
  base_price      numeric(10,2),
  price_currency  text,
  tier_label      text,
  tier_percent    smallint,
  tier_amount     numeric(10,2),
  points_spent    integer,
  points_amount   numeric(10,2),
  total_price     numeric(10,2),
  booked_at       timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select b.id, s.id, s.title, coalesce(s.description, ''),
         s.slot_date, s.start_time, s.end_time, s.price,
         s.coaching_type, s.capacity,
         c.slug, c.name, c.logo_url, c.logo_path,
         b.status, b.payment_status, b.refund_status, b.cancel_reason,
         b.payment_note,
         b.base_price, b.price_currency,
         b.membership_tier_label, b.tier_discount_percent, b.tier_discount_amount,
         b.loyalty_points_spent, b.loyalty_discount_amount, b.total_price,
         b.booked_at
    from public.club_coaching_bookings b
    join public.club_coaching_slots s on s.id = b.slot_id
    join public.clubs c on c.id = s.club_id
   where b.profile_id = auth.uid()
   order by b.booked_at desc
$$;

revoke all on function public.my_coaching_bookings() from public, anon;
grant execute on function public.my_coaching_bookings() to authenticated;

commit;
