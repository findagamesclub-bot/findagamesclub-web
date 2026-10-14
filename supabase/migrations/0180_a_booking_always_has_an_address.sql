-- 0180 · a place put on the list by the club still needs an address.
--
-- 0179 wrote `coalesce(p_email, '')` and the dialog above it called the field
-- optional. `club_event_bookings.email` has been `not null check (position('@'
-- in email) > 1)` since 0015, so every walk-in with a blank box was refused
-- with "That did not save. Try again." about a rule nothing on the screen
-- said. Found by pressing the button, with every check green and the SQL
-- suite passing: its ten assertions all typed an address.
--
-- The constraint is right and stays. Everything about a booking is posted to
-- the address on the booking, which is the rule 0096 paid for from the other
-- direction: a place with nowhere to write to can never be told its event was
-- called off, and the person holding it finds out on the day.
--
-- So the fix is the other half. Where a member is named, their own account
-- address is what the confirmation goes to, read here rather than typed: the
-- club already knows who they are, the site already knows where to write to
-- them, and asking for it again is a chance to spell it differently from the
-- account the place is filed under. Where there is neither, it is named as a
-- refusal rather than left to a check constraint.

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
  v_email      text := lower(btrim(coalesce(p_email, '')));
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

  -- The named member's own address, where the club did not type one. Their
  -- place, their inbox: the confirmation, the receipt and any cancellation
  -- all go to whatever is on the booking.
  if v_email = '' and p_profile is not null then
    select lower(btrim(coalesce(u.email, ''))) into v_email
      from auth.users u where u.id = p_profile;
    v_email := coalesce(v_email, '');
  end if;

  if position('@' in v_email) < 2 then
    raise exception 'EMAIL_REQUIRED' using errcode = 'check_violation';
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
     v_email, p_reference,
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
