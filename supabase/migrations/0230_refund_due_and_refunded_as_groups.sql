-- 0230 · refund due and refunded, as groups a club can ask for
--
-- The client, item 16f: "can we please add 2 more filters on event bookings,
-- refund due and refunded. Please also add these filters for table booking
-- payments, and merchandise payment status."
--
-- Event bookings filter in PostgREST and merchandise filters in the browser,
-- so both of those are TypeScript. This is the table-payments half, which has
-- filtered in SQL since 0213 because the list runs to a thousand rows.
--
-- THE TWO NEW GROUPS OVERLAP CANCELLED rather than splitting it. A refund
-- lives on a table that was called off, so a tab that excluded cancellations
-- the way To pay and Paid do would have been empty for ever. The consequence
-- is that the tabs no longer add up to All, which is a change from 0213 and
-- is correct: they are a second question about the same rows, not a finer
-- slice of the same partition.
--
-- A new return column makes a `returns table` signature change, which
-- `create or replace` cannot do, so the counts are dropped first. Twelfth
-- time this file has had to say that.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-refund-groups.sql.

begin;

-- ---------------------------------------------------------------------------
-- 1. A merchandise order can be owed a refund
-- ---------------------------------------------------------------------------
--
-- 0229 gave an order `refunded`; the client asked for both groups, so it also
-- needs the state in between. Unlike a table or an event place this one is
-- the club's to set by hand rather than a trigger's to infer: a merchandise
-- order carries ONE status, so cancelling a paid order overwrites `paid` and
-- the fact that money was taken is gone. Nothing is left to derive "owed"
-- from. Saying so here because the asymmetry looks like an oversight
-- otherwise, and the honest fix is the two-column shape a table booking has,
-- which is a bigger change than this item asked for.

alter table public.club_merchandise_orders
  drop constraint if exists club_merchandise_orders_status_check;
alter table public.club_merchandise_orders
  add constraint club_merchandise_orders_status_check
  check (status in ('placed', 'paid', 'fulfilled', 'cancelled',
                    'refund_due', 'refunded'));

-- ---------------------------------------------------------------------------
-- 2. And a table payment can be asked for by the same two words
-- ---------------------------------------------------------------------------

drop function if exists
  public.club_table_bookings(bigint, text, text, text, date, text, integer, integer);
CREATE OR REPLACE FUNCTION public.club_table_bookings(p_club bigint, p_tab text DEFAULT 'all'::text, p_query text DEFAULT ''::text, p_month text DEFAULT ''::text, p_night date DEFAULT NULL::date, p_sort text DEFAULT 'newest'::text, p_page integer DEFAULT 1, p_per integer DEFAULT 25)
 RETURNS TABLE(booking_id bigint, side text, person_id uuid, person_name text, against_name text, session_date date, session_label text, session_time text, table_index smallint, game_title text, status text, payment_status text, payment_method text, payment_note text, paid_at timestamp with time zone, base_price numeric, tier_label text, tier_percent smallint, tier_amount numeric, points_spent integer, points_amount numeric, total_price numeric, currency text, booked_at timestamp with time zone, refund_status text, refunded_at timestamp with time zone, refund_method text, refund_note text, total_rows bigint)
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
            -- The two money-back groups, the client's item 16f. They do NOT
            -- exclude a cancelled table: that is where a refund comes from,
            -- so excluding it would leave both tabs permanently empty. They
            -- overlap Cancelled rather than splitting it, which is why the
            -- five no longer add up to All and should not be expected to.
            or (p_tab = 'refunddue' and s.refund_status = 'due')
            or (p_tab = 'refunded'  and s.refund_status = 'refunded')
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
         r.refund_status, r.refunded_at, r.refund_method, r.refund_note,
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

drop function if exists public.club_table_booking_counts(bigint, text, text, date);
CREATE OR REPLACE FUNCTION public.club_table_booking_counts(p_club bigint, p_query text DEFAULT ''::text, p_month text DEFAULT ''::text, p_night date DEFAULT NULL::date)
 RETURNS TABLE(all_rows bigint, topay bigint, paid bigint, free bigint, cancelled bigint, refunddue bigint, refunded bigint)
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
         count(*) filter (where s.status <> 'booked'),
         count(*) filter (where s.refund_status = 'due'),
         count(*) filter (where s.refund_status = 'refunded')
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

revoke all on function
  public.club_table_bookings(bigint, text, text, text, date, text, integer, integer)
  from public, anon;
revoke all on function
  public.club_table_booking_counts(bigint, text, text, date) from public, anon;
grant execute on function
  public.club_table_bookings(bigint, text, text, text, date, text, integer, integer)
  to authenticated;
grant execute on function
  public.club_table_booking_counts(bigint, text, text, date) to authenticated;

commit;
