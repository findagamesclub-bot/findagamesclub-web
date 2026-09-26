/**
 * 0123 · A club day is a London day, in SQL as well as in TypeScript
 *
 * `london_today()` has always been `(now() at time zone 'Europe/London')::date`.
 * Every other cast in the analytics functions was a bare `created_at::date`,
 * which reads the *session's* timezone: UTC on Supabase, and whatever the
 * machine happens to be set to anywhere else.
 *
 * So the window was built from London days and the rows were bucketed by UTC
 * days. Through BST those differ for a whole hour: a ticket bought at 00:30 on
 * the 1st of a month in London is 23:30 on the last of the month in UTC, so it
 * landed in the wrong month and dropped out of a "this month" window entirely.
 *
 * Found by the behaviour suite rather than by reading. The throwaway harness
 * runs in the machine's own zone (Asia/Karachi, UTC+5), which turns a one-hour
 * edge into a five-hour one and made a seeded ticket vanish from a window it
 * was plainly inside. **That is the argument for not running tests in UTC.**
 *
 * `london_day()` is the fix and the name: one place that knows, and a cast that
 * says which day it means.
 */

create or replace function public.london_day(p_at timestamptz)
returns date
language sql
immutable
set search_path = public
as $$ select (p_at at time zone 'Europe/London')::date $$;

comment on function public.london_day(timestamptz) is
  'The London calendar day a timestamp falls on. Use this, never a bare ::date.';

revoke all on function public.london_day(timestamptz) from public, anon;
grant execute on function public.london_day(timestamptz) to authenticated, service_role;

create or replace function public.club_analytics_summary(
  p_club bigint, p_from date, p_to date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.analytics_allowed(p_club);
  return (
  with
  roster as (
    select profile_id from public.club_memberships
     where club_id = p_club and status = 'approved'
  ),
  tables as (
    select booked_by as profile_id from public.club_bookings
     where club_id = p_club and status <> 'cancelled'
       and session_date between p_from and p_to
  ),
  tickets as (
    select profile_id from public.club_event_bookings
     where club_id = p_club and status <> 'cancelled'
       and public.london_day(created_at) between p_from and p_to
  ),
  posts as (
    select author_profile_id as profile_id from public.club_discussion_posts
     where club_id = p_club and removed_at is null
       and public.london_day(created_at) between p_from and p_to
  ),
  replies as (
    select r.author_profile_id as profile_id from public.club_discussion_replies r
      join public.club_discussion_posts p on p.id = r.post_id
     where p.club_id = p_club and r.removed_at is null
       and public.london_day(r.created_at) between p_from and p_to
  ),
  active as (
    select distinct profile_id from (
      select profile_id from tables union all
      select profile_id from tickets union all
      select profile_id from posts   union all
      select profile_id from replies
    ) all_of_it where profile_id is not null
  ),
  -- The split. `in (select ...)` rather than a join, so somebody with two
  -- memberships at the same club cannot be counted twice.
  active_members as (
    select profile_id from active
     where profile_id in (select profile_id from roster)
  ),
  active_visitors as (
    select profile_id from active
     where profile_id not in (select profile_id from roster
                               where profile_id is not null)
  )
  select jsonb_build_object(
    'members',        (select count(*) from roster),
    'newMembers',     (select count(*) from public.club_memberships
                        where club_id = p_club and status = 'approved'
                          and public.london_day(coalesce(joined_at, created_at)) between p_from and p_to),
    'activeMembers',  (select count(*) from active_members),
    'activeVisitors', (select count(*) from active_visitors),
    'tableBookings',  (select count(*) from tables),
    'eventTickets',   (select count(*) from tickets),
    'posts',          (select count(*) from posts),
    'replies',        (select count(*) from replies),
    -- The rate legacy shows, and the working behind it, because "44%" on its
    -- own invites "out of what". Members over the roster: both sides of the
    -- division are now the same population, which is what makes it a rate.
    'activeRate',     case when (select count(*) from roster) > 0
                        then round((select count(*) from active_members)::numeric
                                   / (select count(*) from roster) * 100, 1)
                        else 0 end
  ));
end $$;

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
    'points',     jsonb_build_object('earned', (select earned from points),
                                     'spent',  (select spent from points))
  ));
end $$;

create or replace function public.club_analytics_people(
  p_club bigint, p_from date, p_to date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.analytics_allowed(p_club);
  return (
  with
  span as (select (p_to - p_from) as days),
  roster as (
    select m.profile_id, coalesce(p.full_name, 'A member') as name
      from public.club_memberships m
      left join public.profiles p on p.id = m.profile_id
     where m.club_id = p_club and m.status = 'approved'
  ),
  doings as (
    select booked_by as profile_id, session_date as on_day from public.club_bookings
     where club_id = p_club and status <> 'cancelled'
    union all
    select profile_id, public.london_day(created_at) from public.club_event_bookings
     where club_id = p_club and status <> 'cancelled'
    union all
    select author_profile_id, public.london_day(created_at) from public.club_discussion_posts
     where club_id = p_club and removed_at is null
  ),
  now_window as (
    select profile_id, count(*) as n from doings
     where on_day between p_from and p_to and profile_id is not null
     group by profile_id
  ),
  before_window as (
    select profile_id, count(*) as n from doings, span
     where on_day between (p_from - span.days - 1) and (p_from - 1)
       and profile_id is not null
     group by profile_id
  )
  select jsonb_build_object(
    'mostActive', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'value', w.n)
                       order by w.n desc, r.name)
        from now_window w join roster r on r.profile_id = w.profile_id
       limit 5), '[]'::jsonb),
    -- Busy before, silent now. The club can still reach these people.
    'droppedOff', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'value', b.n)
                       order by b.n desc, r.name)
        from before_window b
        join roster r on r.profile_id = b.profile_id
       where not exists (select 1 from now_window w where w.profile_id = b.profile_id)
       limit 5), '[]'::jsonb),
    -- On the list and never seen in the window at all.
    'dormant', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'value', 0) order by r.name)
        from roster r
       where not exists (select 1 from now_window w where w.profile_id = r.profile_id)
       limit 5), '[]'::jsonb),
    'droppedOffCount', (
      select count(*) from before_window b
       where not exists (select 1 from now_window w where w.profile_id = b.profile_id)),
    'dormantCount', (
      select count(*) from roster r
       where not exists (select 1 from now_window w where w.profile_id = r.profile_id))
  ));
end $$;

create or replace function public.club_analytics_months(
  p_club bigint, p_months integer default 12
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.analytics_allowed(p_club);
  return (
  with
  months as (
    select generate_series(
      date_trunc('month', public.london_today())
        - ((greatest(least(coalesce(p_months, 12), 36), 1) - 1) || ' months')::interval,
      date_trunc('month', public.london_today()),
      '1 month')::date as month_start
  ),
  spans as (
    select month_start,
           (month_start + interval '1 month' - interval '1 day')::date as month_end
      from months
  )
  select coalesce(jsonb_agg(row_to_json(m) order by m.month_start), '[]'::jsonb)
    from (
      select s.month_start,
             to_char(s.month_start, 'Mon') as label,
             (select count(*) from public.club_memberships
               where club_id = p_club and status = 'approved'
                 and public.london_day(coalesce(joined_at, created_at))
                     between s.month_start and s.month_end) as new_members,
             (select count(*) from public.club_bookings
               where club_id = p_club and status <> 'cancelled'
                 and session_date between s.month_start and s.month_end) as bookings,
             (select count(*) from public.club_event_bookings
               where club_id = p_club and status <> 'cancelled'
                 and public.london_day(created_at) between s.month_start and s.month_end) as tickets,
             (select count(*) from public.club_discussion_posts
               where club_id = p_club and removed_at is null
                 and public.london_day(created_at) between s.month_start and s.month_end) as posts,
             (
               coalesce((select sum(total_price) from public.club_bookings
                          where club_id = p_club and status <> 'cancelled'
                            and session_date between s.month_start and s.month_end), 0)
             + coalesce((select sum(total) from public.club_event_bookings
                          where club_id = p_club and status <> 'cancelled'
                            and public.london_day(created_at) between s.month_start and s.month_end), 0)
             + coalesce((select sum(total) from public.club_merchandise_orders
                          where club_id = p_club and status <> 'cancelled'
                            and public.london_day(created_at) between s.month_start and s.month_end), 0)
             + coalesce((select sum(public.money_from_text(price))
                           from public.club_membership_payments
                          where club_id = p_club
                            and public.london_day(created_at) between s.month_start and s.month_end), 0)
             ) as revenue
        from spans s
    ) m);
end $$;

create or replace function public.club_analytics_memberships(p_club bigint)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.analytics_allowed(p_club);
  return (
  with
  live as (
    select m.id, m.profile_id, m.tier_key,
           coalesce(nullif(m.tier_key, ''), 'none') as tier,
           (select max(public.london_day(p.period_end_at))
              from public.club_membership_payments p
             where p.membership_id = m.id
               and p.tier_key is not distinct from m.tier_key) as paid_to
      from public.club_memberships m
     where m.club_id = p_club and m.status = 'approved'
  )
  select jsonb_build_object(
    'byTier', coalesce((
      select jsonb_agg(row_to_json(t) order by t.members desc, t.tier)
        from (select tier, count(*) as members from live group by tier) t), '[]'::jsonb),
    'dueSoon',  (select count(*) from live
                  where paid_to is not null
                    and paid_to between public.london_today()
                                    and public.london_today() + 30),
    'lapsed',   (select count(*) from live
                  where paid_to is not null and paid_to < public.london_today()),
    'neverPaid',(select count(*) from live where paid_to is null),
    'total',    (select count(*) from live)
  ));
end $$;

revoke all on function public.club_analytics_summary(bigint, date, date) from public, anon;
revoke all on function public.club_analytics_money(bigint, date, date) from public, anon;
revoke all on function public.club_analytics_people(bigint, date, date) from public, anon;
revoke all on function public.club_analytics_months(bigint, integer) from public, anon;
revoke all on function public.club_analytics_memberships(bigint) from public, anon;

grant execute on function public.club_analytics_summary(bigint, date, date) to authenticated;
grant execute on function public.club_analytics_money(bigint, date, date) to authenticated;
grant execute on function public.club_analytics_people(bigint, date, date) to authenticated;
grant execute on function public.club_analytics_months(bigint, integer) to authenticated;
grant execute on function public.club_analytics_memberships(bigint) to authenticated;
