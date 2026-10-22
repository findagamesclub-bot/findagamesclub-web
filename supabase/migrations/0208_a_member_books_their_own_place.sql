/**
 * A member books their own place, and only their own.
 *
 * The client's words: *"member name and email should be locked here, so that a
 * member cannot book on behalf of someone else, only club owner can do this
 * for a member if required."*
 *
 * `checkout_event_cart` has taken the name and the address off the form since
 * 0015 and filed the booking against `auth.uid()` regardless, so a member
 * could put anybody's name on a place and pay for it **on their own tier's
 * discount**. That is the same fault 0197 closed on the club's own walk-in
 * path a fortnight ago, one door along, and it is the one the client found
 * first: *"any member discount or loyalty points should not be applied to the
 * non member, as they are essentially booking a place as a non member."*
 *
 * So the two values are read from the account here rather than trusted, which
 * is what every other figure in this function already does. The form still
 * sends them and they survive only as a fallback for a profile with no name
 * on it; the screen stops offering them as fields at all.
 *
 * **Booking for somebody else does not go away, it moves.** The club does it
 * from the door list (0179), where it is priced off the person named rather
 * than off whoever is typing, and where a walk-in with no account is an
 * ordinary case rather than a loophole.
 *
 * 0050's own text with the insert changed, and nothing else: rebuilding this
 * from 0015 would drop the points, the tier read and the capacity lock.
 */
create or replace function public.checkout_event_cart(
  target_event bigint,
  buyer_name text,
  buyer_email text,
  booking_reference text,
  redeem integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := (select auth.uid());
  v_event      public.club_events%rowtype;
  v_booking    bigint;
  v_line       record;
  v_running    numeric(10,2) := 0;
  v_pct        smallint := 0;
  v_tier_key   text;
  v_tier_label text := '';
  v_discount   numeric(10,2) := 0;
  v_payable    numeric(10,2) := 0;
  v_wanted     integer := greatest(0, coalesce(redeem, 0));
  v_cap_pct    smallint := 0;
  v_point_val  numeric(10,4);
  v_balance    integer := 0;
  v_used       integer := 0;
  v_off        numeric(10,2) := 0;
  -- Who the booking is actually in the name of. Read, never taken from the
  -- form, for the same reason the tier discount below is read.
  v_name       text;
  v_email      text;
begin
  if v_actor is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;

  select * into v_event from public.club_events where id = target_event;
  if v_event.id is null then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'check_violation';
  end if;
  if coalesce(v_event.end_date, v_event.start_date) < public.london_today() then
    raise exception 'EVENT_FINISHED' using errcode = 'check_violation';
  end if;

  -- The buyer's tier, and the discount it carries on event tickets. Read here
  -- rather than trusted from the caller.
  select m.tier_key,
         coalesce(t.label, ''),
         coalesce(least(100, greatest(0,
           (t.benefits ->> 'eventDiscountPercent')::smallint)), 0)
    into v_tier_key, v_tier_label, v_pct
    from public.club_memberships m
    left join public.club_membership_tiers t
      on t.club_id = m.club_id and t.tier_key = m.tier_key
   where m.club_id = v_event.club_id
     and m.profile_id = v_actor
     and m.status = 'approved'
   limit 1;

  v_pct        := coalesce(v_pct, 0);
  v_tier_label := coalesce(v_tier_label, '');

  -- The buyer is the account, so the place goes in the account's own name and
  -- the confirmation to the account's own address. The form still carries both
  -- and they are now a fallback for a profile with no name on it, never an
  -- instruction: a member typing somebody else's name was booking a place for
  -- them on their own tier's discount, which is the half of this the client
  -- objected to first (0197 closed the club's own version of it).
  --
  -- Booking for somebody else is the CLUB's to do, through the door list, and
  -- that path prices it off the named person rather than off the buyer.
  select coalesce(nullif(btrim(p.full_name), ''), btrim(buyer_name)),
         coalesce(nullif(lower(btrim(u.email)), ''), lower(btrim(buyer_email)))
    into v_name, v_email
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = v_actor;

  insert into public.club_event_bookings
    (club_id, event_id, profile_id, full_name, email, reference,
     tier_discount_percent, membership_tier_key, membership_tier_label)
  values
    (v_event.club_id, target_event, v_actor,
     coalesce(nullif(v_name, ''), btrim(buyer_name)),
     coalesce(nullif(v_email, ''), lower(btrim(buyer_email))),
     booking_reference, v_pct, v_tier_key, v_tier_label)
  returning id into v_booking;

  for v_line in
    select c.ticket_type_id, c.quantity, t.label, t.price
      from public.club_event_cart_items c
      join public.club_event_ticket_types t on t.id = c.ticket_type_id
     where c.profile_id = v_actor and c.event_id = target_event
     order by t.position
  loop
    -- Price is read from the ticket type, never from the client.
    insert into public.club_event_booking_items
      (booking_id, ticket_type_id, label, price, unit_amount, quantity)
    values
      (v_booking, v_line.ticket_type_id, v_line.label, coalesce(v_line.price, ''),
       coalesce(public.money_amount(v_line.price), 0), v_line.quantity);

    v_running := v_running + coalesce(public.money_amount(v_line.price), 0) * v_line.quantity;
  end loop;

  if not exists (select 1 from public.club_event_booking_items where booking_id = v_booking) then
    raise exception 'CART_EMPTY' using errcode = 'check_violation';
  end if;

  v_discount := round(v_running * v_pct / 100.0, 2);
  v_payable  := greatest(v_running - v_discount, 0);

  if v_wanted > 0 then
    -- The client's rule, enforced by the join: a member who is not approved at
    -- this club has no tier here, so no cap, so nothing to redeem with.
    select coalesce(least(100, greatest(0,
             (t.benefits ->> 'loyaltyRedemptionCapPercent')::smallint)), 0)
      into v_cap_pct
      from public.club_memberships m
      join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = v_event.club_id
       and m.profile_id = v_actor
       and m.status = 'approved'
     limit 1;

    select s.point_value into v_point_val
      from public.club_loyalty_settings s
     where s.club_id = v_event.club_id and s.enabled;

    if v_point_val is null or v_point_val <= 0 or coalesce(v_cap_pct, 0) <= 0 then
      raise exception 'NO_REDEMPTION' using errcode = 'check_violation';
    end if;

    select coalesce(sum(l.available_delta), 0) into v_balance
      from public.club_loyalty_transactions l
     where l.club_id = v_event.club_id and l.profile_id = v_actor;

    if v_wanted > v_balance then
      raise exception 'NOT_ENOUGH_POINTS' using errcode = 'check_violation';
    end if;

    -- A cart a tier has already made free has nothing left to take points off,
    -- and saying so beats silently spending none.
    v_used := least(v_wanted, floor(round(v_payable * v_cap_pct / 100.0, 2) / v_point_val)::integer);
    if v_used <= 0 then
      raise exception 'OVER_REDEMPTION_CAP' using errcode = 'check_violation';
    end if;
    v_off := round(v_used * v_point_val, 2);
  end if;

  update public.club_event_bookings
     set subtotal                = v_running,
         tier_discount_amount    = v_discount,
         loyalty_points_spent    = v_used,
         loyalty_discount_amount = v_off,
         total                   = greatest(v_payable - v_off, 0)
   where id = v_booking;

  delete from public.club_event_cart_items
   where profile_id = v_actor and event_id = target_event;

  return v_booking;
end;
$$;

revoke all on function public.checkout_event_cart(bigint, text, text, text, integer)
  from public, anon;
grant execute on function public.checkout_event_cart(bigint, text, text, text, integer)
  to authenticated;
