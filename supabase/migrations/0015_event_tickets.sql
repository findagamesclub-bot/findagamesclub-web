-- 0015 · Event ticket carts and bookings
--
-- Reservations, not payments. Legacy's checkout_event_tickets (club_store.py:2657)
-- records a name, an email and the line items and takes no money; card payment
-- arrives in a later milestone. The money columns exist so the totals a member
-- agreed to are frozen at the time of booking, not recomputed later.
--
-- Capacity is a quantity here, not a seat index as it is for tables, so the
-- anti-overbooking trick from 0014 does not transfer: a partial unique index
-- cannot express "the sum of these must not exceed N". A trigger locks the
-- ticket type row and re-counts instead, which serialises concurrent buyers.

-- ---------------------------------------------------------------------------
-- 1. Carts
-- ---------------------------------------------------------------------------

create table public.club_event_cart_items (
  id              bigint generated always as identity primary key,
  event_id        bigint not null references public.club_events (id) on delete cascade,
  ticket_type_id  bigint not null references public.club_event_ticket_types (id) on delete cascade,
  profile_id      uuid   not null default auth.uid()
                    references public.profiles (id) on delete cascade,
  quantity        smallint not null default 1 check (quantity between 1 and 20),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One row per ticket type per person: adding again changes the quantity.
  constraint club_event_cart_one_per_type unique (profile_id, ticket_type_id)
);

create index club_event_cart_event_idx on public.club_event_cart_items (event_id, profile_id);

-- ---------------------------------------------------------------------------
-- 2. Bookings
-- ---------------------------------------------------------------------------

create table public.club_event_bookings (
  id              bigint generated always as identity primary key,
  club_id         bigint not null references public.clubs (id) on delete cascade,
  event_id        bigint not null references public.club_events (id) on delete restrict,

  -- Null for a guest. Legacy allows checkout without an account
  -- (club_store.py:2674), and a club would rather have the booking.
  profile_id      uuid references public.profiles (id) on delete set null,
  full_name       text not null check (length(btrim(full_name)) > 0),
  email           text not null check (position('@' in email) > 1),

  reference       text not null,

  -- Frozen at checkout. A club changing its prices afterwards must not rewrite
  -- what somebody already agreed to.
  currency              text not null default 'GBP',
  subtotal              numeric(10,2) not null default 0 check (subtotal >= 0),
  tier_discount_percent smallint      not null default 0 check (tier_discount_percent between 0 and 100),
  tier_discount_amount  numeric(10,2) not null default 0 check (tier_discount_amount >= 0),
  total                 numeric(10,2) not null default 0 check (total >= 0),
  membership_tier_key   text,
  membership_tier_label text not null default '',

  -- 'reserved' until payment exists. Kept as a status rather than a boolean so
  -- 'paid' can be added without a migration when it does.
  status          text not null default 'reserved'
                    check (status in ('reserved', 'cancelled')),
  cancelled_at    timestamptz,
  cancelled_by    uuid references public.profiles (id) on delete set null,

  notes           text not null default '',
  legacy_id       bigint,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint club_event_bookings_cancel_pair
    check ((status = 'cancelled') = (cancelled_at is not null))
);

create unique index club_event_bookings_reference_uniq on public.club_event_bookings (reference);
create index club_event_bookings_event_idx on public.club_event_bookings (event_id)
  where status = 'reserved';
create index club_event_bookings_profile_idx on public.club_event_bookings (profile_id, created_at desc);
create unique index club_event_bookings_legacy_uniq on public.club_event_bookings (club_id, legacy_id)
  where legacy_id is not null;

create table public.club_event_booking_items (
  id              bigint generated always as identity primary key,
  booking_id      bigint not null references public.club_event_bookings (id) on delete cascade,
  ticket_type_id  bigint not null references public.club_event_ticket_types (id) on delete restrict,

  -- Snapshots, for the same reason the totals are frozen.
  label           text not null default '',
  price           text not null default '',
  unit_amount     numeric(10,2) not null default 0,
  quantity        smallint not null check (quantity between 1 and 20),

  constraint club_event_booking_items_one_per_type unique (booking_id, ticket_type_id)
);

create index club_event_booking_items_type_idx on public.club_event_booking_items (ticket_type_id);

-- ---------------------------------------------------------------------------
-- 3. Capacity
-- ---------------------------------------------------------------------------

/** How many of a ticket type are already spoken for. */
create or replace function public.tickets_taken(target_type bigint)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(i.quantity), 0)::int
    from public.club_event_booking_items i
    join public.club_event_bookings b on b.id = i.booking_id
   where i.ticket_type_id = target_type
     and b.status = 'reserved';
$$;

revoke all on function public.tickets_taken(bigint) from public, anon;
grant execute on function public.tickets_taken(bigint) to anon, authenticated;

/**
 * Refuse a line that would oversell a ticket type.
 *
 * The lock is the point. Two people buying the last two seats at once would
 * both read "2 left" and both succeed, so the ticket type row is locked before
 * the count is taken and the second buyer waits for the first to commit.
 */
create or replace function public.club_event_booking_items_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap  integer;
  used integer;
begin
  select quantity_available into cap
    from public.club_event_ticket_types
   where id = new.ticket_type_id
   for update;

  if cap is null then
    -- Uncapped ticket type. The club did not set a limit.
    return new;
  end if;

  select coalesce(sum(i.quantity), 0) into used
    from public.club_event_booking_items i
    join public.club_event_bookings b on b.id = i.booking_id
   where i.ticket_type_id = new.ticket_type_id
     and b.status = 'reserved'
     and i.booking_id <> new.booking_id;

  if used + new.quantity > cap then
    raise exception 'TICKETS_SOLD_OUT' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger club_event_booking_items_capacity
  before insert or update on public.club_event_booking_items
  for each row execute function public.club_event_booking_items_guard();

/** Cancellation stamps itself, so nobody can cancel in another name. */
create or replace function public.club_event_bookings_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status = 'reserved' then
    new.cancelled_at := now();
    new.cancelled_by := (select auth.uid());
  elsif new.status = old.status then
    new.cancelled_at := old.cancelled_at;
    new.cancelled_by := old.cancelled_by;
  else
    raise exception 'BOOKING_STATUS_LOCKED' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger club_event_bookings_stamp
  before update on public.club_event_bookings
  for each row execute function public.club_event_bookings_before_update();

-- ---------------------------------------------------------------------------
-- 4. Checkout
-- ---------------------------------------------------------------------------

/** "GBP 30", "£15", "Pay what you can" -> a number or null. */
create or replace function public.money_amount(raw text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select nullif(regexp_replace(coalesce(raw, ''), '[^0-9.]', '', 'g'), '')::numeric;
$$;


/**
 * Turn a cart into a booking.
 *
 * A definer function rather than an insert policy, because checkout has to
 * write three tables together and price them from the ticket types rather than
 * from anything the client sent. A member who could insert their own booking
 * row could name their own total.
 *
 * Guests are handled by the service with a null actor; this path is for a
 * signed-in member emptying their cart.
 */
create or replace function public.checkout_event_cart(
  target_event bigint,
  buyer_name text,
  buyer_email text,
  booking_reference text,
  discount_percent smallint default 0,
  tier_key text default null,
  tier_label text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  ev    public.club_events%rowtype;
  new_booking bigint;
  line  record;
  running numeric(10,2) := 0;
  discount numeric(10,2);
begin
  if actor is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;

  select * into ev from public.club_events where id = target_event;
  if ev.id is null then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'check_violation';
  end if;
  if coalesce(ev.end_date, ev.start_date) < public.london_today() then
    raise exception 'EVENT_FINISHED' using errcode = 'check_violation';
  end if;

  insert into public.club_event_bookings
    (club_id, event_id, profile_id, full_name, email, reference,
     tier_discount_percent, membership_tier_key, membership_tier_label)
  values
    (ev.club_id, target_event, actor, btrim(buyer_name), lower(btrim(buyer_email)),
     booking_reference, greatest(0, least(100, coalesce(discount_percent, 0))),
     tier_key, coalesce(tier_label, ''))
  returning id into new_booking;

  for line in
    select c.ticket_type_id, c.quantity, t.label, t.price
      from public.club_event_cart_items c
      join public.club_event_ticket_types t on t.id = c.ticket_type_id
     where c.profile_id = actor and c.event_id = target_event
     order by t.position
  loop
    -- Price is read from the ticket type, never from the client.
    insert into public.club_event_booking_items
      (booking_id, ticket_type_id, label, price, unit_amount, quantity)
    values
      (new_booking, line.ticket_type_id, line.label, coalesce(line.price, ''),
       coalesce(public.money_amount(line.price), 0), line.quantity);

    running := running + coalesce(public.money_amount(line.price), 0) * line.quantity;
  end loop;

  if not exists (select 1 from public.club_event_booking_items where booking_id = new_booking) then
    raise exception 'CART_EMPTY' using errcode = 'check_violation';
  end if;

  discount := round(running * greatest(0, least(100, coalesce(discount_percent, 0))) / 100.0, 2);

  update public.club_event_bookings
     set subtotal = running,
         tier_discount_amount = discount,
         total = greatest(running - discount, 0)
   where id = new_booking;

  delete from public.club_event_cart_items
   where profile_id = actor and event_id = target_event;

  return new_booking;
end;
$$;

revoke all on function public.checkout_event_cart(bigint, text, text, text, smallint, text, text)
  from public, anon;
grant execute on function public.checkout_event_cart(bigint, text, text, text, smallint, text, text)
  to authenticated;


-- ---------------------------------------------------------------------------
-- 5. Row level security
-- ---------------------------------------------------------------------------

alter table public.club_event_cart_items    enable row level security;
alter table public.club_event_bookings      enable row level security;
alter table public.club_event_booking_items enable row level security;

-- A cart is private. Nobody else needs to know what you are thinking of buying.
create policy club_event_cart_own on public.club_event_cart_items
  for select to authenticated using (profile_id = (select auth.uid()));
create policy club_event_cart_add on public.club_event_cart_items
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy club_event_cart_change on public.club_event_cart_items
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
create policy club_event_cart_remove on public.club_event_cart_items
  for delete to authenticated using (profile_id = (select auth.uid()));

-- Your own bookings, or every booking on a club you run.
create policy club_event_bookings_select on public.club_event_bookings
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.can_manage_club(club_id));

-- No insert policy on purpose: checkout_event_cart writes these, so a member
-- cannot create a booking and name their own total.
create policy club_event_bookings_cancel on public.club_event_bookings
  for update to authenticated
  using (
    status = 'reserved'
    and (profile_id = (select auth.uid()) or public.can_manage_club(club_id))
  )
  with check (status = 'cancelled');

create policy club_event_booking_items_select on public.club_event_booking_items
  for select to authenticated
  using (exists (
    select 1 from public.club_event_bookings b
     where b.id = booking_id
       and (b.profile_id = (select auth.uid()) or public.can_manage_club(b.club_id))
  ));

-- ---------------------------------------------------------------------------
-- 6. Grants. Revoke first — Supabase's defaults hand out the whole table, and
--    an additive column grant on top of that grants nothing.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on public.club_event_cart_items    from anon, authenticated;
revoke insert, update, delete on public.club_event_bookings      from anon, authenticated;
revoke insert, update, delete on public.club_event_booking_items from anon, authenticated;

grant select on public.club_event_cart_items, public.club_event_bookings,
                public.club_event_booking_items
  to authenticated;

grant insert (event_id, ticket_type_id, quantity) on public.club_event_cart_items to authenticated;
grant update (quantity, updated_at) on public.club_event_cart_items to authenticated;
grant delete on public.club_event_cart_items to authenticated;

-- Cancelling is the only thing a member may write on a booking.
grant update (status) on public.club_event_bookings to authenticated;

-- Booking lines are written by checkout alone.
revoke insert, update, delete on public.club_event_booking_items from authenticated;
