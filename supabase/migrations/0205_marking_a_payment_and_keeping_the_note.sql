/**
 * Three things a club writes down about money, and could not.
 *
 * The client found them in one sitting, and they are one shape wearing three
 * hats: the app takes no money anywhere, so every payment is something a club
 * or an admin writes down afterwards, and three of the four places that
 * happens had nowhere to write it.
 *
 *   i  An event booking's payment note was saved and never read. 0092 granted
 *      the column and the dialog has been writing to it since; nothing on any
 *      screen, the club's or the member's, has ever shown it back.
 *
 *   j  A table booking could not be marked paid at all. `club_bookings` has
 *      carried the frozen money since 0014 (`base_price`, `tier_discount_*`,
 *      `loyalty_*`, `total_price`) and had no payment state to go with it, so
 *      a club taking a fiver at the door had nowhere to record it and no way
 *      to ask who still owed.
 *
 *   x  A featured slot had a price and no answer to "has this been paid".
 *      0161 settled that featuring is sold by us and settled offline; 0191's
 *      revenue ledger therefore hardcoded `received = false` for every slot,
 *      which is right until somebody can say otherwise.
 *
 * One vocabulary across all three: unpaid, paid on the door, paid in advance,
 * which is what 0092 already uses and what `door-list.ts` already words.
 */

-- ---------------------------------------------------------------------------
-- 1. A table booking carries what was paid for it
-- ---------------------------------------------------------------------------

alter table public.club_bookings
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_method text not null default '',
  add column if not exists payment_note   text not null default '',
  add column if not exists paid_at        timestamptz;

do $$
begin
  alter table public.club_bookings
    add constraint club_bookings_payment_status_check
    check (payment_status in ('unpaid', 'paid_on_the_door', 'paid_in_advance'));
exception when duplicate_object then null;
end $$;

comment on column public.club_bookings.payment_note is
  'What the club wrote down when it recorded the money. Theirs and the member''s to read.';

-- The club-wide list below filters on exactly this, and a club a few seasons
-- in has thousands of rows: ten tables twice a week is a thousand a year.
create index if not exists club_bookings_club_payment_idx
  on public.club_bookings (club_id, payment_status, session_date desc);

/**
 * `paid_at` is stamped here, never sent from a form.
 *
 * When somebody paid is a fact about the row. 0092 settled this for an event
 * booking and the rule is copied rather than reinvented, including the half
 * that matters most: moving back to unpaid clears the stamp, so a club that
 * marked the wrong row does not leave a date behind saying otherwise.
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
  return new;
end;
$$;

drop trigger if exists club_bookings_payment on public.club_bookings;
create trigger club_bookings_payment
  before update of payment_status on public.club_bookings
  for each row execute function public.club_bookings_payment_stamp();

/**
 * Recording it is a function, not a column grant, and that is the whole guard.
 *
 * `club_bookings` already carries three permissive UPDATE policies, and
 * PostgreSQL ORs them: `club_bookings_cancel`'s USING admits the booker, the
 * opponent and whoever took a looking-for-a-game table. Granting the payment
 * columns to `authenticated` would therefore have let a member mark their own
 * table paid, which is the club's word and not theirs. 0184 and 0185 both
 * chose a function over a grant for this reason and this is the third.
 *
 * It returns the row so the caller can redraw from what landed rather than
 * re-reading, which is the rule every guarded write in this codebase follows.
 */
create or replace function public.club_set_booking_payment(
  p_booking bigint,
  p_status  text,
  p_method  text default '',
  p_note    text default ''
) returns table (
  booking_id     bigint,
  payment_status text,
  payment_method text,
  payment_note   text,
  paid_at        timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_club bigint;
begin
  if p_status not in ('unpaid', 'paid_on_the_door', 'paid_in_advance') then
    raise exception 'BOOKING_PAYMENT_UNKNOWN' using errcode = 'check_violation';
  end if;

  select b.club_id into v_club
    from public.club_bookings b where b.id = p_booking;
  if v_club is null then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if not (public.club_can(v_club, 'bookings.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- A cancelled table is not somebody who owes you, so the money on it is not
  -- the club's to keep moving. Same line 0158 drew on a called-off coaching
  -- place, and the reason the To pay tab can be trusted.
  if exists (select 1 from public.club_bookings b
              where b.id = p_booking and b.status <> 'booked') then
    raise exception 'BOOKING_NOT_LIVE' using errcode = 'check_violation';
  end if;

  return query
  update public.club_bookings b
     set payment_status = p_status,
         payment_method = btrim(coalesce(p_method, '')),
         payment_note   = btrim(coalesce(p_note, ''))
   where b.id = p_booking
  returning b.id, b.payment_status, b.payment_method, b.payment_note, b.paid_at;
end;
$$;

revoke all on function public.club_set_booking_payment(bigint, text, text, text)
  from public, anon;
grant execute on function public.club_set_booking_payment(bigint, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Every table a club has booked, in one list it can filter
-- ---------------------------------------------------------------------------

/**
 * The night calendar answers "who is playing on Thursday". This answers the
 * question the client actually asked, which four pages of a calendar cannot:
 * "who still owes me for a table, on any night".
 *
 * Filtered, counted and paged in SQL rather than in the browser. The coaching
 * bookings list reads everything and sifts it in memory, which is right at
 * fifty rows and wrong here: ten tables twice a week is a thousand a year, and
 * a club a few seasons in is past the point where shipping the lot to hide
 * most of it is defensible.
 *
 * Five groups, and `free` is one of them because a tier that waives the fee
 * is a real thing a club sells (`waiveGameBookingFee`, priced into
 * `total_price` by 0043 the moment the table is booked). A free table is not
 * an unpaid one, and counting it as one is how a club chases somebody for
 * money their membership already covered.
 */
create or replace function public.club_table_bookings(
  p_club  bigint,
  p_tab   text default 'all',
  p_query text default '',
  p_sort  text default 'newest',
  p_page  integer default 1,
  p_per   integer default 25
) returns table (
  booking_id     bigint,
  session_date   date,
  session_label  text,
  session_time   text,
  table_index    smallint,
  game_title     text,
  booked_by      uuid,
  booked_name    text,
  opponent_name  text,
  status         text,
  payment_status text,
  payment_method text,
  payment_note   text,
  paid_at        timestamptz,
  base_price     numeric(10,2),
  tier_label     text,
  tier_percent   smallint,
  tier_amount    numeric(10,2),
  points_spent   integer,
  points_amount  numeric(10,2),
  total_price    numeric(10,2),
  currency       text,
  booked_at      timestamptz,
  total_rows     bigint
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_needle text := nullif(btrim(coalesce(p_query, '')), '');
  v_from   integer := greatest(0, (greatest(1, coalesce(p_page, 1)) - 1) * greatest(1, coalesce(p_per, 25)));
begin
  if not (public.club_can(p_club, 'bookings.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with rows as (
    select b.id,
           b.session_date, b.session_label, b.session_time, b.table_index,
           b.game_title, b.booked_by,
           coalesce(nullif(btrim(p.full_name), ''), 'A member') as booked_name,
           coalesce(nullif(btrim(o.full_name), ''),
                    nullif(btrim(b.opponent_name), ''), '') as away_name,
           b.status, b.payment_status, b.payment_method, b.payment_note, b.paid_at,
           b.base_price, b.membership_tier_label, b.tier_discount_percent,
           b.tier_discount_amount, b.loyalty_points_spent, b.loyalty_discount_amount,
           b.total_price, b.price_currency, b.created_at
      from public.club_bookings b
      left join public.profiles p on p.id = b.booked_by
      left join public.profiles o on o.id = b.opponent_profile_id
     where b.club_id = p_club
       and (p_tab is null or p_tab = 'all'
            or (p_tab = 'cancelled' and b.status <> 'booked')
            or (p_tab = 'paid'  and b.status = 'booked' and b.payment_status <> 'unpaid')
            or (p_tab = 'free'   and b.status = 'booked' and b.total_price <= 0)
            or (p_tab = 'topay'  and b.status = 'booked' and b.payment_status = 'unpaid'
                                 and b.total_price > 0))
       and (v_needle is null
            or p.full_name ilike '%' || v_needle || '%'
            or o.full_name ilike '%' || v_needle || '%'
            or b.opponent_name ilike '%' || v_needle || '%'
            or b.game_title ilike '%' || v_needle || '%'
            or b.payment_note ilike '%' || v_needle || '%')
  )
  select r.id, r.session_date, r.session_label, r.session_time, r.table_index,
         r.game_title, r.booked_by, r.booked_name, r.away_name,
         r.status, r.payment_status, r.payment_method, r.payment_note, r.paid_at,
         r.base_price, r.membership_tier_label, r.tier_discount_percent,
         r.tier_discount_amount, r.loyalty_points_spent, r.loyalty_discount_amount,
         r.total_price, r.price_currency, r.created_at,
         count(*) over () as total_rows
    from rows r
   order by
     -- The id breaks every tie in the direction the sort runs. Three tables on
     -- one night share a date, and 0130 paid for a tie-break pointing the
     -- other way: "oldest first" handing back the newest of them.
     case when p_sort = 'oldest' then r.session_date end asc,
     case when p_sort = 'oldest' then r.table_index end asc,
     case when p_sort = 'name'   then lower(r.booked_name) end asc,
     case when p_sort = 'value'  then r.total_price end desc,
     case when p_sort not in ('oldest', 'name', 'value') then r.session_date end desc,
     case when p_sort = 'oldest' then r.id end asc,
     r.id desc
   offset v_from limit greatest(1, coalesce(p_per, 25));
end;
$$;

revoke all on function public.club_table_bookings(bigint, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.club_table_bookings(bigint, text, text, text, integer, integer)
  to authenticated;

/**
 * The five tab counts, narrowed by the same search the list is.
 *
 * "To pay 3" beside a search for Gulnabi has to mean three of theirs, which is
 * 0118's rule. Same predicates as above, written once per group rather than
 * five scans of the table.
 */
create or replace function public.club_table_booking_counts(
  p_club bigint, p_query text default ''
) returns table (
  all_rows  bigint,
  topay     bigint,
  paid      bigint,
  free      bigint,
  cancelled bigint
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_needle text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not (public.club_can(p_club, 'bookings.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select count(*),
         count(*) filter (where b.status = 'booked' and b.payment_status = 'unpaid'
                            and b.total_price > 0),
         count(*) filter (where b.status = 'booked' and b.payment_status <> 'unpaid'),
         count(*) filter (where b.status = 'booked' and b.total_price <= 0),
         count(*) filter (where b.status <> 'booked')
    from public.club_bookings b
    left join public.profiles p on p.id = b.booked_by
    left join public.profiles o on o.id = b.opponent_profile_id
   where b.club_id = p_club
     and (v_needle is null
          or p.full_name ilike '%' || v_needle || '%'
          or o.full_name ilike '%' || v_needle || '%'
          or b.opponent_name ilike '%' || v_needle || '%'
          or b.game_title ilike '%' || v_needle || '%'
          or b.payment_note ilike '%' || v_needle || '%');
end;
$$;

revoke all on function public.club_table_booking_counts(bigint, text) from public, anon;
grant execute on function public.club_table_booking_counts(bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The door list carries the note somebody wrote on it
-- ---------------------------------------------------------------------------

/**
 * 0092 granted `payment_note`, the payment dialog has been writing it since,
 * and this function never selected it, so the one screen the club records it
 * on could not show it back. The member's own ticket could not either.
 *
 * Dropped first, because `create or replace` cannot change a return type. This
 * is 0092's own body with one column added, not a retype: rebuilding a
 * function from an older definition is how `save_pairing_armies` lost its
 * outcome stamp in 0181.
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

-- ---------------------------------------------------------------------------
-- 4. A featured slot says whether it has been paid for
-- ---------------------------------------------------------------------------

alter table public.featured_listings
  add column if not exists paid_at        timestamptz,
  add column if not exists payment_method text not null default '',
  add column if not exists payment_note   text not null default '',
  add column if not exists paid_by        uuid references public.profiles (id) on delete set null;

comment on column public.featured_listings.paid_at is
  'When an admin recorded the money for this slot. Null means nobody has said.';

/**
 * Only an admin, because featuring is a placement WE sell.
 *
 * 0161 settled that an owner asks and an admin books and takes the money
 * offline, so saying it has been paid is our word and not the club''s. The
 * club reads the answer on its own billing page, which is the half the client
 * was missing: three slots at £20 apiece with no way to tell which they had
 * settled.
 *
 * `paid_by` is stamped here and is in no grant, so the row cannot claim
 * somebody else recorded it.
 */
create or replace function public.record_featured_payment(
  p_slot   bigint,
  p_paid   boolean,
  p_method text default '',
  p_note   text default ''
) returns table (
  slot_id        bigint,
  paid_at        timestamptz,
  payment_method text,
  payment_note   text
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

  if not exists (select 1 from public.featured_listings f where f.id = p_slot) then
    raise exception 'FEATURED_SLOT_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  return query
  update public.featured_listings f
     -- Unsetting clears the lot. A slot marked paid by mistake must not keep
     -- the method and the reference somebody typed with it, which is the same
     -- rule the booking stamp above follows.
     set paid_at        = case when p_paid then coalesce(f.paid_at, now()) else null end,
         paid_by        = case when p_paid then coalesce(f.paid_by, auth.uid()) else null end,
         payment_method = case when p_paid then btrim(coalesce(p_method, '')) else '' end,
         payment_note   = case when p_paid then btrim(coalesce(p_note, '')) else '' end
   where f.id = p_slot
  returning f.id, f.paid_at, f.payment_method, f.payment_note;
end;
$$;

revoke all on function public.record_featured_payment(bigint, boolean, text, text)
  from public, anon;
grant execute on function public.record_featured_payment(bigint, boolean, text, text)
  to authenticated;

/**
 * And the ledger stops saying every slot is unsettled.
 *
 * 0191 hardcoded `received = false` for featured, which was honest while
 * nothing could record one. Only those two columns move: the line is still
 * dated by `starts_on`, because `admin_growth_months` buckets it that way and
 * 0202''s suite asserts the file and the chart agree about a window.
 *
 * 0202''s own text with that one change, for the reason section 3 gives.
 */
create or replace function public.admin_revenue_lines(
  p_from date default null, p_to date default null
) returns table (
  kind          text,
  received      boolean,
  on_date       date,
  club_id       bigint,
  club_name     text,
  club_slug     text,
  plan          text,
  period_start  date,
  period_end    date,
  amount_pence  integer,
  currency      text,
  method        text,
  reference     text,
  note          text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from date := coalesce(p_from, '1900-01-01'::date);
  v_to   date := coalesce(p_to, public.london_today());
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select 'listing'::text,
         true,
         l.paid_at,
         c.id,
         -- The club, or the name on the listing that has not become one yet.
         coalesce(nullif(c.name, ''), sub.club_name, ''),
         coalesce(c.slug::text, ''),
         coalesce(s.plan_interval, ''),
         l.period_start::date,
         l.period_end::date,
         l.amount_pence,
         l.currency,
         l.method,
         l.reference,
         l.note
    from public.listing_payments l
    left join public.listing_subscriptions s on s.id = l.subscription_id
    left join public.clubs c on c.id = coalesce(l.club_id, s.club_id)
    left join public.club_submissions sub on sub.id = s.submission_id
   where l.kind = 'subscription'
     and l.paid_at between v_from and v_to

  union all

  select 'featured'::text,
         f.paid_at is not null,
         f.starts_on,
         c.id,
         coalesce(c.name, ''),
         coalesce(c.slug::text, ''),
         ''::text,
         f.starts_on,
         f.ends_on,
         f.price_pence,
         f.currency,
         f.payment_method,
         ''::text,
         f.note
    from public.featured_listings f
    left join public.clubs c on c.id = f.club_id
   where f.starts_on between v_from and v_to

   order by 3 desc, 5;
end $$;

revoke all on function public.admin_revenue_lines(date, date) from public, anon;
grant execute on function public.admin_revenue_lines(date, date) to authenticated;

/**
 * And the two screens that show it read it here, not through a select.
 *
 * `src/types/database.ts` has not been regenerated, so a `.select()` naming
 * the four columns above would be refused by `check:columns`, which is right
 * to refuse it. Same shape `findPaymentStanding` already uses on an event
 * booking and for the same reason: a second small read beside the typed one,
 * deleted when the types catch up.
 *
 * It filters rather than raising, so one array can carry a club's own slots
 * and an admin's view of everybody's. Whether a slot has been settled is
 * between us and that club; the slot itself is world-readable because what is
 * on the front page is on the front page.
 */
create or replace function public.featured_payment_standing(p_slots bigint[])
returns table (
  slot_id        bigint,
  paid_at        timestamptz,
  payment_method text,
  payment_note   text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select f.id, f.paid_at, f.payment_method, f.payment_note
    from public.featured_listings f
   where f.id = any(coalesce(p_slots, '{}'::bigint[]))
     and (public.is_admin() or public.club_can(f.club_id, 'listing.edit'));
end;
$$;

revoke all on function public.featured_payment_standing(bigint[]) from public, anon;
grant execute on function public.featured_payment_standing(bigint[]) to authenticated;
