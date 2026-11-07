-- 0221 · a table is split between the people on it
--
-- The client, item gg: "when booking a table and showing what fee is due, we
-- need to do this per member selected. For example, one member may have a
-- membership tier that gives them table costs for free, but the other member
-- may only have a basic membership and not this perk ... if a table cost is
-- £5, usually it would be £2.50 per person to pay. This means for recording
-- table booking payments also, it needs to be at a per member per table level.
-- As member A may have paid their half, but member B has not."
--
-- Since 0014 a table has had ONE price, charged to whoever booked it and
-- discounted by THEIR tier alone. So a Life Member whose tier waives the fee
-- booked a table for themselves and a Basic member, and the club was owed
-- nothing for either of them. The second player's membership never entered
-- into it, and the club had nowhere to say they still owed their half.
--
-- A table has two seats and this table has modelled them as two sides since
-- 0014: `booked_by_score` / `opponent_score`, `booked_by_army` /
-- `opponent_army`. The money joins them rather than moving to a table of its
-- own, because a third seat does not exist here — `table_index` is unique per
-- session and date, and both the result and the army halves would have to grow
-- with it.
--
-- THE SECOND SEAT IS `coalesce(opponent_profile_id, accepted_by)`. A table
-- taken off a looking-for-game post files the second player under
-- `accepted_by` (0014), which is the same `coalesce` every other reader of a
-- booking already does.
--
-- WHAT `base_price` MEANS HAS CHANGED, deliberately: it is the BOOKER'S SHARE
-- now, not the table's price. Everything that reads it already reads it as
-- "what this person is being charged" — the member's own card, the price
-- breakdown, the payments row — so they stay right without being touched. The
-- two that mean the whole table are the analytics money and months reads, and
-- those add the second half explicitly below.
--
-- NOTHING IS BACKFILLED. A booking already made was agreed at the price it was
-- agreed at, and re-splitting a season of them would change what people were
-- told they owed. Every historic row keeps the booker's whole-table share and
-- an opponent share of zero, which is exactly what was true at the time.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-a-table-is-split.sql.

begin;

-- ------------------------------------------------- 1. the second seat's half

alter table public.club_bookings
  add column if not exists opponent_base_price   numeric(10,2) not null default 0,
  add column if not exists opponent_tier_key     text,
  add column if not exists opponent_tier_label   text not null default '',
  add column if not exists opponent_tier_discount_percent smallint not null default 0,
  add column if not exists opponent_tier_discount_amount  numeric(10,2) not null default 0,
  add column if not exists opponent_total_price  numeric(10,2) not null default 0,
  add column if not exists opponent_payment_status text not null default 'unpaid',
  add column if not exists opponent_payment_method text not null default '',
  add column if not exists opponent_payment_note   text not null default '',
  add column if not exists opponent_paid_at        timestamptz;

do $$
begin
  alter table public.club_bookings
    add constraint club_bookings_opponent_payment_status_check
    check (opponent_payment_status in ('unpaid', 'paid_on_the_door', 'paid_in_advance'));
exception when duplicate_object then null;
end $$;

comment on column public.club_bookings.base_price is
  'The BOOKER''S share of the table since 0221, not the table''s own price.';
comment on column public.club_bookings.opponent_base_price is
  'The second seat''s share. Zero where nobody else is on the table.';

-- The payments list filters on either side being unpaid, and a club a few
-- seasons in has thousands of rows.
create index if not exists club_bookings_club_opponent_payment_idx
  on public.club_bookings (club_id, opponent_payment_status, session_date desc);

-- --------------------------------------------- 2. both halves, on both paths
--
-- One function, fired on INSERT and on any change of who is sitting at the
-- table, so the club's picker, the member's own opponent field and a
-- looking-for-game table all reach it without anybody remembering to call
-- something. That is the same reasoning the loyalty awards and the booking
-- notices already give, and it lets `edit_booking_details` drop its own copy
-- of the pricing rule below — two readings of one rule is the mistake this
-- codebase keeps having to undo.

create or replace function public.club_bookings_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table     numeric(10,2);
  v_away      uuid;
  v_two       boolean;
  v_home_base numeric(10,2);
  v_away_base numeric(10,2);
  v_home_pct  smallint;
  v_away_pct  smallint;
  v_wanted    integer := greatest(0, coalesce(new.loyalty_points_spent, 0));
  v_cap_pct   smallint := 0;
  v_point_val numeric(10,4);
  v_balance   integer := 0;
  v_used      integer := 0;
  v_off       numeric(10,2) := 0;
begin
  select coalesce(s.table_booking_price, 5.00), coalesce(s.price_currency, 'GBP')
    into v_table, new.price_currency
    from public.club_booking_settings s where s.club_id = new.club_id;
  v_table := coalesce(v_table, 5.00);
  new.price_currency := coalesce(new.price_currency, 'GBP');

  -- Money already recorded is never re-priced. On an update that means a side
  -- somebody has been marked as paying, and a booker who has spent points:
  -- both are amounts that were agreed and acted on, and moving them underneath
  -- the person who settled them is worse than a table that is split a little
  -- late. The club's own picker can still move the people.
  if tg_op = 'UPDATE'
     and (old.payment_status <> 'unpaid'
          or old.opponent_payment_status <> 'unpaid'
          or coalesce(old.loyalty_points_spent, 0) > 0) then
    return new;
  end if;

  v_away := coalesce(new.opponent_profile_id, new.accepted_by);
  -- A guest counts. They were named, they are playing, and the club collects
  -- their half at the door the same as anybody's.
  v_two  := v_away is not null or btrim(coalesce(new.opponent_name, '')) <> '';

  -- Half each, with the odd penny falling to whoever booked it so the two
  -- halves add back to the table's own price exactly. A table nobody else is
  -- on is the booker's whole table, which is what they are reserving.
  if v_two then
    v_home_base := round(v_table / 2, 2);
    v_away_base := v_table - v_home_base;
  else
    v_home_base := v_table;
    v_away_base := 0;
  end if;

  v_home_pct := public.booking_discount_percent(new.club_id, new.booked_by);
  v_away_pct := case when v_away is null then 0
                     else public.booking_discount_percent(new.club_id, v_away) end;

  new.base_price            := v_home_base;
  new.tier_discount_percent := v_home_pct;
  new.tier_discount_amount  := round(v_home_base * v_home_pct / 100.0, 2);

  new.opponent_base_price            := v_away_base;
  new.opponent_tier_discount_percent := v_away_pct;
  new.opponent_tier_discount_amount  := round(v_away_base * v_away_pct / 100.0, 2);
  new.opponent_total_price := greatest(v_away_base - new.opponent_tier_discount_amount, 0);

  select m.tier_key, coalesce(t.label, '')
    into new.membership_tier_key, new.membership_tier_label
    from public.club_memberships m
    left join public.club_membership_tiers t
      on t.club_id = m.club_id and t.tier_key = m.tier_key
   where m.club_id = new.club_id and m.profile_id = new.booked_by
     and m.status = 'approved'
   limit 1;
  new.membership_tier_label := coalesce(new.membership_tier_label, '');

  new.opponent_tier_key := null;
  new.opponent_tier_label := '';
  if v_away is not null then
    select m.tier_key, coalesce(t.label, '')
      into new.opponent_tier_key, new.opponent_tier_label
      from public.club_memberships m
      left join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = new.club_id and m.profile_id = v_away
       and m.status = 'approved'
     limit 1;
    new.opponent_tier_label := coalesce(new.opponent_tier_label, '');
  end if;

  -- Points are the booker's, spent against the booker's own share, and only
  -- ever on the way in: the guard above means an update never reaches here
  -- with any spent.
  if v_wanted > 0 then
    select coalesce(least(100, greatest(0,
             (t.benefits ->> 'loyaltyRedemptionCapPercent')::smallint)), 0)
      into v_cap_pct
      from public.club_memberships m
      join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = new.club_id and m.profile_id = new.booked_by
       and m.status = 'approved'
     limit 1;

    select s.point_value into v_point_val
      from public.club_loyalty_settings s
     where s.club_id = new.club_id and s.enabled;

    if v_point_val is null or v_point_val <= 0 or coalesce(v_cap_pct, 0) <= 0 then
      raise exception 'NO_REDEMPTION' using errcode = 'check_violation';
    end if;

    select coalesce(sum(l.available_delta), 0) into v_balance
      from public.club_loyalty_transactions l
     where l.club_id = new.club_id and l.profile_id = new.booked_by;

    if v_wanted > v_balance then
      raise exception 'NOT_ENOUGH_POINTS' using errcode = 'check_violation';
    end if;

    v_used := least(v_wanted, floor(
      greatest(v_home_base - new.tier_discount_amount, 0) * v_cap_pct / 100.0 / v_point_val));
    v_off  := round(v_used * v_point_val, 2);
  end if;

  new.loyalty_points_spent    := v_used;
  new.loyalty_discount_amount := v_off;
  new.total_price := greatest(v_home_base - new.tier_discount_amount - v_off, 0);

  return new;
end;
$$;

-- The trigger follows the people now. 0043's fired on insert alone, which was
-- right while only the booker's tier decided anything. Same name, so there is
-- one trigger here rather than two racing to price the same row.
drop trigger if exists club_bookings_price on public.club_bookings;
create trigger club_bookings_price
  before insert or update of booked_by, opponent_profile_id, opponent_name, accepted_by
  on public.club_bookings
  for each row execute function public.club_bookings_price();

-- --------------------------------------------------- 3. the stamp, both ways

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
  return new;
end;
$$;

drop trigger if exists club_bookings_payment on public.club_bookings;
create trigger club_bookings_payment
  before update of payment_status, opponent_payment_status on public.club_bookings
  for each row execute function public.club_bookings_payment_stamp();

-- ------------------------------------------ 4. recording it, per person
--
-- `p_side` is the whole of item gg's second half: "member A may have paid
-- their half, but member B has not". A new argument makes a NEW function in
-- Postgres rather than replacing the old one, so 0205's four-argument form is
-- dropped — leave it and a caller that forgets to pass a side keeps settling
-- the booker's half quietly.

drop function if exists public.club_set_booking_payment(bigint, text, text, text);

create or replace function public.club_set_booking_payment(
  p_booking bigint,
  p_side    text,
  p_status  text,
  p_method  text default '',
  p_note    text default ''
) returns table (
  booking_id              bigint,
  payment_status          text,
  payment_method          text,
  payment_note            text,
  paid_at                 timestamptz,
  opponent_payment_status text,
  opponent_payment_method text,
  opponent_payment_note   text,
  opponent_paid_at        timestamptz
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
  if p_status not in ('unpaid', 'paid_on_the_door', 'paid_in_advance') then
    raise exception 'BOOKING_PAYMENT_UNKNOWN' using errcode = 'check_violation';
  end if;

  select * into v_row from public.club_bookings b where b.id = p_booking;
  if v_row.id is null then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  v_club := v_row.club_id;

  if not (public.club_can(v_club, 'bookings.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- A cancelled table is not somebody who owes you, so the money on it is not
  -- the club's to keep moving. Same line 0158 drew on a called-off coaching
  -- place, and the reason the To pay tab can be trusted.
  if v_row.status <> 'booked' then
    raise exception 'BOOKING_NOT_LIVE' using errcode = 'check_violation';
  end if;

  -- An empty second seat has no half to settle. Without this a club could
  -- record a payment against nobody and the To pay tab would carry a row with
  -- no name on it.
  if p_side = 'opponent'
     and coalesce(v_row.opponent_profile_id, v_row.accepted_by) is null
     and btrim(coalesce(v_row.opponent_name, '')) = '' then
    raise exception 'BOOKING_NO_OPPONENT' using errcode = 'check_violation';
  end if;

  return query
  update public.club_bookings b
     set payment_status = case when p_side = 'booker' then p_status
                               else b.payment_status end,
         payment_method = case when p_side = 'booker' then btrim(coalesce(p_method, ''))
                               else b.payment_method end,
         payment_note   = case when p_side = 'booker' then btrim(coalesce(p_note, ''))
                               else b.payment_note end,
         opponent_payment_status = case when p_side = 'opponent' then p_status
                                        else b.opponent_payment_status end,
         opponent_payment_method = case when p_side = 'opponent' then btrim(coalesce(p_method, ''))
                                        else b.opponent_payment_method end,
         opponent_payment_note   = case when p_side = 'opponent' then btrim(coalesce(p_note, ''))
                                        else b.opponent_payment_note end
   where b.id = p_booking
  returning b.id, b.payment_status, b.payment_method, b.payment_note, b.paid_at,
            b.opponent_payment_status, b.opponent_payment_method,
            b.opponent_payment_note, b.opponent_paid_at;
end;
$$;

revoke all on function public.club_set_booking_payment(bigint, text, text, text, text)
  from public, anon;
grant execute on function public.club_set_booking_payment(bigint, text, text, text, text)
  to authenticated;

-- ----------------------------------------- 5. the list, one row per person
--
-- "Per member per table" is a different list from the one 0205 built: that
-- was a row per booking, which cannot show that A has paid and B has not.
-- Both functions read a `sides` set rather than the table directly, so the
-- tabs, the counts, the search and the sort all answer about a person's half
-- and cannot drift from each other.
--
-- The second seat only produces a row where somebody is actually on it. A
-- table nobody else has joined is one row, for the whole table, which is what
-- the booker is reserving.
--
-- `returns table` cannot change under `create or replace`, so both drop first
-- and both restate their grants.

drop function if exists public.club_table_bookings(bigint, text, text, text, text, integer, integer);
drop function if exists public.club_table_booking_counts(bigint, text, text);

create or replace function public.club_booking_sides(p_club bigint)
returns table (
  booking_id     bigint,
  side           text,
  person_id      uuid,
  person_name    text,
  against_name   text,
  session_date   date,
  session_label  text,
  session_time   text,
  table_index    smallint,
  game_title     text,
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
  booked_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, 'booker', b.booked_by,
         coalesce(nullif(btrim(p.full_name), ''), 'A member'),
         coalesce(nullif(btrim(o.full_name), ''), nullif(btrim(a.full_name), ''),
                  nullif(btrim(b.opponent_name), ''), ''),
         b.session_date, b.session_label, b.session_time, b.table_index,
         b.game_title, b.status,
         b.payment_status, b.payment_method, b.payment_note, b.paid_at,
         b.base_price, b.membership_tier_label, b.tier_discount_percent,
         b.tier_discount_amount, b.loyalty_points_spent, b.loyalty_discount_amount,
         b.total_price, b.price_currency, b.created_at
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
         b.opponent_total_price, b.price_currency, b.created_at
    from public.club_bookings b
    left join public.profiles p on p.id = b.booked_by
    left join public.profiles o on o.id = b.opponent_profile_id
    left join public.profiles a on a.id = b.accepted_by
   where b.club_id = p_club
     and (coalesce(b.opponent_profile_id, b.accepted_by) is not null
          or btrim(coalesce(b.opponent_name, '')) <> '')
$$;

-- Nobody calls this directly. It is `security definer` because both readers
-- below are, and it carries no guard of its own: granting it would be a way
-- round theirs.
revoke all on function public.club_booking_sides(bigint) from public, anon, authenticated;

create or replace function public.club_table_bookings(
  p_club  bigint,
  p_tab   text default 'all',
  p_query text default '',
  p_month text default '',
  p_sort  text default 'newest',
  p_page  integer default 1,
  p_per   integer default 25
) returns table (
  booking_id     bigint,
  side           text,
  person_id      uuid,
  person_name    text,
  against_name   text,
  session_date   date,
  session_label  text,
  session_time   text,
  table_index    smallint,
  game_title     text,
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
$$;

create or replace function public.club_table_booking_counts(
  p_club bigint, p_query text default '', p_month text default ''
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
  v_month  text := nullif(btrim(coalesce(p_month, '')), '');
begin
  if not (public.club_can(p_club, 'bookings.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select count(*),
         count(*) filter (where s.status = 'booked' and s.payment_status = 'unpaid'
                            and s.total_price > 0),
         count(*) filter (where s.status = 'booked' and s.payment_status <> 'unpaid'),
         count(*) filter (where s.status = 'booked' and s.total_price <= 0),
         count(*) filter (where s.status <> 'booked')
    from public.club_booking_sides(p_club) s
   where (v_month is null or to_char(s.session_date, 'YYYY-MM') = v_month)
     and (v_needle is null
          or s.person_name ilike '%' || v_needle || '%'
          or s.against_name ilike '%' || v_needle || '%'
          or s.game_title ilike '%' || v_needle || '%'
          or s.payment_note ilike '%' || v_needle || '%');
end;
$$;

revoke all on function public.club_table_bookings(bigint, text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.club_table_bookings(bigint, text, text, text, text, integer, integer)
  to authenticated;
revoke all on function public.club_table_booking_counts(bigint, text, text) from public, anon;
grant execute on function public.club_table_booking_counts(bigint, text, text) to authenticated;

-- ---------------------------------- 6. one reading of the rule, not two
--
-- Copied from 0178, its latest definition, with the pricing block taken out
-- and nothing else touched. The signature does not move, so the grant stands.

create or replace function public.edit_booking_details(
  p_booking bigint,
  p_game_title text,
  p_opponent_name text,
  p_notes text,
  p_set_people boolean default false,
  p_booked_by uuid default null,
  p_opponent_id uuid default null,
  -- The member's own door. Null `p_opponent_id` under this flag means "nobody
  -- is down to play me", which is a real thing to save, so the flag is what
  -- says the seat is being set at all. Same reasoning as 0064's own.
  p_set_opponent boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target     public.club_bookings%rowtype;
  v_manages    boolean;
  v_booker     uuid;
  v_opponent   uuid;
  v_name       text;
begin
  if auth.uid() is null then
    raise exception 'BOOKING_NOT_YOURS';
  end if;

  select * into v_target from public.club_bookings where id = p_booking;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_target.status <> 'booked' then
    raise exception 'BOOKING_CANCELLED';
  end if;

  v_manages := public.can_manage_club(v_target.club_id);

  if not v_manages then
    if v_target.booked_by <> auth.uid() then
      raise exception 'BOOKING_NOT_YOURS';
    end if;
    if v_target.session_date <= public.london_today() then
      raise exception 'BOOKING_PAST';
    end if;
  end if;

  if btrim(coalesce(p_game_title, '')) = '' then
    raise exception 'BOOKING_GAME_MISSING';
  end if;

  v_booker   := v_target.booked_by;
  v_opponent := v_target.opponent_profile_id;
  v_name := case
    when v_target.opponent_profile_id is null
      then left(btrim(coalesce(p_opponent_name, '')), 120)
    else v_target.opponent_name
  end;

  -- Both flags at once would be the club's form and the member's form posting
  -- into one call, which cannot be true. Refusing is better than picking one.
  if p_set_people and p_set_opponent then
    raise exception 'BOOKING_SEATS_CONFLICT';
  end if;

  if p_set_opponent then
    if p_opponent_id is not null then
      if p_opponent_id = v_target.booked_by then
        raise exception 'BOOKING_SAME_PERSON';
      end if;
      -- A table is a member benefit at the club it is at, which is the rule
      -- 0064 applies to the club's own picker. A guest is still typed as text.
      if not exists (select 1 from public.club_memberships m
                      where m.club_id = v_target.club_id
                        and m.profile_id = p_opponent_id
                        and m.status = 'approved') then
        raise exception 'BOOKING_OPPONENT_NOT_MEMBER';
      end if;
      -- Somebody may have taken this table off a looking-for-game post, which
      -- is a third seat. Naming them as the opponent as well would put one
      -- person on the booking twice.
      if v_target.accepted_by = p_opponent_id then
        raise exception 'BOOKING_SAME_PERSON';
      end if;
    end if;

    v_opponent := p_opponent_id;
    v_name := case
      when p_opponent_id is null then left(btrim(coalesce(p_opponent_name, '')), 120)
      else coalesce((select nullif(btrim(pr.full_name), '')
                       from public.profiles pr where pr.id = p_opponent_id), 'A member')
    end;
  end if;

  if p_set_people then
    if not v_manages then
      raise exception 'BOOKING_NOT_YOURS';
    end if;
    if p_booked_by is null then
      raise exception 'BOOKING_BOOKER_MISSING';
    end if;
    if not exists (select 1 from public.club_memberships m
                    where m.club_id = v_target.club_id
                      and m.profile_id = p_booked_by
                      and m.status = 'approved') then
      raise exception 'BOOKING_BOOKER_NOT_MEMBER';
    end if;

    if p_opponent_id is not null then
      if p_opponent_id = p_booked_by then
        raise exception 'BOOKING_SAME_PERSON';
      end if;
      if not exists (select 1 from public.club_memberships m
                      where m.club_id = v_target.club_id
                        and m.profile_id = p_opponent_id
                        and m.status = 'approved') then
        raise exception 'BOOKING_OPPONENT_NOT_MEMBER';
      end if;
    end if;

    if v_target.accepted_by is not null
       and v_target.accepted_by in (p_booked_by, coalesce(p_opponent_id, p_booked_by)) then
      raise exception 'BOOKING_SAME_PERSON';
    end if;

    if p_booked_by <> v_target.booked_by
       and coalesce(v_target.loyalty_points_spent, 0) > 0 then
      raise exception 'BOOKING_POINTS_SPENT';
    end if;

    v_booker   := p_booked_by;
    v_opponent := p_opponent_id;
    v_name := case
      when p_opponent_id is null then left(btrim(coalesce(p_opponent_name, '')), 120)
      else coalesce((select nullif(btrim(pr.full_name), '')
                       from public.profiles pr where pr.id = p_opponent_id), 'A member')
    end;
  end if;

  -- No pricing here. 0221 moved it into `club_bookings_price`, which now
  -- fires on any change of who is sitting at the table, so the club's picker,
  -- the member's own opponent field and a looking-for-game table all reach one
  -- reading of the rule. This function used to carry a second copy that priced
  -- the booker's whole table, and under a split fee that copy would have been
  -- wrong the moment it ran.

  begin
    update public.club_bookings
       set game_title           = left(btrim(p_game_title), 120),
           opponent_name        = v_name,
           notes                = left(btrim(coalesce(p_notes, '')), 500),
           booked_by            = v_booker,
           opponent_profile_id  = v_opponent
     where id = p_booking;
  exception when unique_violation then
    raise exception 'BOOKING_CLASH';
  end;
end;
$$;

-- ------------------------------- 7. the accounts count both halves of a table
--
-- `base_price` is the booker's share from here on, so a report that sums it
-- alone is short by every opponent's half. Both functions are copied from
-- 0219, their latest definition, with the tables stream changed and nothing
-- else: the coaching clock that migration moved is carried through unchanged.

create or replace function public.club_analytics_money(
  p_club bigint, p_from date, p_to date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.analytics_allowed(p_club);
  return (
  with
  memberships as (
    select sum(public.money_from_text(price)) as gross
      from public.club_membership_payments
     where club_id = p_club and public.london_day(created_at) between p_from and p_to
  ),
  tables as (
    -- Both halves. 0221 split a table between the people on it, and
    -- `base_price` is the booker's share from then on: summing it alone would
    -- report a club's table income short by every opponent who owes a half.
    select coalesce(sum(total_price + opponent_total_price), 0) as net,
           coalesce(sum(base_price + opponent_base_price), 0) as gross,
           coalesce(sum(loyalty_discount_amount), 0) as loyalty,
           coalesce(sum(tier_discount_amount + opponent_tier_discount_amount), 0) as tier
      from public.club_bookings
     where club_id = p_club and status <> 'cancelled'
       and session_date between p_from and p_to
  ),
  tickets as (
    select coalesce(sum(total), 0) as net,
           coalesce(sum(subtotal), 0) as gross,
           coalesce(sum(loyalty_discount_amount), 0) as loyalty,
           coalesce(sum(tier_discount_amount), 0) as tier
      from public.club_event_bookings
     where club_id = p_club and status <> 'cancelled'
       and public.london_day(created_at) between p_from and p_to
  ),
  shop as (
    select coalesce(sum(total), 0) as net,
           coalesce(sum(subtotal), 0) as gross,
           coalesce(sum(loyalty_discount), 0) as loyalty,
           coalesce(sum(tier_discount_amount), 0) as tier
      from public.club_merchandise_orders
     where club_id = p_club and status <> 'cancelled'
       and public.london_day(created_at) between p_from and p_to
  ),
  coaching as (
    select coalesce(sum(b.total_price), 0) as net,
           coalesce(sum(b.base_price), 0) as gross,
           coalesce(sum(b.loyalty_discount_amount), 0) as loyalty,
           coalesce(sum(b.tier_discount_amount), 0) as tier
      from public.club_coaching_bookings b
      join public.club_coaching_slots s on s.id = b.slot_id
     where s.club_id = p_club and b.status <> 'cancelled'
       -- On the day the place was booked, like the ticket and the order.
       and public.london_day(b.booked_at) between p_from and p_to
  ),
  points as (
    select coalesce(sum(lifetime_delta) filter (where lifetime_delta > 0), 0) as earned,
           coalesce(abs(sum(available_delta) filter (where available_delta < 0)), 0) as spent
      from public.club_loyalty_transactions
     where club_id = p_club and public.london_day(created_at) between p_from and p_to
  )
  select jsonb_build_object(
    'membership', jsonb_build_object('gross', coalesce((select gross from memberships), 0),
                                     'net',   coalesce((select gross from memberships), 0)),
    'tables',     jsonb_build_object('gross', (select gross from tables),
                                     'net',   (select net from tables),
                                     'loyalty', (select loyalty from tables),
                                     'tier',  (select tier from tables)),
    'tickets',    jsonb_build_object('gross', (select gross from tickets),
                                     'net',   (select net from tickets),
                                     'loyalty', (select loyalty from tickets),
                                     'tier',  (select tier from tickets)),
    'shop',       jsonb_build_object('gross', (select gross from shop),
                                     'net',   (select net from shop),
                                     'loyalty', (select loyalty from shop),
                                     'tier',  (select tier from shop)),
    'coaching',   jsonb_build_object('gross', (select gross from coaching),
                                     'net',   (select net from coaching),
                                     'loyalty', (select loyalty from coaching),
                                     'tier',  (select tier from coaching)),
    'points',     jsonb_build_object('earned', (select earned from points),
                                     'spent',  (select spent from points))
  ));
end $$;

create or replace function public.club_analytics_months(
  p_club bigint, p_from date, p_to date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.analytics_allowed(p_club);
  return (
  with
  spans as (
    -- Calendar months, with the first and last CLIPPED to the window. Without
    -- the clip a 90-day window spills into three weeks nobody asked for and
    -- the buckets stop adding up to the figure on the page.
    select m::date as month_start,
           greatest(m::date, p_from) as span_from,
           least((m + interval '1 month' - interval '1 day')::date, p_to) as span_to
      from generate_series(date_trunc('month', p_from),
                           date_trunc('month', p_to), '1 month') as m
  )
  select coalesce(jsonb_agg(row_to_json(x) order by x.month_start), '[]'::jsonb)
    from (
      select s.month_start,
             to_char(s.month_start, 'Mon') as label,
             (select count(*) from public.club_memberships
               where club_id = p_club and status = 'approved'
                 and public.london_day(coalesce(joined_at, created_at))
                     between s.span_from and s.span_to) as new_members,
             (select count(*) from public.club_bookings
               where club_id = p_club and status <> 'cancelled'
                 and session_date between s.span_from and s.span_to) as bookings,
             (select count(*) from public.club_event_bookings
               where club_id = p_club and status <> 'cancelled'
                 and public.london_day(created_at) between s.span_from and s.span_to) as tickets,
             (select count(*) from public.club_discussion_posts
               where club_id = p_club and removed_at is null
                 and public.london_day(created_at) between s.span_from and s.span_to) as posts,

             -- Each stream on its own, reading the same column over the same
             -- dates `club_analytics_money` reads, so a month can be checked
             -- against the page and a year of them can be summed to it.
             coalesce((select sum(public.money_from_text(price))
                         from public.club_membership_payments
                        where club_id = p_club
                          and public.london_day(created_at)
                              between s.span_from and s.span_to), 0) as membership_in,
             -- Both halves, for the reason `club_analytics_money` gives.
             coalesce((select sum(total_price + opponent_total_price)
                         from public.club_bookings
                        where club_id = p_club and status <> 'cancelled'
                          and session_date between s.span_from and s.span_to), 0) as tables_in,
             coalesce((select sum(total) from public.club_event_bookings
                        where club_id = p_club and status <> 'cancelled'
                          and public.london_day(created_at)
                              between s.span_from and s.span_to), 0) as tickets_in,
             coalesce((select sum(total) from public.club_merchandise_orders
                        where club_id = p_club and status <> 'cancelled'
                          and public.london_day(created_at)
                              between s.span_from and s.span_to), 0) as shop_in,
             coalesce((select sum(b.total_price)
                         from public.club_coaching_bookings b
                         join public.club_coaching_slots sl on sl.id = b.slot_id
                        where sl.club_id = p_club and b.status <> 'cancelled'
                          and public.london_day(b.booked_at)
                              between s.span_from and s.span_to), 0) as coaching_in
        from spans s
    ) x);
end $$;

commit;
