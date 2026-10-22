/**
 * Three things 0213's pickers got wrong, all found by opening them.
 *
 *   i   The months came back ordered by how many bookings each held, so a
 *       club read "Sep 2026 (12), Oct 2026 (7), Aug 2026 (6)". A month list
 *       is scanned by date, never by weight, and ordering it by volume is a
 *       list nobody can find September in without reading all of it.
 *
 *   ii  Games were grouped by exactly what was typed, so "Warhammer 40k (4)"
 *       and "warhammer 40k (3)" sat in the same dropdown as two games. The
 *       comment in 0213 argued the unfolded list is informative, and it is
 *       for two different spellings: a club seeing "Warhammer 40k" beside
 *       "Warhammer 40,000" is being told something true. A pure difference of
 *       CASE is not information, and picking one of the pair showed four of
 *       the seven games that are plainly the same game.
 *
 *   iii The counts belonged to a different question from the screen they were
 *       on. `club_booking_facets` counted every booking, including cancelled
 *       ones and nights still to come, which is right for the money screen
 *       and wrong for the two that list what was PLAYED: the Scores page
 *       offered "Sep 2026 (12)" and then drew three games. The client counts
 *       figures against each other, and this is the fourth screen where two
 *       of them have had to be made to agree.
 */

-- A new parameter makes a NEW function in Postgres rather than replacing the
-- old one. Ninth time, after 0136, 0165, 0171, 0178, 0186, 0187, 0188 and
-- 0213's own two: a caller that forgets the scope would keep resolving to the
-- one-argument version and go on counting the wrong question.
drop function if exists public.club_booking_facets(bigint);

/**
 * The months, games and players a club has to narrow by, counted for the
 * screen that is asking.
 *
 * `p_scope` is 'all' for the money screen, which is about every booking the
 * club has taken, and 'played' for the two that look back, which are about
 * nights that happened. One function either way, because three screens
 * building their own lists is three screens disagreeing about what the club
 * has done; what differs is the question, not the reading.
 */
create or replace function public.club_booking_facets(
  p_club bigint, p_scope text default 'all'
)
returns table (kind text, value text, label text, rows bigint)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  -- A member, because the past-nights view is theirs to read. `perform`
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
    select b.*
      from public.club_bookings b
     where b.club_id = p_club
       -- The same two clauses `club_played_log` draws, so a picker on that
       -- screen cannot offer a month the list underneath it has nothing in.
       and (coalesce(p_scope, 'all') <> 'played'
            or (b.status = 'booked' and b.session_date <= public.london_today()))
  ),
  spellings as (
    select lower(btrim(l.game_title)) as folded,
           btrim(l.game_title)        as typed,
           count(*)                   as held
      from live l
     where btrim(coalesce(l.game_title, '')) <> ''
     group by 1, 2
  ),
  facets as (
    select 'month'::text as kind,
           to_char(l.session_date, 'YYYY-MM') as value,
           to_char(l.session_date, 'YYYY-MM') as label,
           count(*) as rows
      from live l
     group by 1, 2, 3
    union all
    -- Folded on case, and named by the spelling the club uses most. The
    -- filter matches the same way, so picking it finds every game typed with
    -- any capitals.
    select 'game'::text,
           (array_agg(s.typed order by s.held desc, s.typed))[1],
           (array_agg(s.typed order by s.held desc, s.typed))[1],
           -- `sum` over a bigint answers numeric, and a `returns table`
           -- whose types disagree raises "structure of query does not
           -- match function result type" naming the column, not the cause.
           sum(s.held)::bigint
      from spellings s
     group by s.folded
    union all
    -- A name typed at the door has no id to filter on and is covered by the
    -- search box, which is the line every other screen here already draws
    -- between somebody with an account and a guest.
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
  )
  select f.kind, f.value, f.label, f.rows
    from facets f
   order by f.kind,
            -- Months read newest first, because a month list is scanned by
            -- date. Everything else reads most-played first, because a game
            -- or a player list is scanned by weight.
            case when f.kind = 'month' then f.value end desc nulls last,
            f.rows desc,
            f.label;
end;
$$;

revoke all on function public.club_booking_facets(bigint, text) from public, anon;
grant execute on function public.club_booking_facets(bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The game filter matches the way the picker groups
-- ---------------------------------------------------------------------------

/**
 * Both built from 0213's own text with one clause changed, never retyped.
 * `save_pairing_armies` was rebuilt from 0136 while 0163 had already replaced
 * it, and the outcome stamp went missing for a day;
 * grep the whole migrations directory for the function's name first. (And
 * never write a glob inside a block comment here: Postgres nests them, so a
 * slash-star in the middle of a path opens a second comment that nothing
 * closes, and the file fails at its last line with no idea why.)
 *
 * The picker now folds "Warhammer 40k" and "warhammer 40k" into one option,
 * so the filter has to find both or picking that option shows four of the
 * seven games. Case only: two genuinely different spellings stay two games,
 * which is what a club wants to be told about its own data.
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
       and (v_game is null
            or lower(btrim(coalesce(b.game_title, ''))) = lower(v_game))
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
       and (v_game is null
            or lower(btrim(coalesce(b.game_title, ''))) = lower(v_game))
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
