-- 0226 · the featured slots narrow down
--
-- The client, item 16c: "on the featured section in admin, we need to add some
-- filters for paid/unpaid, date and club. Without these when lots of featured
-- bookings are added, it will be hard to navigate."
--
-- The screen reads every slot the site has ever sold, in one unpaged select,
-- and draws all of them as cards. That is fine at four and wrong at four
-- hundred, which is where forty clubs buying a week at a time arrive inside
-- two years.
--
-- IN SQL, NOT IN THE BROWSER, for the reason the club-wide bookings list gives
-- (0213): a list that can reach a thousand rows is not one to ship in full and
-- hide nine hundred of. There is a second reason here that list did not have.
-- The page passes EVERY slot id into `featured_payment_standing` on each load,
-- so the unpaged read already cost an array parameter that grows for ever.
-- Both go, because the payment columns come back on the row.
--
-- THE MONEY AND THE CALENDAR ARE TWO AXES, and that is why `p_state` and
-- `p_when` are separate arguments rather than one list of five words. A slot
-- can be running now AND unpaid — which is the single most interesting row on
-- this screen — so folding them into one filter would mean picking either tab
-- hid it.
--
-- `is_admin()` only. `featured_payment_standing` lets a club read its own slot
-- because its billing page needs it; this is the site's whole book and is
-- nobody else's.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-featured-slots-narrow-down.sql.

begin;

create or replace function public.admin_featured_slots(
  p_state text default '',
  p_when  text default '',
  p_query text default '',
  p_month text default '',
  p_club  bigint default null,
  p_sort  text default 'newest',
  p_page  integer default 1,
  p_per   integer default 25
) returns table (
  id             bigint,
  club_id        bigint,
  club_slug      citext,
  club_name      text,
  club_city      text,
  club_status    text,
  starts_on      date,
  ends_on        date,
  price_pence    integer,
  currency       text,
  note           text,
  created_at     timestamptz,
  paid_at        timestamptz,
  payment_method text,
  payment_note   text,
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
  v_from   integer := greatest(0, (greatest(1, coalesce(p_page, 1)) - 1)
                               * greatest(1, coalesce(p_per, 25)));
  v_today  date := public.london_today();
  -- A word this function does not know reads as "everything", the same way an
  -- unrecognised sort reads as newest below. One function answering the same
  -- question two ways is how a bookmark from a renamed tab becomes an empty
  -- screen somebody reads as a broken filter.
  v_state  text := case when coalesce(p_state, '') in ('topay', 'paid')
                        then p_state else '' end;
  v_when   text := case when coalesce(p_when, '') in ('live', 'soon', 'finished')
                        then p_when else '' end;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with rows as (
    select f.id, f.club_id, c.slug, c.name, c.city, c.status,
           f.starts_on, f.ends_on, f.price_pence, f.currency, f.note,
           f.created_at, f.paid_at, f.payment_method, f.payment_note
      from public.featured_listings f
      left join public.clubs c on c.id = f.club_id
     where (p_club is null or f.club_id = p_club)
       -- The month a slot RUNS in, not the one it was booked in. An admin
       -- asking what was on the homepage in October means October, and a slot
       -- that started in September and ends in November was on it every day.
       and (v_month is null
            or to_char(f.starts_on, 'YYYY-MM') <= v_month
               and to_char(f.ends_on, 'YYYY-MM') >= v_month)
       and (v_state = ''
            -- A slot given away has nothing to settle, so it is in neither
            -- money tab and All is wider than the two of them added up. 0205
            -- drew that line on the card and it holds here.
            or (v_state = 'topay' and f.paid_at is null and f.price_pence > 0)
            or (v_state = 'paid'  and f.paid_at is not null))
       -- The same three words the cards have worn since 0113, because a status
       -- is one vocabulary and a filter offering a fourth name for one of them
       -- is a second vocabulary nobody asked for.
       and (v_when = ''
            or (v_when = 'live'     and f.starts_on <= v_today and f.ends_on >= v_today)
            or (v_when = 'soon'     and f.starts_on > v_today)
            or (v_when = 'finished' and f.ends_on < v_today))
       and (v_needle is null
            or c.name ilike '%' || v_needle || '%'
            or c.city ilike '%' || v_needle || '%'
            or f.note ilike '%' || v_needle || '%'
            or f.payment_note ilike '%' || v_needle || '%')
  )
  select r.id, r.club_id, r.slug, r.name, r.city, r.status,
         r.starts_on, r.ends_on, r.price_pence, r.currency, r.note,
         r.created_at, r.paid_at, r.payment_method, r.payment_note,
         count(*) over () as total_rows
    from rows r
   order by
     -- The id breaks every tie in the direction the sort runs, which is the
     -- lesson 0130 paid for: three slots booked in one sitting share a date
     -- and "oldest first" handed back the newest of them.
     case when p_sort = 'oldest' then r.starts_on end asc,
     case when p_sort = 'value'  then r.price_pence end desc,
     case when p_sort = 'club'   then lower(r.name) end asc,
     case when p_sort not in ('oldest', 'value', 'club') then r.starts_on end desc,
     case when p_sort = 'oldest' then r.id end asc,
     r.id desc
   offset v_from limit greatest(1, coalesce(p_per, 25));
end;
$$;

/**
 * The counts beside the tabs, over the same set the list is filtered to.
 *
 * Narrowed by the search, the month, the club and when — but NOT by the money
 * state, which is what makes "To pay 3" mean three of what is on screen rather
 * than three of everything. 0119 made the same point about two sides of a rate.
 *
 * `all` is not `topay` + `paid`: a comped slot is in neither.
 */
create or replace function public.admin_featured_counts(
  p_when  text default '',
  p_query text default '',
  p_month text default '',
  p_club  bigint default null
) returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_needle text := nullif(btrim(coalesce(p_query, '')), '');
  v_month  text := nullif(btrim(coalesce(p_month, '')), '');
  v_today  date := public.london_today();
  v_when   text := case when coalesce(p_when, '') in ('live', 'soon', 'finished')
                        then p_when else '' end;
  v_all int; v_topay int; v_paid int;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select count(*),
         count(*) filter (where f.paid_at is null and f.price_pence > 0),
         count(*) filter (where f.paid_at is not null)
    into v_all, v_topay, v_paid
    from public.featured_listings f
    left join public.clubs c on c.id = f.club_id
   where (p_club is null or f.club_id = p_club)
     and (v_month is null
          or to_char(f.starts_on, 'YYYY-MM') <= v_month
             and to_char(f.ends_on, 'YYYY-MM') >= v_month)
     and (v_when = ''
          or (v_when = 'live'     and f.starts_on <= v_today and f.ends_on >= v_today)
          or (v_when = 'soon'     and f.starts_on > v_today)
          or (v_when = 'finished' and f.ends_on < v_today))
     and (v_needle is null
          or c.name ilike '%' || v_needle || '%'
          or c.city ilike '%' || v_needle || '%'
          or f.note ilike '%' || v_needle || '%'
          or f.payment_note ilike '%' || v_needle || '%');

  return jsonb_build_object(
    'all', coalesce(v_all, 0), 'topay', coalesce(v_topay, 0),
    'paid', coalesce(v_paid, 0));
end;
$$;

/**
 * The months that have a slot in them, the clubs that hold one, and how many
 * are on the homepage right now.
 *
 * The live figure is here rather than in the counts because it is the tab's
 * own label and must not narrow with the filters underneath it: "Slots 2"
 * means two clubs are on the front page as we speak, which is the only number
 * on this screen that means somebody should look. The page used to count it
 * in the browser out of the unpaged list, which is exactly what paging takes
 * away.
 *
 * Offered rather than generated, so neither picker can hold a choice the
 * filtered page would answer nothing for. Same call `club_booking_facets`
 * makes, and the same reason: a picker offering "Sep 2026 (12)" over a page
 * drawing nothing is the screen contradicting itself.
 *
 * One function, because they are two short lists read by one bar and two
 * round trips for them would be one more than the page can afford.
 */
create or replace function public.admin_featured_facets()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_months jsonb;
  v_clubs  jsonb;
  v_live   int;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('month', m.month, 'slots', m.slots)
                            order by m.month desc), '[]'::jsonb)
    into v_months
    from (select to_char(d.day, 'YYYY-MM') as month, count(*)::int as slots
            from public.featured_listings f
            cross join lateral generate_series(
              date_trunc('month', f.starts_on), date_trunc('month', f.ends_on),
              interval '1 month') as d(day)
           group by 1) m;

  select coalesce(jsonb_agg(jsonb_build_object(
                    'id', k.club_id, 'name', k.name, 'slots', k.slots)
                            order by lower(k.name)), '[]'::jsonb)
    into v_clubs
    from (select f.club_id, coalesce(c.name, 'A club that has gone') as name,
                 count(*)::int as slots
            from public.featured_listings f
            left join public.clubs c on c.id = f.club_id
           group by f.club_id, c.name) k;

  select count(*)::int into v_live
    from public.featured_listings f
   where f.starts_on <= public.london_today()
     and f.ends_on >= public.london_today();

  return jsonb_build_object('months', v_months, 'clubs', v_clubs,
                            'live', coalesce(v_live, 0));
end;
$$;

revoke all on function
  public.admin_featured_slots(text, text, text, text, bigint, text, integer, integer)
  from public, anon;
revoke all on function public.admin_featured_counts(text, text, text, bigint)
  from public, anon;
revoke all on function public.admin_featured_facets() from public, anon;
grant execute on function
  public.admin_featured_slots(text, text, text, text, bigint, text, integer, integer)
  to authenticated;
grant execute on function public.admin_featured_counts(text, text, text, bigint)
  to authenticated;
grant execute on function public.admin_featured_facets() to authenticated;

commit;
