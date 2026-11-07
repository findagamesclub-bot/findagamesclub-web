-- 0219 · a coaching place counts on the day it sold
--
-- The client, item p: "please check the analytics for a club and the date
-- filters. For example, I placed a test coaching booking today for Didcot
-- club, and the analytics shows as 0 for this month."
--
-- They are right, and the reason is one line in 0186 and one in 0187: coaching
-- is bucketed on THE SLOT'S OWN DATE. Didcot's only bookable session is in
-- December, so a place sold in November landed in December's figures and "this
-- month" answered nothing. The club did a thing and the report said nothing
-- had happened.
--
-- 0186 put it there deliberately, matching table bookings, and gave its
-- reason: "Coaching is paid offline after the session (0159), so the night is
-- when the money is owed." That does not survive contact with the stream next
-- to it. AN EVENT TICKET IS ALSO PAID ON THE DOOR and has always counted on
-- `created_at`, and so do memberships, merchandise and loyalty. Four of the
-- six streams count when the sale happened; coaching was one of two that did
-- not.
--
-- The Shop and coaching panel was worse, because it measured two clocks inside
-- one box: the merchandise ranking beside it reads `o.created_at`, so "what
-- sold and what was booked, inside the window you picked" meant two different
-- windows depending on which half you were reading. That is item 6 again, and
-- this client has already reported item 6 once.
--
-- So coaching counts on `booked_at`, as a London day, in all three reads that
-- carry it. TABLE BOOKINGS ARE LEFT ALONE: a table is the club's own diary
-- rather than something sold, the Nights tab buckets by the night for that
-- reason, and nobody has reported it.
--
-- Every function here is copied from its latest definition (0186 for the first
-- two, 0187 for the third) with that one line changed, so nothing else can
-- have moved. Same signatures, same shapes, same guard, so the grants stand.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-coaching-counts-when-it-sold.sql.

begin;

-- ------------------------------------------------------------- 1. money in --

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
    select coalesce(sum(total_price), 0) as net,
           coalesce(sum(base_price), 0) as gross,
           coalesce(sum(loyalty_discount_amount), 0) as loyalty,
           coalesce(sum(tier_discount_amount), 0) as tier
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

-- -------------------------------------------- 2. the months behind it --
--
-- The buckets move with the card or the CSV stops summing to the page,
-- which is the one property 0186 exists to give. Only the coaching line
-- changes; `drop` is not needed, the signature is the one 0186 left.

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
             coalesce((select sum(total_price) from public.club_bookings
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

-- --------------------------------------------- 3. what sold, in one window --

create or replace function public.club_analytics_sales(
  p_club bigint, p_from date, p_to date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.analytics_allowed(p_club);
  return (
  with
  items as (
    -- Folded on the item where there is one and on the name where there is
    -- not: an order line keeps the name it was bought under (0038), so a
    -- product renamed since would otherwise split into two rankings.
    select coalesce(i.name, 'An item') as label,
           sum(i.quantity)   as sold,
           sum(i.line_total) as revenue
      from public.club_merchandise_order_items i
      join public.club_merchandise_orders o on o.id = i.order_id
     where o.club_id = p_club and o.status <> 'cancelled'
       and public.london_day(o.created_at) between p_from and p_to
     group by coalesce(i.name, 'An item')
  ),
  sessions as (
    -- The day the place was booked, which is the clock the order ranking
    -- beside it is already counted on. A panel headed "what sold" that
    -- measures two different windows in one box is what this fixes.
    select s.title as label,
           count(*) as booked,
           coalesce(sum(b.total_price), 0) as revenue
      from public.club_coaching_bookings b
      join public.club_coaching_slots s on s.id = b.slot_id
     where s.club_id = p_club and b.status <> 'cancelled'
       and public.london_day(b.booked_at) between p_from and p_to
     group by s.title
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(row_to_json(t) order by t.sold desc, t.label)
        from (select * from items limit 12) t), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(row_to_json(t) order by t.booked desc, t.label)
        from (select * from sessions limit 12) t), '[]'::jsonb),
    'itemsSold',   coalesce((select sum(sold) from items), 0),
    'placesTaken', coalesce((select sum(booked) from sessions), 0)
  ));
end $$;

commit;
