-- 0117 · What the club has to show for itself
--
-- The client asked for "club dashboard and reporting (see local app for full
-- details on all reporting)", so legacy is the spec:
-- `_build_owner_dashboard_for_club` (club_store.py:4453), about 1,190 lines
-- building 24 sections. These functions are that, in SQL, so the page reads it
-- in one wave rather than pulling a year of rows into Node and counting them
-- there. At a club a few seasons in that is the difference between a page and
-- a download.
--
-- Five functions rather than twenty-four, because each round trip to Supabase
-- costs about 300ms whatever it asks for, and the page wants one wave.
--
-- Every one is guarded by `club_can(club, 'analytics.view')`, which is owner
-- and manager but not helper. Definer, so the guard is the authority rather
-- than whichever policy happens to cover the table being counted.
--
-- Two things about the money worth knowing before reading the sums:
--
--   - `club_membership_payments.price` is TEXT, holding "£10" and the like,
--     because legacy stored the display string. It is parsed here rather than
--     cast, and anything unparseable counts as zero rather than failing the
--     whole report.
--   - Every other total is a numeric in POUNDS, not pence. The billing tables
--     added in Stage 5 are the only ones in pence, and they are not in here.
--
-- Checked on a throwaway Postgres: each function refuses a stranger and a
-- helper, answers for an owner and a manager, counts only the club asked for,
-- respects the window, and returns zeroes rather than nulls on a club with no
-- history at all.

/** Money out of legacy's display string. "£10" is 10, "" and "free" are 0. */
create or replace function public.money_from_text(p_value text)
returns numeric language sql immutable as $$
  select coalesce(
    nullif(regexp_replace(coalesce(p_value, ''), '[^0-9.]', '', 'g'), '')::numeric,
    0)
$$;

grant execute on function public.money_from_text(text) to authenticated;

/**
 * The guard every function here opens with.
 *
 * Volatile on purpose. As a `stable` function whose result nothing reads, the
 * planner dropped the call and every one of these answered a stranger. Found by
 * the behaviour test, not by reading: the SQL looked exactly right.
 */
create or replace function public.analytics_allowed(p_club bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.club_can(p_club, 'analytics.view') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
end $$;

revoke all on function public.analytics_allowed(bigint) from public, anon;
grant execute on function public.analytics_allowed(bigint) to authenticated;

-- ------------------------------------------------------------ the headline

/**
 * The counts, for a window.
 *
 * Legacy's `overview` and `memberHealth` blocks. Active means somebody who did
 * anything at all: booked a table, bought a ticket, posted or replied. A club
 * reading "12 active" wants the people who turned up, not the people on the
 * list.
 */
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
       and created_at::date between p_from and p_to
  ),
  posts as (
    select author_profile_id as profile_id from public.club_discussion_posts
     where club_id = p_club and removed_at is null
       and created_at::date between p_from and p_to
  ),
  replies as (
    select r.author_profile_id as profile_id from public.club_discussion_replies r
      join public.club_discussion_posts p on p.id = r.post_id
     where p.club_id = p_club and r.removed_at is null
       and r.created_at::date between p_from and p_to
  ),
  active as (
    select distinct profile_id from (
      select profile_id from tables union all
      select profile_id from tickets union all
      select profile_id from posts   union all
      select profile_id from replies
    ) all_of_it where profile_id is not null
  )
  select jsonb_build_object(
    'members',        (select count(*) from roster),
    'newMembers',     (select count(*) from public.club_memberships
                        where club_id = p_club and status = 'approved'
                          and coalesce(joined_at, created_at)::date between p_from and p_to),
    'activeMembers',  (select count(*) from active),
    'tableBookings',  (select count(*) from tables),
    'eventTickets',   (select count(*) from tickets),
    'posts',          (select count(*) from posts),
    'replies',        (select count(*) from replies),
    -- The rate legacy shows, and the working behind it, because "44%" on its
    -- own invites "out of what".
    'activeRate',     case when (select count(*) from roster) > 0
                        then round((select count(*) from active)::numeric
                                   / (select count(*) from roster) * 100, 1)
                        else 0 end
  ));
end $$;

revoke all on function public.club_analytics_summary(bigint, date, date) from public, anon;
grant execute on function public.club_analytics_summary(bigint, date, date) to authenticated;

-- ---------------------------------------------------------------- the money

/**
 * What came in, and what the discounts cost.
 *
 * The client asked for "revenue, sales this month, and sales after loyalty
 * discounts", so gross and net are both here rather than one figure that hides
 * the other. Four streams, because a club that cannot see which one is earning
 * cannot do anything about it.
 */
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
     where club_id = p_club and created_at::date between p_from and p_to
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
       and created_at::date between p_from and p_to
  ),
  shop as (
    select coalesce(sum(total), 0) as net,
           coalesce(sum(subtotal), 0) as gross,
           coalesce(sum(loyalty_discount), 0) as loyalty,
           coalesce(sum(tier_discount_amount), 0) as tier
      from public.club_merchandise_orders
     where club_id = p_club and status <> 'cancelled'
       and created_at::date between p_from and p_to
  ),
  points as (
    select coalesce(sum(lifetime_delta) filter (where lifetime_delta > 0), 0) as earned,
           coalesce(abs(sum(available_delta) filter (where available_delta < 0)), 0) as spent
      from public.club_loyalty_transactions
     where club_id = p_club and created_at::date between p_from and p_to
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

revoke all on function public.club_analytics_money(bigint, date, date) from public, anon;
grant execute on function public.club_analytics_money(bigint, date, date) to authenticated;

-- --------------------------------------------------------------- the people

/**
 * Who is turning up, and who has stopped.
 *
 * Legacy's leaderboards, plus the one the client named outright: "members whose
 * activity has dropped off". Drop-off is somebody who was active in the window
 * before this one and has done nothing in this one, which is a different and
 * more useful question than "who has never done anything".
 */
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
    select profile_id, created_at::date from public.club_event_bookings
     where club_id = p_club and status <> 'cancelled'
    union all
    select author_profile_id, created_at::date from public.club_discussion_posts
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

revoke all on function public.club_analytics_people(bigint, date, date) from public, anon;
grant execute on function public.club_analytics_people(bigint, date, date) to authenticated;

-- ---------------------------------------------------- the nights and events

/**
 * Which nights fill, what gets played, and how events sold.
 *
 * "Attendance per club night" and "event sales against capacity" are both the
 * client's words. Sell-through is taken against the ticket type's own
 * `quantity_available`,
 * because a club setting 40 places and selling 12 needs to see 30%, not 12.
 */
create or replace function public.club_analytics_nights(
  p_club bigint, p_from date, p_to date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.analytics_allowed(p_club);
  return (
  select jsonb_build_object(
    'nights', coalesce((
      select jsonb_agg(row_to_json(n) order by n.bookings desc, n.label)
        from (
          select coalesce(nullif(b.session_label, ''), b.session_day, 'A night') as label,
                 count(*) as bookings
            from public.club_bookings b
           where b.club_id = p_club and b.status <> 'cancelled'
             and b.session_date between p_from and p_to
           group by 1 order by 2 desc limit 5
        ) n), '[]'::jsonb),
    'weekdays', coalesce((
      select jsonb_agg(row_to_json(d) order by d.position)
        from (
          select to_char(b.session_date, 'Dy') as label,
                 extract(isodow from b.session_date)::int as position,
                 count(*) as bookings
            from public.club_bookings b
           where b.club_id = p_club and b.status <> 'cancelled'
             and b.session_date between p_from and p_to
           group by 1, 2 order by 2
        ) d), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(row_to_json(g) order by g.played desc, g.label)
        from (
          select coalesce(nullif(b.game_title, ''), 'Not said') as label, count(*) as played
            from public.club_bookings b
           where b.club_id = p_club and b.status <> 'cancelled'
             and b.session_date between p_from and p_to
           group by 1 order by 2 desc limit 5
        ) g), '[]'::jsonb),
    -- Against the places the club actually put on sale, not against what sold.
    'sellThrough', coalesce((
      select jsonb_agg(row_to_json(s) order by s.starts desc)
        from (
          select e.title as label, e.start_date as starts,
                 coalesce(sum(t.quantity_available), 0) as places,
                 (select count(*) from public.club_event_bookings eb
                   where eb.event_id = e.id and eb.status <> 'cancelled') as sold
            from public.club_events e
            left join public.club_event_ticket_types t on t.event_id = e.id
           where e.club_id = p_club and e.status = 'published'
             and e.start_date between p_from and p_to
           group by e.id, e.title, e.start_date
           order by e.start_date desc limit 5
        ) s), '[]'::jsonb)
  ));
end $$;

revoke all on function public.club_analytics_nights(bigint, date, date) from public, anon;
grant execute on function public.club_analytics_nights(bigint, date, date) to authenticated;

-- ------------------------------------------------------------ over the year

/**
 * A row per month, for the trends.
 *
 * Built from a generated series rather than from the rows, so a month with
 * nothing in it is a zero on the chart instead of a gap. Legacy draws its
 * timelines the same way and for the same reason: a line that skips August
 * reads as a quiet August rather than a missing one.
 *
 * Legacy carries three separate range pickers (signups, revenue trend, revenue
 * mix), so this takes the number of months and the page asks three times with
 * different numbers. One global picker would have been simpler and would have
 * taken away a real thing: reading revenue over a year while reading signups
 * over three months.
 */
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
                 and coalesce(joined_at, created_at)::date
                     between s.month_start and s.month_end) as new_members,
             (select count(*) from public.club_bookings
               where club_id = p_club and status <> 'cancelled'
                 and session_date between s.month_start and s.month_end) as bookings,
             (select count(*) from public.club_event_bookings
               where club_id = p_club and status <> 'cancelled'
                 and created_at::date between s.month_start and s.month_end) as tickets,
             (select count(*) from public.club_discussion_posts
               where club_id = p_club and removed_at is null
                 and created_at::date between s.month_start and s.month_end) as posts,
             (
               coalesce((select sum(total_price) from public.club_bookings
                          where club_id = p_club and status <> 'cancelled'
                            and session_date between s.month_start and s.month_end), 0)
             + coalesce((select sum(total) from public.club_event_bookings
                          where club_id = p_club and status <> 'cancelled'
                            and created_at::date between s.month_start and s.month_end), 0)
             + coalesce((select sum(total) from public.club_merchandise_orders
                          where club_id = p_club and status <> 'cancelled'
                            and created_at::date between s.month_start and s.month_end), 0)
             + coalesce((select sum(public.money_from_text(price))
                           from public.club_membership_payments
                          where club_id = p_club
                            and created_at::date between s.month_start and s.month_end), 0)
             ) as revenue
        from spans s
    ) m);
end $$;

revoke all on function public.club_analytics_months(bigint, integer) from public, anon;
grant execute on function public.club_analytics_months(bigint, integer) to authenticated;

-- -------------------------------------------------------- membership health

/**
 * By tier, and who is due.
 *
 * "Membership by tier, lapsed and due to renew" is the client's line. Due is
 * read off the payment that covers them: somebody whose period ends inside the
 * next thirty days is due, and somebody whose period has already ended is
 * lapsed. A membership nobody has ever paid for counts as neither, because
 * chasing a free tier for money is how a club annoys its own members.
 */
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
           (select max(p.period_end_at::date)
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

revoke all on function public.club_analytics_memberships(bigint) from public, anon;
grant execute on function public.club_analytics_memberships(bigint) to authenticated;
