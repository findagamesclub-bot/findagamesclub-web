/**
 * What a member actually agreed to pay, and who they are playing.
 *
 * The client's words, across five numbered items on one page: *"please check
 * all these cases where we show pricing, as it is not consistent when
 * membership or loyalty discounts are applied."*
 *
 * Every paid thing in this app already freezes the whole sum at the moment
 * somebody commits. The checkout screens show all of it; the screens
 * afterwards showed a bare total, or in coaching's case the slot's own list
 * price. **The figures were never missing. The reads were.**
 *
 * Table bookings, merchandise and event tickets all fixed with a column list,
 * because `src/types/database.ts` already knows those columns. Coaching could
 * not be: 0157 added seven money columns to `club_coaching_bookings` and the
 * generated types have never been regenerated since, so `check:columns` is
 * right to refuse a select naming them. That is the whole reason this file
 * exists, and it is the shape 0158 already used for the club's own list.
 *
 * The second half is the client's 11g: *"when a member edits a booking, they
 * should be able to also change opponent. Currently, they can only change the
 * game and notes."*
 */

-- ------------------------------------- which tier a session was priced at --

-- 0157 froze six figures onto a coaching booking and not the one word that
-- names them. Every sibling carries it: `club_bookings` (0014),
-- `club_event_bookings` (0015) and `club_merchandise_orders` (0038) all store
-- `membership_tier_label`, so their breakdowns read "Premium Membership
-- discount · 10%" and coaching's would have read "Member discount · 10%".
--
-- Existing rows keep an empty label on purpose. Filling it from the member's
-- tier TODAY would rewrite history the moment somebody upgraded, which is the
-- whole reason these columns are frozen at all; an unnamed discount is true,
-- and a wrongly named one is not.
alter table public.club_coaching_bookings
  add column if not exists membership_tier_label text not null default '';

create or replace function public.club_coaching_bookings_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot      public.club_coaching_slots%rowtype;
  v_base      numeric(10,2);
  v_pct       smallint;
  v_wanted    integer := greatest(0, coalesce(new.loyalty_points_spent, 0));
  v_cap_pct   smallint := 0;
  v_point_val numeric(10,4);
  v_balance   integer := 0;
  v_used      integer := 0;
  v_off       numeric(10,2) := 0;
  v_payable   numeric(10,2);
  v_label     text := '';
begin
  if new.status <> 'booked' then
    return new;
  end if;

  select * into v_slot from public.club_coaching_slots where id = new.slot_id;
  if v_slot.id is null then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'check_violation';
  end if;

  v_base := public.price_from_text(v_slot.price);
  v_pct  := public.coaching_discount_percent(v_slot.club_id, new.profile_id);

  select coalesce(t.label, '') into v_label
    from public.club_memberships m
    join public.club_membership_tiers t
      on t.club_id = m.club_id and t.tier_key = m.tier_key
   where m.club_id = v_slot.club_id and m.profile_id = new.profile_id
     and m.status = 'approved'
   limit 1;

  new.base_price            := v_base;
  new.price_currency        := 'GBP';
  new.tier_discount_percent := v_pct;
  new.tier_discount_amount  := round(v_base * v_pct / 100.0, 2);
  new.membership_tier_label := coalesce(v_label, '');
  v_payable                 := greatest(v_base - new.tier_discount_amount, 0);

  if v_wanted > 0 then
    if v_payable <= 0 then
      raise exception 'NOTHING_TO_PAY' using errcode = 'check_violation';
    end if;

    select coalesce(least(100, greatest(0,
             (t.benefits ->> 'loyaltyRedemptionCapPercent')::smallint)), 0)
      into v_cap_pct
      from public.club_memberships m
      join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = v_slot.club_id and m.profile_id = new.profile_id
       and m.status = 'approved'
     limit 1;

    select s.point_value into v_point_val
      from public.club_loyalty_settings s
     where s.club_id = v_slot.club_id and s.enabled;

    if v_point_val is null or v_point_val <= 0 or coalesce(v_cap_pct, 0) <= 0 then
      raise exception 'NO_REDEMPTION' using errcode = 'check_violation';
    end if;

    select coalesce(sum(l.available_delta), 0) into v_balance
      from public.club_loyalty_transactions l
     where l.club_id = v_slot.club_id and l.profile_id = new.profile_id;

    if v_wanted > v_balance then
      raise exception 'NOT_ENOUGH_POINTS' using errcode = 'check_violation';
    end if;

    v_used := least(v_wanted,
                    floor(round(v_payable * v_cap_pct / 100.0, 2) / v_point_val)::integer);
    if v_used <= 0 then
      raise exception 'OVER_REDEMPTION_CAP' using errcode = 'check_violation';
    end if;
    v_off := round(v_used * v_point_val, 2);
  end if;

  new.loyalty_points_spent    := v_used;
  new.loyalty_discount_amount := v_off;
  new.total_price             := greatest(v_payable - v_off, 0);

  return new;
end;
$$;

revoke all on function public.club_coaching_bookings_price() from public, anon, authenticated;

-- -------------------------------------------- the member's own coaching --

/**
 * A member's coaching bookings, with what each one came to.
 *
 * `security invoker`, so `club_coaching_bookings`' own select policy decides
 * what comes back and this function writes no second copy of that rule. The
 * caller filtering on their own id is belt and braces for the same reason
 * `moderation_flags` does it: that policy also admits the club's team.
 */
create or replace function public.my_coaching_bookings()
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

-- --------------------------------------- and the club's, with the money --

-- 0158 returned the base price, the points spent and the total, which is
-- enough to chase somebody and not enough to explain a figure: the club's own
-- list could say £50 was owed on a session the member had been given 10% off.
-- `create or replace` cannot change a `returns table` signature, so this drops
-- first, and the grant goes with the function and has to be restated.
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

-- ------------------------------------------- a member changes who they play --

/**
 * The opponent seat, for the member whose booking it is.
 *
 * 0064 gave the club both seats and gave a member neither, on the reasoning
 * that "handing their table to somebody else, or taking one, is the club's to
 * do". That is right about the **booker** and wrong about the opponent: the
 * person you are playing changes when your friend cannot make it, which is an
 * ordinary Tuesday and not a thing to email the club about.
 *
 * So the booker seat stays the club's and the opponent seat opens, under its
 * own flag. `p_set_people` is untouched and still refuses anybody who cannot
 * manage the club, because the two are genuinely different permissions and
 * folding them into one would have widened the booker seat by accident.
 *
 * Nothing is repriced. A table is priced off the booker's tier (0043), and the
 * booker is exactly what this cannot change.
 */
drop function if exists public.edit_booking_details(
  bigint, text, text, text, boolean, uuid, uuid);

create function public.edit_booking_details(
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
  v_base       numeric(10,2);
  v_pct        smallint;
  v_discount   numeric(10,2);
  v_tier_key   text;
  v_tier_label text;
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

  if p_set_people and v_booker <> v_target.booked_by then
    select coalesce(s.table_booking_price, 5.00) into v_base
      from public.club_booking_settings s where s.club_id = v_target.club_id;
    v_base := coalesce(v_base, 5.00);

    v_pct := public.booking_discount_percent(v_target.club_id, v_booker);
    v_discount := round(v_base * v_pct / 100.0, 2);

    select m.tier_key, coalesce(t.label, '')
      into v_tier_key, v_tier_label
      from public.club_memberships m
      left join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = v_target.club_id and m.profile_id = v_booker
       and m.status = 'approved'
     limit 1;
  end if;

  begin
    update public.club_bookings
       set game_title           = left(btrim(p_game_title), 120),
           opponent_name        = v_name,
           notes                = left(btrim(coalesce(p_notes, '')), 500),
           booked_by            = v_booker,
           opponent_profile_id  = v_opponent,
           base_price            = coalesce(v_base, base_price),
           tier_discount_percent = coalesce(v_pct, tier_discount_percent),
           tier_discount_amount  = coalesce(v_discount, tier_discount_amount),
           membership_tier_key   = case when v_base is null then membership_tier_key
                                        else v_tier_key end,
           membership_tier_label = case when v_base is null then membership_tier_label
                                        else coalesce(v_tier_label, '') end,
           total_price = case
             when v_base is null then total_price
             else greatest(v_base - v_discount
                             - coalesce(v_target.loyalty_discount_amount, 0), 0)
           end
     where id = p_booking;
  exception when unique_violation then
    raise exception 'BOOKING_CLASH';
  end;
end;
$$;

revoke all on function public.edit_booking_details(
  bigint, text, text, text, boolean, uuid, uuid, boolean) from public, anon;
grant execute on function public.edit_booking_details(
  bigint, text, text, text, boolean, uuid, uuid, boolean) to authenticated;

-- --------------------------------- which term an upgrade is being asked on --

/**
 * A tier is not one price, and a request for one was.
 *
 * The client's words: *"when a member is requesting an upgrade on the tier of
 * their membership, they should be able to choose which payment term they are
 * wanting. Currently it only shows one price, and not all payment options for
 * that next tier e.g monthly, yearly, one off."*
 *
 * 9a made a tier carry a list of billing options and derived its headline from
 * the first of them. The upgrade request never caught up: it stored the tier
 * and nothing else, so a club approving one had to guess whether the member
 * meant £15 a month or £150 a year, and the member had no way to say.
 *
 * The option is stored by its **label**, not its id. A club editing its
 * pricing rewrites the options wholesale (`save_club_tiers`), so an id is a
 * pointer into a list that may not exist by the time the owner reads the
 * request, while the words the member was shown stay true.
 */
alter table public.club_memberships
  add column if not exists requested_billing_label text not null default '';

-- A default parameter makes a NEW function rather than replacing the old one,
-- so this drops first. Fifth time, after 0136, 0165, 0171 and this file's own
-- `edit_booking_details`.
drop function if exists public.request_tier_upgrade(bigint, text);

create function public.request_tier_upgrade(
  membership bigint, wanted text, billing_label text default ''
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.club_memberships%rowtype;
  stamp  timestamptz := now();
begin
  select * into target
    from public.club_memberships
   where id = membership
     and profile_id = auth.uid()
     and status = 'approved';

  if not found then
    raise exception 'No approved membership of yours with that id';
  end if;

  if wanted is not null and wanted = target.tier_key then
    return null;
  end if;

  if wanted is not null and not exists (
    select 1 from public.club_membership_tiers t
     where t.club_id = target.club_id and t.tier_key = wanted
  ) then
    raise exception 'That club does not offer that tier';
  end if;

  update public.club_memberships
     set requested_tier_key = wanted,
         -- Withdrawing clears the term with the tier. A label left behind
         -- would sit on the row describing a request nobody has made.
         requested_billing_label =
           case when wanted is null then '' else left(btrim(coalesce(billing_label, '')), 80) end,
         tier_requested_at  = case when wanted is null then null else stamp end
   where id = membership;

  return case when wanted is null then null else stamp end;
end;
$$;

revoke all on function public.request_tier_upgrade(bigint, text, text) from public, anon;
grant execute on function public.request_tier_upgrade(bigint, text, text) to authenticated;

/**
 * The club's own list of outstanding tier requests.
 *
 * A function rather than two more columns on a select, for the reason
 * `findTierRequests` already carried in a comment: `database.ts` is generated
 * from the live schema and does not know `requested_billing_label`, so
 * `check:columns` refuses a query naming it, and is right to.
 *
 * Definer, guarded on the club, because the roster's own select policy admits
 * an approved member of the club and what somebody asked to pay is the club's
 * business and theirs.
 */
create or replace function public.club_tier_requests(p_club bigint)
returns table (
  membership_id    bigint,
  requested_tier   text,
  requested_label  text,
  requested_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.club_can(p_club, 'members.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select m.id, m.requested_tier_key, m.requested_billing_label, m.tier_requested_at
    from public.club_memberships m
   where m.club_id = p_club
     and m.requested_tier_key is not null;
end;
$$;

revoke all on function public.club_tier_requests(bigint) from public, anon;
grant execute on function public.club_tier_requests(bigint) to authenticated;
