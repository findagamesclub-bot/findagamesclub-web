/**
 * Looking back at a club night.
 *
 * Four items from one sitting, and they are one complaint wearing four hats:
 * every screen that lists tables or games shows the newest handful and has no
 * way to ask about a month that has gone by.
 *
 *   21  Table payments has no month or year filter, so "what did we take in
 *       September" is a question the money screen cannot answer.
 *   22  The club's Scores page has no month, game, member or no-score-yet
 *       filter, and reads only the newest forty games.
 *   23  A member's own games carry no date or paid filter.
 *   24  A member cannot look back at the club's past tables at all.
 *
 * The forty and the twenty-five are the real fault underneath 21, 22 and 24: a
 * filter over a window is a filter that answers about the window, and a club a
 * few seasons in has a thousand tables a year. So the month axis arrives with
 * the read it needs rather than on top of one that cannot serve it.
 *
 * Two functions do the work for three of the four screens, which is the point:
 * the club's Scores page and the member's past-nights view are the same rows
 * asked about from two chairs, and writing them twice is how two screens end
 * up disagreeing about what happened on a Thursday.
 */

-- ---------------------------------------------------------------------------
-- 1. What a club actually has to filter by
-- ---------------------------------------------------------------------------

/**
 * The months, games and players this club has bookings for.
 *
 * One read for three dropdowns, and every option is one with something behind
 * it: the roster filters already settled that a dropdown offering a choice
 * that matches nothing is a control pretending to work.
 *
 * Players are the accounts only. A name typed at the door has no id to filter
 * on and is covered by the search box, which is the same line every other
 * screen in this app draws between somebody with an account and a guest.
 *
 * Games come back exactly as they were typed, unfolded. `canonicalGame` folds
 * spellings for a chart, where two bars of one game is wrong; a filter is a
 * question about the rows, and a club seeing "Warhammer 40k" beside
 * "Warhammer 40,000" is being told something true about its own data.
 */
create or replace function public.club_booking_facets(p_club bigint)
returns table (kind text, value text, label text, rows bigint)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  -- A member, because the past-nights view below is theirs to read. `perform`
  -- rather than `select`: 0117 shipped a guard whose result nothing read, the
  -- planner dropped it, and a stranger read a club's takings.
  if not (public.is_club_member(p_club)
          or public.club_can(p_club, 'bookings.manage')
          or public.club_can(p_club, 'results.manage')
          or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with live as (
    select b.* from public.club_bookings b where b.club_id = p_club
  )
  select 'month'::text,
         to_char(l.session_date, 'YYYY-MM'),
         to_char(l.session_date, 'YYYY-MM'),
         count(*)
    from live l
   group by 1, 2, 3
  union all
  select 'game'::text, btrim(l.game_title), btrim(l.game_title), count(*)
    from live l
   where btrim(coalesce(l.game_title, '')) <> ''
   group by 1, 2, 3
  union all
  select 'player'::text, p.id::text,
         coalesce(nullif(btrim(p.full_name), ''), 'A member'), count(*)
    from (
      select l.booked_by as id from live l where l.booked_by is not null
      union all
      select l.opponent_profile_id from live l where l.opponent_profile_id is not null
      union all
      select l.accepted_by from live l where l.accepted_by is not null
    ) seats
    join public.profiles p on p.id = seats.id
   group by 1, 2, 3
   order by 1, 4 desc, 3;
end;
$$;

revoke all on function public.club_booking_facets(bigint) from public, anon;
grant execute on function public.club_booking_facets(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Item 21 · the money screen gains a month
-- ---------------------------------------------------------------------------

-- A new parameter makes a NEW function in Postgres rather than replacing the
-- old one, and a caller that forgets to pass the month would keep resolving to
-- the six-argument version and quietly answer about every night there has ever
-- been. Eighth time, after 0136, 0165, 0171, 0178, 0186, 0187 and 0188.
drop function if exists public.club_table_bookings(bigint, text, text, text, integer, integer);
drop function if exists public.club_table_booking_counts(bigint, text);

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
  v_month  text := nullif(btrim(coalesce(p_month, '')), '');
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
       and (v_month is null or to_char(b.session_date, 'YYYY-MM') = v_month)
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

revoke all on function public.club_table_bookings(bigint, text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.club_table_bookings(bigint, text, text, text, text, integer, integer)
  to authenticated;

/**
 * The five tab counts, narrowed by the same search AND the same month.
 *
 * "To pay 3" under September has to mean three in September, which is 0118's
 * rule arriving on a second axis: a count that ignores a filter the list
 * obeys is a number somebody chases the wrong people with.
 */
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
         count(*) filter (where b.status = 'booked' and b.payment_status = 'unpaid'
                            and b.total_price > 0),
         count(*) filter (where b.status = 'booked' and b.payment_status <> 'unpaid'),
         count(*) filter (where b.status = 'booked' and b.total_price <= 0),
         count(*) filter (where b.status <> 'booked')
    from public.club_bookings b
    left join public.profiles p on p.id = b.booked_by
    left join public.profiles o on o.id = b.opponent_profile_id
   where b.club_id = p_club
     and (v_month is null or to_char(b.session_date, 'YYYY-MM') = v_month)
     and (v_needle is null
          or p.full_name ilike '%' || v_needle || '%'
          or o.full_name ilike '%' || v_needle || '%'
          or b.opponent_name ilike '%' || v_needle || '%'
          or b.game_title ilike '%' || v_needle || '%'
          or b.payment_note ilike '%' || v_needle || '%');
end;
$$;

revoke all on function public.club_table_booking_counts(bigint, text, text) from public, anon;
grant execute on function public.club_table_booking_counts(bigint, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Items 22 and 24 · one log of what was played, read from two chairs
-- ---------------------------------------------------------------------------

/**
 * Every table at this club that has already happened.
 *
 * The club's Scores page and a member's past-nights view are the same rows
 * asked about from two chairs, so they are one function. Two would drift, and
 * the first thing they would disagree about is what happened on a Thursday.
 *
 * It cannot be a select for a member. `club_bookings_select` (0014) shows a
 * club member only FUTURE bookings of other people, which is the right default
 * for the table and exactly wrong for a page whose job is looking back. Same
 * reasoning 0056 wrote down for one member's own record, widened to the club's
 * night: what is readable here is who played whom and what the score was,
 * which is already public on the club's results page.
 *
 * Nothing about money comes back. That is `bookings.manage`'s question and it
 * has its own screen above.
 */
create or replace function public.club_played_log(
  p_club   bigint,
  p_state  text default 'all',
  p_month  text default '',
  p_game   text default '',
  p_member text default '',
  p_query  text default '',
  p_sort   text default 'newest',
  p_page   integer default 1,
  p_per    integer default 25
) returns table (
  booking_id    bigint,
  session_date  date,
  session_time  text,
  session_label text,
  table_index   smallint,
  game_title    text,
  home_id       uuid,
  home_name     text,
  away_id       uuid,
  away_name     text,
  -- `club_bookings` scores are numeric(6,1), not integers. A `returns table`
  -- whose types do not match raises "structure of query does not match
  -- function result type", which names the column and not the reason.
  home_score    numeric(6,1),
  away_score    numeric(6,1),
  home_army     text,
  away_army     text,
  mission       text,
  deployment    text,
  terrain       text,
  confirmation  text,
  recorded      boolean,
  total_rows    bigint
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_needle text := nullif(btrim(coalesce(p_query, '')), '');
  v_month  text := nullif(btrim(coalesce(p_month, '')), '');
  v_game   text := nullif(btrim(coalesce(p_game, '')), '');
  v_member uuid := nullif(btrim(coalesce(p_member, '')), '')::uuid;
  v_from   integer := greatest(0, (greatest(1, coalesce(p_page, 1)) - 1) * greatest(1, coalesce(p_per, 25)));
begin
  if not (public.is_club_member(p_club)
          or public.club_can(p_club, 'results.manage')
          or public.club_can(p_club, 'bookings.manage')
          or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with rows as (
    select b.id, b.session_date, b.session_time, b.session_label, b.table_index,
           coalesce(nullif(btrim(b.game_title), ''), '') as game,
           b.booked_by as home,
           coalesce(nullif(btrim(k.full_name), ''), 'A member') as home_name,
           -- Whoever took the table off a looking-for-a-game post sits in the
           -- opponent's seat, the same as every other reader of this table.
           coalesce(b.accepted_by, b.opponent_profile_id) as away,
           coalesce(nullif(btrim(a.full_name), ''), nullif(btrim(o.full_name), ''),
                    nullif(btrim(b.opponent_name), ''), 'an opponent') as away_name,
           b.booked_by_score, b.opponent_score,
           coalesce(b.booked_by_army, '') as home_army,
           coalesce(b.opponent_army, '') as away_army,
           btrim(coalesce(b.result_mission, '')) as mission,
           btrim(coalesce(b.result_deployment, '')) as deployment,
           btrim(coalesce(b.result_terrain, '')) as terrain,
           -- Anything the column does not hold reads as submitted, which is
           -- what `toConfirmation` answers on the other side of the wire.
           case when btrim(coalesce(b.result_confirmation, '')) in
                     ('submitted', 'confirmed', 'disputed', 'admin-confirmed')
                then btrim(b.result_confirmation) else 'submitted' end as confirmation,
           (b.booked_by_score is not null) as recorded
      from public.club_bookings b
      left join public.profiles k on k.id = b.booked_by
      left join public.profiles o on o.id = b.opponent_profile_id
      left join public.profiles a on a.id = b.accepted_by
     where b.club_id = p_club
       and b.status = 'booked'
       -- A night still to come is a booking, not a game. The Scores page has
       -- drawn that line since it was written and the member's view keeps it.
       and b.session_date <= public.london_today()
       and (v_month is null or to_char(b.session_date, 'YYYY-MM') = v_month)
       and (v_game is null or btrim(coalesce(b.game_title, '')) = v_game)
       and (v_member is null
            or b.booked_by = v_member
            or b.opponent_profile_id = v_member
            or b.accepted_by = v_member)
       and (v_needle is null
            or k.full_name ilike '%' || v_needle || '%'
            or o.full_name ilike '%' || v_needle || '%'
            or a.full_name ilike '%' || v_needle || '%'
            or b.opponent_name ilike '%' || v_needle || '%'
            or b.game_title ilike '%' || v_needle || '%')
  ),
  grouped as (
    select r.*,
           case
             when not r.recorded then 'unscored'
             when r.confirmation = 'disputed' then 'disputed'
             when r.confirmation = 'admin-confirmed' then 'settled'
             else 'waiting'
           end as state
      from rows r
  )
  select g.id, g.session_date, g.session_time, g.session_label, g.table_index,
         g.game, g.home, g.home_name, g.away, g.away_name,
         g.booked_by_score, g.opponent_score, g.home_army, g.away_army,
         g.mission, g.deployment, g.terrain, g.confirmation, g.recorded,
         count(*) over () as total_rows
    from grouped g
   where p_state is null or p_state = 'all' or g.state = p_state
   order by
     case when p_sort = 'oldest' then g.session_date end asc,
     case when p_sort = 'oldest' then g.table_index end asc,
     case when p_sort not in ('oldest') then g.session_date end desc,
     case when p_sort = 'oldest' then g.id end asc,
     g.id desc
   offset v_from limit greatest(1, coalesce(p_per, 25));
end;
$$;

revoke all on function public.club_played_log(bigint, text, text, text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.club_played_log(bigint, text, text, text, text, text, text, integer, integer)
  to authenticated;

/**
 * The five groups, counted under whatever the other filters are.
 *
 * They partition: a game has no score, or it is waiting on the club, or the
 * players disagree, or the club has settled it. The page's own "waiting on
 * you" figure is the middle two added up, which is one fact at two levels of
 * detail rather than two figures that can disagree.
 */
create or replace function public.club_played_log_counts(
  p_club   bigint,
  p_month  text default '',
  p_game   text default '',
  p_member text default '',
  p_query  text default ''
) returns table (
  all_rows  bigint,
  unscored  bigint,
  waiting   bigint,
  disputed  bigint,
  settled   bigint
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_needle text := nullif(btrim(coalesce(p_query, '')), '');
  v_month  text := nullif(btrim(coalesce(p_month, '')), '');
  v_game   text := nullif(btrim(coalesce(p_game, '')), '');
  v_member uuid := nullif(btrim(coalesce(p_member, '')), '')::uuid;
begin
  if not (public.is_club_member(p_club)
          or public.club_can(p_club, 'results.manage')
          or public.club_can(p_club, 'bookings.manage')
          or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with rows as (
    select (b.booked_by_score is not null) as recorded,
           case when btrim(coalesce(b.result_confirmation, '')) in
                     ('submitted', 'confirmed', 'disputed', 'admin-confirmed')
                then btrim(b.result_confirmation) else 'submitted' end as confirmation
      from public.club_bookings b
      left join public.profiles k on k.id = b.booked_by
      left join public.profiles o on o.id = b.opponent_profile_id
      left join public.profiles a on a.id = b.accepted_by
     where b.club_id = p_club
       and b.status = 'booked'
       and b.session_date <= public.london_today()
       and (v_month is null or to_char(b.session_date, 'YYYY-MM') = v_month)
       and (v_game is null or btrim(coalesce(b.game_title, '')) = v_game)
       and (v_member is null
            or b.booked_by = v_member
            or b.opponent_profile_id = v_member
            or b.accepted_by = v_member)
       and (v_needle is null
            or k.full_name ilike '%' || v_needle || '%'
            or o.full_name ilike '%' || v_needle || '%'
            or a.full_name ilike '%' || v_needle || '%'
            or b.opponent_name ilike '%' || v_needle || '%'
            or b.game_title ilike '%' || v_needle || '%')
  )
  select count(*),
         count(*) filter (where not r.recorded),
         count(*) filter (where r.recorded and r.confirmation not in ('disputed', 'admin-confirmed')),
         count(*) filter (where r.recorded and r.confirmation = 'disputed'),
         count(*) filter (where r.recorded and r.confirmation = 'admin-confirmed')
    from rows r;
end;
$$;

revoke all on function public.club_played_log_counts(bigint, text, text, text, text)
  from public, anon;
grant execute on function public.club_played_log_counts(bigint, text, text, text, text)
  to authenticated;

-- The month axis is the one every screen above now sorts and filters on, and
-- `club_bookings_club_payment_idx` is keyed on the payment status first, so it
-- cannot serve a plain "this club, this month" read.
create index if not exists club_bookings_club_date_idx
  on public.club_bookings (club_id, session_date desc, id desc);

-- ---------------------------------------------------------------------------
-- 4. Item 23 · a member can see which of their own tables are settled
-- ---------------------------------------------------------------------------

/**
 * What the club has recorded against this reader's own tables.
 *
 * `security invoker`, deliberately, where everything else in this file is a
 * definer: row security already says who may read a booking, and a definer
 * here would mean writing that rule out a second time for nothing. The same
 * call 0141 made about `meta_member`, and it is not a contradiction of the
 * two above: those read PAST bookings of other people, which the policy hides
 * on purpose.
 *
 * It exists at all because `payment_status` arrived in 0205 and
 * `src/types/database.ts` has not been regenerated since 0151, so
 * `check:columns` is right to refuse a select naming it.
 */
create or replace function public.my_booking_payments(p_bookings bigint[])
returns table (booking_id bigint, payment_status text, paid_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select b.id, b.payment_status, b.paid_at
    from public.club_bookings b
   where b.id = any(coalesce(p_bookings, '{}'::bigint[]));
$$;

revoke all on function public.my_booking_payments(bigint[]) from public, anon;
grant execute on function public.my_booking_payments(bigint[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The Scores page keeps its chart, and the chart keeps meaning something
-- ---------------------------------------------------------------------------

/**
 * Ruled, waiting and unscored per month, for the club's own trend.
 *
 * The chart was worked out from the forty games the page had loaded, which
 * was close enough while the page WAS those forty games. It is not any more:
 * a chart built from one page of twenty-five would redraw itself every time
 * somebody changed a filter, and a club that has let the queue build since
 * spring could not see that from it.
 *
 * Every month the club has played in, oldest first, which is the order a
 * trend is read in. `countByMonth` fills the gaps on the other side of the
 * wire; the empty ones are deliberately not rows here, because "no games in
 * August" is a fact about the calendar rather than one about the club.
 */
create or replace function public.club_played_months(p_club bigint)
returns table (month text, ruled bigint, waiting bigint, unscored bigint)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not (public.club_can(p_club, 'results.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select to_char(b.session_date, 'YYYY-MM'),
         count(*) filter (where b.booked_by_score is not null
                            and btrim(coalesce(b.result_confirmation, '')) = 'admin-confirmed'),
         count(*) filter (where b.booked_by_score is not null
                            and btrim(coalesce(b.result_confirmation, '')) <> 'admin-confirmed'),
         count(*) filter (where b.booked_by_score is null)
    from public.club_bookings b
   where b.club_id = p_club
     and b.status = 'booked'
     and b.session_date <= public.london_today()
   group by 1
   order by 1;
end;
$$;

revoke all on function public.club_played_months(bigint) from public, anon;
grant execute on function public.club_played_months(bigint) to authenticated;
