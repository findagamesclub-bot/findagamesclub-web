-- 0191 · How the site itself is doing
--
-- The client's words: *"there are no analytics or dashboards for the site admin
-- currently. Admin would require their own set of analytics and dashboards to
-- track overall club listing and events growth over time periods, revenue
-- growth by revenue type e.g listing fee or featured listing fee etc."*
--
-- Every club has had a dashboard since 0117. The site has had a count of how
-- many clubs exist and nothing about whether that number is moving.
--
-- **Growth is a comparison, not a number.** A figure on its own says what is
-- there; growth says what it was. So the summary returns every figure twice,
-- once for the window and once for the window of the same length before it,
-- and the screen reads them as a pair. A dashboard that shows "41 clubs" and
-- calls it growth is showing a measurement.
--
-- **The two revenue streams are not the same kind of money, and the screen has
-- to say so.** A listing fee is a payment somebody recorded: it has a
-- `paid_at`, a method and a reference. A featured slot is a placement booked at
-- a price, settled offline, with no payment row at all — 0161 decided that on
-- purpose and nothing has ever written `listing_payments.kind = 'featured'`
-- despite the check constraint allowing it. Adding them into one figure
-- silently would be the page inventing a receipt. They are counted from their
-- own dates for the same reason: a fee lands when it was paid, a slot when it
-- starts.
--
-- **Clubs are dated the way 0188 sorts them**: `coalesce(legacy_created_at,
-- created_at)`. Every club that came across from legacy was inserted on one
-- afternoon, so `created_at` alone would draw a spike in the month of the
-- import and call it the best month the site ever had.
--
-- **Every date goes through `london_day`.** 0123 paid for the bare `::date`
-- once already: a session runs in UTC, the windows are London days, and
-- something created at 00:30 on the 1st in London lands in the previous month.
--
-- **The buckets are clipped to the window**, which is 0186's rule: a month
-- column that runs past the end of the window sums to more than the headline
-- it sits under, and the client found that version by adding the columns up.

create or replace function public.admin_growth_months(
  p_from date, p_to date
) returns table (
  month_start date,
  clubs_listed integer,
  events_added integer,
  accounts_joined integer,
  listing_pence bigint,
  featured_pence bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with spans as (
    -- One row per calendar month the window touches, each clipped to the
    -- window's own ends. Without the clipping the first and last columns run
    -- outside it and the chart stops adding up to the figures above it.
    select m::date as month_start,
           greatest(m::date, p_from) as span_from,
           least((m + interval '1 month' - interval '1 day')::date, p_to) as span_to
      from generate_series(date_trunc('month', p_from::timestamp),
                           date_trunc('month', p_to::timestamp),
                           '1 month') as m
  )
  select s.month_start,
         (select count(*) from public.clubs c
           where public.london_day(coalesce(c.legacy_created_at, c.created_at))
                 between s.span_from and s.span_to)::integer,
         (select count(*) from public.club_events e
           where public.london_day(e.created_at)
                 between s.span_from and s.span_to)::integer,
         (select count(*) from public.profiles p
           where public.london_day(p.created_at)
                 between s.span_from and s.span_to)::integer,
         -- Money received: a listing payment carries the day it was paid.
         coalesce((select sum(l.amount_pence) from public.listing_payments l
                    where l.kind = 'subscription'
                      and public.london_day(l.paid_at)
                          between s.span_from and s.span_to), 0)::bigint,
         -- Money booked: a featured slot is sold for a run of dates and
         -- settled offline, so it counts on the day the run starts.
         coalesce((select sum(f.price_pence) from public.featured_listings f
                    where f.starts_on between s.span_from and s.span_to), 0)::bigint
    from spans s
   order by s.month_start;
end $$;

/**
 * The same five figures for the window, for the window before it, and the
 * running totals as they stand.
 *
 * The window before is the same length ending the day the current one begins,
 * so "3 months" is compared against the three months before those and not
 * against a calendar quarter. A comparison whose two halves are different
 * lengths is worse than none.
 */
create or replace function public.admin_growth_summary(
  p_from date, p_to date
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days integer := greatest((p_to - p_from), 0);
  v_prev_to date := p_from - 1;
  v_prev_from date := p_from - 1 - v_days;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return jsonb_build_object(
    'window', public.admin_growth_slice(p_from, p_to),
    'before', public.admin_growth_slice(v_prev_from, v_prev_to),
    'beforeFrom', v_prev_from,
    'beforeTo', v_prev_to,
    -- Where the site stands today, which no window can answer: a run of
    -- months says how fast it is filling and not how full it is.
    'now', jsonb_build_object(
      'clubs', (select count(*) from public.clubs),
      'liveClubs', (select count(*) from public.clubs where status = 'active'),
      'accounts', (select count(*) from public.profiles),
      'upcomingEvents', (select count(*) from public.club_events
                          where status = 'published'
                            and start_date >= public.london_today())
    )
  );
end $$;

/**
 * One window's five figures.
 *
 * Its own function because the summary needs it twice and a copied block is
 * two readings of one rule: the first time they drift, the comparison is
 * against something measured differently from the thing it is comparing.
 *
 * No admin gate of its own. It is revoked from everybody, has no grant, and is
 * only ever reached through `admin_growth_summary`, which has one.
 */
create or replace function public.admin_growth_slice(
  p_from date, p_to date
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'clubsListed', (select count(*) from public.clubs c
                     where public.london_day(coalesce(c.legacy_created_at, c.created_at))
                           between p_from and p_to),
    'eventsAdded', (select count(*) from public.club_events e
                     where public.london_day(e.created_at) between p_from and p_to),
    'accountsJoined', (select count(*) from public.profiles p
                        where public.london_day(p.created_at) between p_from and p_to),
    'listingPence', coalesce((select sum(l.amount_pence) from public.listing_payments l
                               where l.kind = 'subscription'
                                 and public.london_day(l.paid_at)
                                     between p_from and p_to), 0),
    'featuredPence', coalesce((select sum(f.price_pence) from public.featured_listings f
                                where f.starts_on between p_from and p_to), 0)
  );
$$;

revoke all on function public.admin_growth_months(date, date) from public, anon;
revoke all on function public.admin_growth_summary(date, date) from public, anon;
revoke all on function public.admin_growth_slice(date, date)
  from public, anon, authenticated;
grant execute on function public.admin_growth_months(date, date) to authenticated;
grant execute on function public.admin_growth_summary(date, date) to authenticated;
