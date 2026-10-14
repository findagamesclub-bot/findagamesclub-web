-- 0187 · who is on which tier, and what sells
--
-- The client:
--
--   8. "On the Membership tab of Analytics, can we show a graph and count of
--      all members under each membership tier, and loyalty tier, with options
--      to show by each time period?"
--   9. "Can we add into analytics reports on coaching and merchandise/shop,
--      such as most popular products, most popular coaching events?"
--
-- `club_analytics_memberships` has returned `byTier` since 0117 and ONLY THE
-- SPREADSHEET EVER READ IT. The tab drew three tiles and the tier split went
-- into the CSV, so a club could download the answer and not see it. Ninth time
-- this revision has turned up something built with nothing on top of it.
--
-- THE WINDOW MEANS "JOINED", NOT "ON". A tier count is a snapshot and every
-- window on this page ends today, so making the count itself follow the window
-- would have returned the same figure for all five and quietly made the picker
-- do nothing. The count of who is on a tier NOW is one question and how many
-- arrived on it inside the window is another, so both come back and the page
-- labels them apart. That is what makes the picker mean something here.
--
-- THE LOYALTY LADDER IS NOT COMPUTED IN SQL. `tierFor` in TypeScript is the
-- one implementation of which rung a total reaches, and the ladder itself is
-- the club's own jsonb, editable since the loyalty editor landed. A second
-- copy of it here would be a second thing to get wrong, and the two would only
-- ever disagree on a member's own page. So this returns the lifetime totals
-- and the caller puts them on the ladder it already reads. Same call 0156
-- made, for the same reason.

create or replace function public.club_analytics_memberships(
  p_club bigint, p_from date default null, p_to date default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_from date := coalesce(p_from, public.london_today() - 36500);
  v_to   date := coalesce(p_to, public.london_today());
begin
  perform public.analytics_allowed(p_club);
  return (
  with
  live as (
    select m.id, m.profile_id, m.tier_key,
           coalesce(nullif(m.tier_key, ''), 'none') as tier,
           public.london_day(coalesce(m.joined_at, m.created_at)) as joined_on,
           (select max(p.period_end_at::date)
              from public.club_membership_payments p
             where p.membership_id = m.id
               and p.tier_key is not distinct from m.tier_key) as paid_to
      from public.club_memberships m
     where m.club_id = p_club and m.status = 'approved'
  ),
  labels as (
    -- The club's own name for the tier, not its key. A roster reading
    -- "premium-membership" is the database talking to itself.
    select t.tier_key, coalesce(nullif(btrim(t.label), ''), t.tier_key) as label
      from public.club_membership_tiers t where t.club_id = p_club
  ),
  loyalty as (
    select l.profile_id, sum(l.lifetime_delta) as lifetime
      from public.club_loyalty_transactions l
     where l.club_id = p_club
       and l.profile_id in (select profile_id from live)
     group by l.profile_id
  )
  select jsonb_build_object(
    'byTier', coalesce((
      select jsonb_agg(row_to_json(t) order by t.members desc, t.tier)
        from (
          select v.tier,
                 coalesce(lb.label, initcap(replace(v.tier, '-', ' '))) as label,
                 count(*) as members,
                 count(*) filter (where v.joined_on between v_from and v_to) as joined
            from live v
            left join labels lb on lb.tier_key = v.tier
           group by v.tier, lb.label) t), '[]'::jsonb),

    -- One number per member on the roster, zero included: somebody who has
    -- never earned a point is on the bottom rung rather than absent from the
    -- ladder, and a club reading "nobody is on Bronze" would be reading a
    -- missing row rather than a fact.
    'lifetime', coalesce((
      select jsonb_agg(coalesce(ly.lifetime, 0) order by coalesce(ly.lifetime, 0) desc)
        from live v left join loyalty ly on ly.profile_id = v.profile_id), '[]'::jsonb),

    'dueSoon',  (select count(*) from live
                  where paid_to is not null
                    and paid_to between public.london_today()
                                    and public.london_today() + 30),
    'lapsed',   (select count(*) from live
                  where paid_to is not null and paid_to < public.london_today()),
    'neverPaid',(select count(*) from live where paid_to is null),
    'total',    (select count(*) from live),
    'joined',   (select count(*) from live where joined_on between v_from and v_to)
  ));
end $$;

-- ------------------------------------------------------- what actually sells
--
-- A ranking, not money: the Money in tab already answers what came in, and
-- "most popular" is a different question from "most valuable". Both figures
-- come back anyway, because a club deciding what to restock wants to know when
-- the two disagree.
--
-- Cancelled orders and cancelled places are out of both, the same rule every
-- other report here follows.

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
    -- On the slot's own date, matching the money report: coaching counts on
    -- the night it runs and not on the day somebody booked it.
    select s.title as label,
           count(*) as booked,
           coalesce(sum(b.total_price), 0) as revenue
      from public.club_coaching_bookings b
      join public.club_coaching_slots s on s.id = b.slot_id
     where s.club_id = p_club and b.status <> 'cancelled'
       and s.slot_date between p_from and p_to
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

revoke all on function public.club_analytics_memberships(bigint, date, date) from public, anon;
revoke all on function public.club_analytics_sales(bigint, date, date) from public, anon;
grant execute on function public.club_analytics_memberships(bigint, date, date) to authenticated;
grant execute on function public.club_analytics_sales(bigint, date, date) to authenticated;

-- 0117's no-argument version has to go, or a caller that forgets the window
-- keeps the old one and the tab goes on showing a figure nobody picked. Same
-- reasoning 0186 gives for dropping the month-count months function; a default
-- parameter makes a NEW function rather than replacing the old one.
drop function if exists public.club_analytics_memberships(bigint);

-- ---------------------------------------------- what a club has actually used
--
-- The client, on item 11: "Is the AI API usage cost applicable for club
-- owners? As it will be set and monitored by admin in terms of usage and cost,
-- and we will only have a single API key."
--
-- No, and the club console was saying otherwise. It read "AI THIS MONTH
-- £0.00" under the army settings, which is a bill shown to somebody who is not
-- being billed. A pound sign is a claim about who owes money, and the only
-- people it is true for are us.
--
-- So the club sees what it used and how much of its allowance is left, and the
-- money stays on the admin's own usage screen, where `admin_ai_usage` already
-- reports it. The cap is unchanged and still does its job: one club cannot
-- burn the shared key.

create or replace function public.club_ai_usage(p_club bigint)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  -- The same guard the analytics use. A club's own usage is the club's to see
  -- and nobody else's, and this reads past RLS to count it.
  perform public.analytics_allowed(p_club);
  return (
    select jsonb_build_object(
      'runs', coalesce((
        select count(*) from public.army_ai_jobs j
         where j.club_id = p_club and j.status = 'succeeded'
           and j.created_at >= date_trunc('month', public.london_today()::timestamptz)), 0),
      'members', coalesce((
        select count(distinct j.profile_id) from public.army_ai_jobs j
         where j.club_id = p_club and j.status = 'succeeded'
           and j.created_at >= date_trunc('month', public.london_today()::timestamptz)), 0),
      -- A share of the allowance rather than the allowance itself. The cap is
      -- in pence because that is what the provider charges in, and handing a
      -- club a figure in pence is the thing this is here to stop.
      'usedPercent', (
        select case when coalesce(s.monthly_ai_cap_pence, 0) > 0
                    then least(100, floor(
                      public.ai_month_spend(p_club) * 100
                      / s.monthly_ai_cap_pence))::int
                    else null end
          from public.club_army_builder_settings s where s.club_id = p_club)
    ));
end $$;

revoke all on function public.club_ai_usage(bigint) from public, anon;
grant execute on function public.club_ai_usage(bigint) to authenticated;
