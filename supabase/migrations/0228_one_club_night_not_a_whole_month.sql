-- 0228 · one club night, not a whole month of them
--
-- The client, item 12: "could we also add a week filter or specific date
-- filter to the below for table payments? The month filter is useful, but now
-- we break out a payment with two lines, the list will get very long. Having
-- the ability to filter by specific club night will be useful. Perhaps once
-- the month filter is selected, a date filter for that month becomes
-- available?"
--
-- That is a consequence of 0221 and they spotted it before we did. Splitting a
-- table between the two people on it doubled every money list at a stroke, so
-- the month filter that was comfortable in October is twice the scroll now.
--
-- THE NIGHTS NARROW TO THE MONTH, which is the client's own suggestion and the
-- right shape: a club three seasons in has run two hundred nights, and a
-- picker holding all of them is the problem the month picker already solved.
-- It is also 0227's rule read the other way round. There the months were
-- counted under the club; here the nights are counted under the month, and in
-- both cases a picker answers the screen it is sitting on.
--
-- A new parameter makes a NEW function in Postgres rather than replacing the
-- old one, so all three are dropped first. Eleventh time.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-one-club-night.sql.

begin;

drop function if exists public.club_booking_facets(bigint, text);
drop function if exists public.club_table_bookings(bigint, text, text, text, text, integer, integer);
drop function if exists public.club_table_booking_counts(bigint, text, text);

CREATE OR REPLACE FUNCTION public.club_booking_facets(p_club bigint, p_scope text DEFAULT 'all'::text, p_month text DEFAULT ''::text)
 RETURNS TABLE(kind text, value text, label text, rows bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_month text := nullif(btrim(coalesce(p_month, '')), '');
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
    -- The nights, narrowed to the month the reader has picked. Every other
    -- facet here is counted over the whole club on purpose; this one is not,
    -- because the client asked for exactly that: "perhaps once the month
    -- filter is selected, a date filter for that month becomes available".
    -- Offering every night a club has ever run would be a list nobody can
    -- scan, which is the problem the month picker already solved once.
    select 'night'::text as kind,
           to_char(l.session_date, 'YYYY-MM-DD') as value,
           to_char(l.session_date, 'YYYY-MM-DD') as label,
           count(*) as rows
      from live l
     where v_month is not null
       and to_char(l.session_date, 'YYYY-MM') = v_month
     group by 1, 2, 3
    union all
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
            case when f.kind in ('month', 'night') then f.value end desc nulls last,
            f.rows desc,
            f.label;
end;
$function$;

CREATE OR REPLACE FUNCTION public.club_table_bookings(p_club bigint, p_tab text DEFAULT 'all'::text, p_query text DEFAULT ''::text, p_month text DEFAULT ''::text, p_night date DEFAULT NULL::date, p_sort text DEFAULT 'newest'::text, p_page integer DEFAULT 1, p_per integer DEFAULT 25)
 RETURNS TABLE(booking_id bigint, side text, person_id uuid, person_name text, against_name text, session_date date, session_label text, session_time text, table_index smallint, game_title text, status text, payment_status text, payment_method text, payment_note text, paid_at timestamp with time zone, base_price numeric, tier_label text, tier_percent smallint, tier_amount numeric, points_spent integer, points_amount numeric, total_price numeric, currency text, booked_at timestamp with time zone, total_rows bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
       -- One club night, which is what a club actually works down. Since
       -- 0221 a table is two rows, so a month at a busy club is twice the
       -- list it used to be and the month alone stopped being enough.
       and (p_night is null or s.session_date = p_night)
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
$function$;

CREATE OR REPLACE FUNCTION public.club_table_booking_counts(p_club bigint, p_query text DEFAULT ''::text, p_month text DEFAULT ''::text, p_night date DEFAULT NULL::date)
 RETURNS TABLE(all_rows bigint, topay bigint, paid bigint, free bigint, cancelled bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     and (p_night is null or s.session_date = p_night)
     and (v_needle is null
          or s.person_name ilike '%' || v_needle || '%'
          or s.against_name ilike '%' || v_needle || '%'
          or s.game_title ilike '%' || v_needle || '%'
          or s.payment_note ilike '%' || v_needle || '%');
end;
$function$;

revoke all on function public.club_booking_facets(bigint, text, text) from public, anon;
revoke all on function
  public.club_table_bookings(bigint, text, text, text, date, text, integer, integer)
  from public, anon;
revoke all on function
  public.club_table_booking_counts(bigint, text, text, date) from public, anon;
grant execute on function public.club_booking_facets(bigint, text, text) to authenticated;
grant execute on function
  public.club_table_bookings(bigint, text, text, text, date, text, integer, integer)
  to authenticated;
grant execute on function
  public.club_table_booking_counts(bigint, text, text, date) to authenticated;

commit;
