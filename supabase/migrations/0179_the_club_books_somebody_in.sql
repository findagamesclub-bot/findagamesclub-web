-- 0179 · the club puts somebody on the list.
--
-- The client: "club owner cannot book event tickets for themselves or for
-- another member. Can we add an option for them to book their own ticket, or
-- add a ticket booking in the Who is coming section?"
--
-- Booking their own place needed no migration: the event page gave the club
-- the sales board INSTEAD of the ticket desk, and it gets both now. This is
-- the other half, which does, because `checkout_event_cart` prices off the
-- cart of `auth.uid()` and a club booking for somebody else is neither.
--
-- Three decisions are baked in here rather than left to a caller:
--
--  1. THE PRICE IS THE NAMED PERSON'S, NOT THE CLUB'S. A member who gets 5%
--     off event tickets gets it whether they book themselves or hand over a
--     twenty at the door, because the alternative charges them more for not
--     using the website. It also keeps one number true in two places: their
--     own ticket stub reads the same figures the club's door list does.
--
--  2. NO POINTS ARE SPENT. Every other path lets somebody choose to put their
--     loyalty points towards a bill. The club cannot make that choice for
--     them: points are the member's to spend and nobody at a door is in a
--     position to consent. The tier discount is a standing arrangement and
--     applies; the points are not, and do not. Points are still EARNED, by
--     0050's trigger on the booking row, so being booked in by the club is
--     not a worse deal than booking yourself.
--
--  3. A WALK-IN IS A NULL PROFILE, not an invented account. 0016's guard
--     already judges "the person the booking is in the name of" rather than
--     the caller, and already refuses a null profile anything that is not
--     open to all. So a club can put a name on an open ticket and cannot
--     sneak somebody into a members-only one.
--
-- Nothing else is re-implemented. Capacity (0015), eligibility (0016) and
-- "this event was called off" (0097) are all triggers on the rows this
-- inserts, so they hold for this path without being written out a second
-- time. A guard restated is a guard that drifts.

create or replace function public.club_add_event_booking(
  p_event       bigint,
  p_profile     uuid,
  p_name        text,
  p_email       text,
  p_reference   text,
  p_ticket_type bigint,
  p_quantity    integer default 1
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event      public.club_events%rowtype;
  v_type       public.club_event_ticket_types%rowtype;
  v_booking    bigint;
  v_qty        integer := greatest(1, coalesce(p_quantity, 1));
  v_unit       numeric(10,2);
  v_running    numeric(10,2);
  v_pct        smallint := 0;
  v_tier_key   text;
  v_tier_label text := '';
  v_discount   numeric(10,2);
begin
  select * into v_event from public.club_events where id = p_event;
  if v_event.id is null then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'check_violation';
  end if;

  -- `or is_admin()` is belt and braces rather than the thing that admits an
  -- admin, which 0176 measured and corrected. It stays for consistency with
  -- every other guard added since 0163.
  if not (public.club_can(v_event.club_id, 'events.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(v_event.end_date, v_event.start_date) < public.london_today() then
    raise exception 'EVENT_FINISHED' using errcode = 'check_violation';
  end if;

  select * into v_type from public.club_event_ticket_types
   where id = p_ticket_type and event_id = p_event;
  if v_type.id is null then
    raise exception 'TICKET_NOT_FOUND' using errcode = 'check_violation';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'NAME_REQUIRED' using errcode = 'check_violation';
  end if;

  -- The named person's tier, read here and never taken from the caller. A
  -- walk-in has no membership, so this leaves the discount at zero.
  if p_profile is not null then
    select m.tier_key,
           coalesce(t.label, ''),
           coalesce(least(100, greatest(0,
             (t.benefits ->> 'eventDiscountPercent')::smallint)), 0)
      into v_tier_key, v_tier_label, v_pct
      from public.club_memberships m
      left join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = v_event.club_id
       and m.profile_id = p_profile
       and m.status = 'approved'
     limit 1;
  end if;

  v_pct        := coalesce(v_pct, 0);
  v_tier_label := coalesce(v_tier_label, '');

  insert into public.club_event_bookings
    (club_id, event_id, profile_id, full_name, email, reference,
     tier_discount_percent, membership_tier_key, membership_tier_label)
  values
    (v_event.club_id, p_event, p_profile, left(btrim(p_name), 120),
     lower(btrim(coalesce(p_email, ''))), p_reference,
     v_pct, v_tier_key, v_tier_label)
  returning id into v_booking;

  -- Priced from the ticket type, never from the client. Same line the cart
  -- checkout writes, so a stub reads identically whoever typed it in.
  v_unit    := coalesce(public.money_amount(v_type.price), 0);
  v_running := v_unit * v_qty;

  insert into public.club_event_booking_items
    (booking_id, ticket_type_id, label, price, unit_amount, quantity)
  values
    (v_booking, v_type.id, v_type.label, coalesce(v_type.price, ''), v_unit, v_qty);

  v_discount := round(v_running * v_pct / 100.0, 2);

  update public.club_event_bookings
     set subtotal                = v_running,
         tier_discount_amount    = v_discount,
         loyalty_points_spent    = 0,
         loyalty_discount_amount = 0,
         total                   = greatest(v_running - v_discount, 0)
   where id = v_booking;

  return v_booking;
end;
$$;

revoke all on function public.club_add_event_booking(
  bigint, uuid, text, text, text, bigint, integer) from public, anon;
grant execute on function public.club_add_event_booking(
  bigint, uuid, text, text, text, bigint, integer) to authenticated;
