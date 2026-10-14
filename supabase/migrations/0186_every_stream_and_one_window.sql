-- 0186 · every revenue stream, and one window
--
-- Two client reports with one root between them.
--
--   6. "Analytics CSV download, the numbers don't always seem to match what is
--      showing in the analytics."
--   7. "The money in and over the months reports should show all revenue
--      streams, including memberships, table bookings, events, merchandise and
--      coaching."
--
-- COACHING WAS NEVER IN EITHER REPORT. `club_analytics_money` sums
-- memberships, tables, tickets and shop; `club_analytics_months` sums the same
-- four. 0157 gave coaching its own frozen money columns five migrations later
-- and nothing told the accounts. A club selling coaching has been reading a
-- revenue figure that is short by all of it.
--
-- AND THE TWO REPORTS MEASURE DIFFERENT WINDOWS, which is the whole of item 6.
-- The page's money card is `club_analytics_money(club, from, to)` over a
-- ROLLING range: "3 months" is the last 90 days. The CSV behind it is
-- `club_analytics_months(club, months)` over CALENDAR buckets: "3 months" is
-- this month and the two before it. On the 14th of a month those are five
-- weeks apart at the start, so the file and the page were never going to agree
-- and neither was wrong. They cannot be reconciled by a label.
--
-- So the months function takes the same two dates the money function does and
-- clips its first and last buckets to them. The buckets then SUM to the money
-- card for the same window, which is the property the client was checking for
-- and the only one worth having: a figure in a spreadsheet that cannot be
-- traced back to the screen it came from is a figure nobody can file.
--
-- It also returns the streams separately, for the same reason. A single
-- "Revenue" column that disagrees with the page by a tenner tells a treasurer
-- nothing about which tenner.

-- ------------------------------------------------------- 1. money, plus coaching
--
-- Bucketed on the slot's own date rather than when the place was booked,
-- matching table bookings, which count on the night and not on the click.
-- Coaching is paid offline after the session (0159), so the night is when the
-- money is owed.

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
       and s.slot_date between p_from and p_to
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

-- --------------------------------------------- 2. the months, over that window
--
-- A new signature, so the old one has to go: Postgres keeps both otherwise and
-- a caller that forgets to update picks up the month-count version and carries
-- on quietly measuring something else. That is the shape this report is about.

drop function if exists public.club_analytics_months(bigint, integer);

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
                          and sl.slot_date between s.span_from and s.span_to), 0) as coaching_in
        from spans s
    ) x);
end $$;

-- The total is left to the reader rather than returned beside the parts. One
-- place to add them up means the page, the file and the chart cannot disagree
-- about what "revenue" includes the next time a stream is added, which is the
-- mistake this migration exists to correct.

revoke all on function public.club_analytics_money(bigint, date, date) from public, anon;
revoke all on function public.club_analytics_months(bigint, date, date) from public, anon;
grant execute on function public.club_analytics_money(bigint, date, date) to authenticated;
grant execute on function public.club_analytics_months(bigint, date, date) to authenticated;
