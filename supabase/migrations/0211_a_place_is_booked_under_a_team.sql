/**
 * A place at a team event is booked under a team name.
 *
 * The client's words: *"for a team event ticket booking, we should also
 * capture a team name as part of the booking. This team name is what should be
 * shown in the club owner event view under teams, where the club owner can
 * then add player names to that team. This team name along with the names of
 * each person should be what is shown on the who is coming section also."*
 *
 * 0168 built teams as something the CLUB types in afterwards, from the roster.
 * That is right for a club running its own league and wrong for an open team
 * tournament, where six teams of four arrive already formed and the organiser
 * is copying names off an entry form. The team is what the players already
 * know themselves as; asking the club to invent it is asking them to retype
 * something the booker could have told them.
 *
 * It is one column and three readers. Deliberately NOT a foreign key to
 * `club_event_teams`: somebody books weeks before the club builds the teams,
 * so at the moment it is typed there is nothing to point at, and a free-text
 * name is what the club then groups by. Linking the two is the club's job on
 * the Teams page and is a different act from booking.
 */

alter table public.club_event_bookings
  add column if not exists team_name text not null default '';

comment on column public.club_event_bookings.team_name is
  'What the booker said their team is called. Free text: at a team event the '
  'bookings arrive before the teams exist.';

-- Only ever read grouped by event, which is how the console suggests teams.
create index if not exists club_event_bookings_team_idx
  on public.club_event_bookings (event_id, lower(btrim(team_name)))
  where team_name <> '';

-- ---------------------------------------------------------------------------
-- The two booking paths take it
-- ---------------------------------------------------------------------------

/**
 * A new parameter makes a NEW function in Postgres rather than replacing the
 * old one, so the five-argument version goes first. Sixth time this file has
 * had to say it, and the reason is always the same: a caller that forgets the
 * argument silently keeps the old behaviour.
 *
 * 0208's own text with the column added, because rebuilding from 0050 would
 * drop the read-the-account fix it exists for.
 */
drop function if exists public.checkout_event_cart(bigint, text, text, text, integer);

create or replace function public.checkout_event_cart(
  target_event bigint,
  buyer_name text,
  buyer_email text,
  booking_reference text,
  redeem integer default 0,
  -- What the booker says their team is called. Ignored at an ordinary event,
  -- where the screen does not ask for it.
  buyer_team text default ''
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
    (club_id, event_id, profile_id, full_name, email, reference, team_name,
     tier_discount_percent, membership_tier_key, membership_tier_label)
  values
    (v_event.club_id, target_event, v_actor,
     coalesce(nullif(v_name, ''), btrim(buyer_name)),
     coalesce(nullif(v_email, ''), lower(btrim(buyer_email))),
     booking_reference,
     -- Kept only where it can mean something. A team name on an event that is
     -- not run as teams is a field nobody will ever read back.
     case when coalesce(v_event.team_event, false)
            then left(btrim(coalesce(buyer_team, '')), 80) else '' end,
     v_pct, v_tier_key, v_tier_label)
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

revoke all on function public.checkout_event_cart(bigint, text, text, text, integer, text)
  from public, anon;
grant execute on function public.checkout_event_cart(bigint, text, text, text, integer, text)
  to authenticated;

/**
 * And the club's own door, for the same reason: at a team tournament the
 * person in front of them is playing for somebody.
 *
 * 0197's own text, which is the latest: rebuilding from 0180 would drop the
 * fix that takes a named member's own name rather than whatever was typed.
 */
drop function if exists public.club_add_event_booking(bigint, uuid, text, text, text, bigint, integer);

create or replace function public.club_add_event_booking(
  p_event       bigint,
  p_profile     uuid,
  p_name        text,
  p_email       text,
  p_reference   text,
  p_ticket_type bigint,
  p_quantity    integer default 1,
  -- The team they are playing for, where the club knows it at the door.
  p_team        text default ''
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
  v_name       text;
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

  -- Whose place it is decides the name on it, and a second box does not.
  --
  -- The dialog carried a Member picker and a separate "Name on the door" with
  -- nothing tying them together, so a club could name a member for their
  -- tier's discount and type somebody else onto the door. A non-member then
  -- turned up on a member's price, and the member collected the loyalty points
  -- for a place they were not at.
  --
  -- A place is a member's or it is a guest's. Naming a member makes it theirs,
  -- and theirs carries their name. Taken here rather than refused, because a
  -- refusal would have to decide that "T. Allen" is not "Tom Allen".
  if p_profile is not null then
    select nullif(btrim(coalesce(pr.full_name, '')), '') into v_name
      from public.profiles pr where pr.id = p_profile;
  end if;
  v_name := left(coalesce(v_name, btrim(p_name)), 120);

  v_pct        := coalesce(v_pct, 0);
  v_tier_label := coalesce(v_tier_label, '');

  insert into public.club_event_bookings
    (club_id, event_id, profile_id, full_name, email, reference, team_name,
     tier_discount_percent, membership_tier_key, membership_tier_label)
  values
    (v_event.club_id, p_event, p_profile, v_name,
     v_email, p_reference,
     case when coalesce(v_event.team_event, false)
            then left(btrim(coalesce(p_team, '')), 80) else '' end,
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

revoke all on function
  public.club_add_event_booking(bigint, uuid, text, text, text, bigint, integer, text)
  from public, anon;
grant execute on function
  public.club_add_event_booking(bigint, uuid, text, text, text, bigint, integer, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Three readers
-- ---------------------------------------------------------------------------

/**
 * Who is coming, with the team they booked under.
 *
 * 0065's own text with one column added. The team rides in the group key as
 * well, because somebody who booked twice under two names has told the club
 * two different things and folding them would hide that.
 */
-- Dropped first: a return type cannot change under `create or replace`, and
-- this one gains a column. Same reason the door list below drops.
drop function if exists public.club_event_roster(bigint);

create function public.club_event_roster(p_event bigint)
returns table (
  profile_id uuid,
  full_name text,
  team_name text,
  is_member boolean,
  tickets integer,
  bookings integer,
  first_booked timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with access as (
    select public.can_access_event_board(p_event) as inner_circle,
           public.event_has_ended(p_event)        as finished
  ),
  tickets as (
    select b.id,
           b.profile_id,
           coalesce(nullif(btrim(b.full_name), ''),
                    nullif(btrim(p.full_name), ''),
                    'Guest')                             as who,
           btrim(coalesce(b.team_name, ''))              as team,
           b.created_at,
           coalesce((select sum(i.quantity)
                       from public.club_event_booking_items i
                      where i.booking_id = b.id), 0)::integer as seats
      from public.club_event_bookings b
      left join public.profiles p on p.id = b.profile_id
      cross join access a
     where b.event_id = p_event
       and b.status <> 'cancelled'
       and (a.inner_circle or a.finished)
  )
  select
    t.profile_id,
    t.who,
    t.team,
    t.profile_id is not null as is_member,
    case when (select inner_circle from access) then sum(t.seats)::integer end as tickets,
    case when (select inner_circle from access) then count(*)::integer end     as bookings,
    min(t.created_at) as first_booked
    from tickets t
   group by t.profile_id, t.who, t.team
   order by min(t.created_at);
$$;

revoke all on function public.club_event_roster(bigint) from public;
grant execute on function public.club_event_roster(bigint) to anon, authenticated;

/**
 * The teams people booked under, for the club's own Teams page.
 *
 * The client's sentence is the design: *"shown in the club owner event view
 * under teams, where the club owner can then add player names to that team"*.
 * So this is not a list of teams, it is a list of the names people typed with
 * everybody who typed each one, which the club turns into a real team in one
 * press.
 *
 * Folded on the lowercased name, because "Red Dice" and "red dice" are one
 * team told to the club twice, and answering with the spelling the first
 * person used is as good an answer as any.
 */
create or replace function public.event_booked_teams(p_event bigint)
returns table (
  team_name text,
  people    bigint,
  players   jsonb,
  /** True once a team of that name exists, so the console can say so. */
  made      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_club bigint;
begin
  select club_id into v_club from public.club_events where id = p_event;
  if v_club is null then return; end if;
  if not (public.club_can(v_club, 'events.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with booked as (
    select lower(btrim(b.team_name)) as key,
           min(btrim(b.team_name))   as shown,
           b.profile_id,
           coalesce(nullif(btrim(b.full_name), ''),
                    nullif(btrim(p.full_name), ''), 'Guest') as who,
           min(b.created_at) as first_booked
      from public.club_event_bookings b
      left join public.profiles p on p.id = b.profile_id
     where b.event_id = p_event
       and b.status <> 'cancelled'
       and btrim(coalesce(b.team_name, '')) <> ''
     group by lower(btrim(b.team_name)), b.profile_id,
              coalesce(nullif(btrim(b.full_name), ''),
                       nullif(btrim(p.full_name), ''), 'Guest')
  )
  select min(k.shown),
         count(*),
         jsonb_agg(jsonb_build_object('profileId', k.profile_id, 'name', k.who)
                   order by k.first_booked, k.who),
         exists (select 1 from public.club_event_teams t
                  where t.event_id = p_event
                    and lower(btrim(t.name)) = k.key)
    from booked k
   group by k.key
   order by 2 desc, 1;
end;
$$;

revoke all on function public.event_booked_teams(bigint) from public, anon;
grant execute on function public.event_booked_teams(bigint) to authenticated;

/**
 * And the door list carries it, so the club can see who is with whom while
 * they are taking names at the desk.
 *
 * Dropped first, because a return type cannot change under `create or
 * replace`. 0205's own text with one column added.
 */
drop function if exists public.club_event_door_list(bigint);

create function public.club_event_door_list(p_event bigint)
returns table (
  booking_id bigint,
  profile_id uuid,
  full_name text,
  email text,
  reference text,
  status text,
  team_name text,
  payment_status text,
  payment_method text,
  payment_note text,
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
           b.team_name,
           b.payment_status, b.payment_method, b.payment_note,
           b.checked_in_at, b.refund_status,
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
