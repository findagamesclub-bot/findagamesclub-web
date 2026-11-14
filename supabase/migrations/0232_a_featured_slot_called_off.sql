-- 0232 · a featured slot can be called off, and the money given back
--
-- The client, item 16d: "please can we also add a cancel and refund flag and
-- status for featured club listings also. This could be where a club books
-- and pays and then changes their mind and then cancels."
--
-- Today the only way out is Remove, which DELETES the row. That is right for
-- a slot booked by mistake and wrong for the case they describe: the club
-- paid, so there is a payment to account for and money to give back, and
-- deleting the row throws both away. A cancellation keeps the record.
--
-- Same shape as a table booking (0229) and an event place (0092, 0224),
-- because it is the same question: its own status, date, method and note,
-- kept beside the payment rather than on top of it, so a slot can say it was
-- paid by transfer in October AND refunded by transfer in November.
--
-- THE HOMEPAGE IS THE PART THAT MATTERS MOST. `featured_clubs` picks by date
-- alone, so without the clause added below a cancelled slot would keep
-- leading the front page until its end date and the cancellation would be a
-- note nobody acted on. `findLiveFeaturedClubIds` reads the table directly
-- for the Featured badge and is filtered in the repository for the same
-- reason.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-a-featured-slot-called-off.sql.

begin;

alter table public.featured_listings
  add column if not exists cancelled_at   timestamptz,
  add column if not exists cancel_reason  text not null default '',
  add column if not exists cancelled_by   uuid references public.profiles (id)
                                          on delete set null,
  add column if not exists refund_status  text not null default 'not_due',
  add column if not exists refunded_at    timestamptz,
  add column if not exists refund_method  text not null default '',
  add column if not exists refund_note    text not null default '';

alter table public.featured_listings
  drop constraint if exists featured_listings_refund_status_check;
alter table public.featured_listings
  add constraint featured_listings_refund_status_check
  check (refund_status in ('not_due', 'due', 'refunded'));

comment on column public.featured_listings.cancelled_at is
  'When the club called the slot off. A cancelled slot is off the homepage '
  'from that moment, whatever its dates say. Null means it stands.';

/**
 * The stamp: a cancellation that was paid for owes money back.
 *
 * A trigger rather than something the two functions below each remember,
 * which is the rule this codebase has written down since the loyalty awards:
 * a slot can be cancelled from the admin board today and from anything added
 * later, and a rule that fires on one path is worse than none.
 *
 * Taking a refund back clears its date, method and note, which is 0224's own
 * assertion: a row reading "Refunded by bank transfer" under a status saying
 * the money is still owed is worse than one saying nothing.
 */
create or replace function public.featured_listings_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.refund_status is distinct from old.refund_status then
    if new.refund_status = 'refunded' then
      new.refunded_at := coalesce(new.refunded_at, now());
    else
      new.refunded_at   := null;
      new.refund_method := '';
      new.refund_note   := '';
    end if;
  end if;

  -- Called off with money on it: the club is owed it back.
  if new.cancelled_at is not null and old.cancelled_at is null
     and new.paid_at is not null and new.refund_status = 'not_due' then
    new.refund_status := 'due';
  end if;

  -- And putting it back takes the reason with it, so a slot that stands
  -- cannot carry words explaining why it does not.
  if new.cancelled_at is null and old.cancelled_at is not null then
    new.cancel_reason := '';
    new.cancelled_by  := null;
  end if;

  return new;
end;
$$;

drop trigger if exists featured_listings_stamped on public.featured_listings;
create trigger featured_listings_stamped
  before update of cancelled_at, refund_status, paid_at
  on public.featured_listings
  for each row execute function public.featured_listings_stamp();

/**
 * Call a slot off, or put it back.
 *
 * Not a delete. `unfeature_club` stays for a slot booked by mistake, which is
 * a different thing: nothing happened and nothing needs accounting for. This
 * is for the case the client describes, where the club paid.
 */
create or replace function public.cancel_featured_slot(
  p_slot bigint, p_cancel boolean default true, p_reason text default ''
) returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.featured_listings f where f.id = p_slot) then
    raise exception 'FEATURED_SLOT_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  update public.featured_listings f
     set cancelled_at  = case when p_cancel then coalesce(f.cancelled_at, now())
                              else null end,
         cancelled_by  = case when p_cancel then coalesce(f.cancelled_by, auth.uid())
                              else f.cancelled_by end,
         cancel_reason = case when p_cancel then left(btrim(coalesce(p_reason, '')), 300)
                              else f.cancel_reason end
   where f.id = p_slot;
  return true;
end;
$$;

/** The money going back, recorded the way every other refund here is. */
create or replace function public.set_featured_refund(
  p_slot bigint, p_status text, p_method text default '', p_note text default ''
) returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_row public.featured_listings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('not_due', 'due', 'refunded') then
    raise exception 'REFUND_STATUS_UNKNOWN' using errcode = 'check_violation';
  end if;

  select * into v_row from public.featured_listings f where f.id = p_slot;
  if not found then
    raise exception 'FEATURED_SLOT_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Nothing was taken, so there is nothing to give back. Without this the
  -- takings would read as money leaving that never arrived.
  if p_status = 'refunded' and v_row.paid_at is null then
    raise exception 'FEATURED_NOT_PAID' using errcode = 'check_violation';
  end if;

  update public.featured_listings f
     set refund_status = p_status,
         refund_method = left(btrim(coalesce(p_method, '')), 120),
         refund_note   = left(btrim(coalesce(p_note, '')), 300)
   where f.id = p_slot;
  return true;
end;
$$;

revoke all on function public.cancel_featured_slot(bigint, boolean, text)
  from public, anon;
revoke all on function public.set_featured_refund(bigint, text, text, text)
  from public, anon;
grant execute on function public.cancel_featured_slot(bigint, boolean, text)
  to authenticated;
grant execute on function public.set_featured_refund(bigint, text, text, text)
  to authenticated;

CREATE OR REPLACE FUNCTION public.featured_clubs(p_limit integer DEFAULT 6)
 RETURNS TABLE(club_id bigint, slug text, paid boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with slots as (
    select f.club_id, c.slug, f.id
      from public.featured_listings f
      join public.clubs c on c.id = f.club_id
     where f.starts_on <= public.london_today()
       and f.ends_on   >= public.london_today()
       -- A club that booked, paid and then changed its mind must come off
       -- the front page. Without this the slot keeps running out its dates
       -- and the cancellation is a note nobody acts on.
       and f.cancelled_at is null
       and c.status = 'active'
     order by f.id
     limit greatest(coalesce(p_limit, 6), 0)
  )
  select club_id, slug, true from slots
  union all
  select c.id, c.slug, false
    from public.clubs c
   where c.status = 'active'
     and c.spotlight
     and c.id not in (select club_id from slots)
   order by 3 desc, 1
  limit greatest(coalesce(p_limit, 6), 0)
$function$;

drop function if exists
  public.admin_featured_slots(text, text, text, text, bigint, text, integer, integer);
CREATE OR REPLACE FUNCTION public.admin_featured_slots(p_state text DEFAULT ''::text, p_when text DEFAULT ''::text, p_query text DEFAULT ''::text, p_month text DEFAULT ''::text, p_club bigint DEFAULT NULL::bigint, p_sort text DEFAULT 'newest'::text, p_page integer DEFAULT 1, p_per integer DEFAULT 25)
 RETURNS TABLE(id bigint, club_id bigint, club_slug citext, club_name text, club_city text, club_status text, starts_on date, ends_on date, price_pence integer, currency text, note text, created_at timestamp with time zone, paid_at timestamp with time zone, payment_method text, payment_note text, cancelled_at timestamp with time zone, cancel_reason text, refund_status text, refunded_at timestamp with time zone, refund_method text, refund_note text, total_rows bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_state  text := case when coalesce(p_state, '')
                             in ('topay', 'paid', 'cancelled',
                                 'refunddue', 'refunded')
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
           f.created_at, f.paid_at, f.payment_method, f.payment_note,
           f.cancelled_at, f.cancel_reason, f.refund_status, f.refunded_at,
           f.refund_method, f.refund_note
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
            -- A cancelled slot is nobody's to chase and nobody's to count
            -- as taken, so it drops out of both money groups and has its own.
            or (v_state = 'topay' and f.cancelled_at is null
                                  and f.paid_at is null and f.price_pence > 0)
            or (v_state = 'paid'  and f.cancelled_at is null
                                  and f.paid_at is not null)
            or (v_state = 'cancelled' and f.cancelled_at is not null)
            -- And the two money-back groups ignore the cancellation, because
            -- a cancellation is exactly where a refund comes from. Same line
            -- 0230 draws on a table and an event place.
            or (v_state = 'refunddue' and f.refund_status = 'due')
            or (v_state = 'refunded'  and f.refund_status = 'refunded'))
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
         r.cancelled_at, r.cancel_reason, r.refund_status, r.refunded_at,
         r.refund_method, r.refund_note,
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_featured_counts(p_when text DEFAULT ''::text, p_query text DEFAULT ''::text, p_month text DEFAULT ''::text, p_club bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_needle text := nullif(btrim(coalesce(p_query, '')), '');
  v_month  text := nullif(btrim(coalesce(p_month, '')), '');
  v_today  date := public.london_today();
  v_when   text := case when coalesce(p_when, '') in ('live', 'soon', 'finished')
                        then p_when else '' end;
  v_all int; v_topay int; v_paid int;
  v_cancelled int; v_refunddue int; v_refunded int;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select count(*),
         count(*) filter (where f.cancelled_at is null
                            and f.paid_at is null and f.price_pence > 0),
         count(*) filter (where f.cancelled_at is null and f.paid_at is not null),
         count(*) filter (where f.cancelled_at is not null),
         count(*) filter (where f.refund_status = 'due'),
         count(*) filter (where f.refund_status = 'refunded')
    into v_all, v_topay, v_paid, v_cancelled, v_refunddue, v_refunded
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
    'paid', coalesce(v_paid, 0),
    'cancelled', coalesce(v_cancelled, 0),
    'refunddue', coalesce(v_refunddue, 0),
    'refunded', coalesce(v_refunded, 0));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_featured_facets(p_when text DEFAULT ''::text, p_query text DEFAULT ''::text, p_month text DEFAULT ''::text, p_club bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_needle text := nullif(btrim(coalesce(p_query, '')), '');
  v_month  text := nullif(btrim(coalesce(p_month, '')), '');
  v_today  date := public.london_today();
  v_when   text := case when coalesce(p_when, '') in ('live', 'soon', 'finished')
                        then p_when else '' end;
  v_months jsonb;
  v_clubs  jsonb;
  v_live   int;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- The months, under everything except the month.
  select coalesce(jsonb_agg(jsonb_build_object('month', m.month, 'slots', m.slots)
                            order by m.month desc), '[]'::jsonb)
    into v_months
    from (select to_char(d.day, 'YYYY-MM') as month, count(*)::int as slots
            from public.featured_listings f
            left join public.clubs c on c.id = f.club_id
            cross join lateral generate_series(
              date_trunc('month', f.starts_on), date_trunc('month', f.ends_on),
              interval '1 month') as d(day)
           where (p_club is null or f.club_id = p_club)
             and (v_when = ''
                  or (v_when = 'live' and f.starts_on <= v_today and f.ends_on >= v_today)
                  or (v_when = 'soon' and f.starts_on > v_today)
                  or (v_when = 'finished' and f.ends_on < v_today))
             and (v_needle is null
                  or c.name ilike '%' || v_needle || '%'
                  or c.city ilike '%' || v_needle || '%'
                  or f.note ilike '%' || v_needle || '%'
                  or f.payment_note ilike '%' || v_needle || '%')
           group by 1) m;

  -- The clubs, under everything except the club.
  select coalesce(jsonb_agg(jsonb_build_object(
                    'id', k.club_id, 'name', k.name, 'slots', k.slots)
                            order by lower(k.name)), '[]'::jsonb)
    into v_clubs
    from (select f.club_id, coalesce(c.name, 'A club that has gone') as name,
                 count(*)::int as slots
            from public.featured_listings f
            left join public.clubs c on c.id = f.club_id
           where (v_month is null
                  or to_char(f.starts_on, 'YYYY-MM') <= v_month
                     and to_char(f.ends_on, 'YYYY-MM') >= v_month)
             and (v_when = ''
                  or (v_when = 'live' and f.starts_on <= v_today and f.ends_on >= v_today)
                  or (v_when = 'soon' and f.starts_on > v_today)
                  or (v_when = 'finished' and f.ends_on < v_today))
             and (v_needle is null
                  or c.name ilike '%' || v_needle || '%'
                  or c.city ilike '%' || v_needle || '%'
                  or f.note ilike '%' || v_needle || '%'
                  or f.payment_note ilike '%' || v_needle || '%')
           group by f.club_id, c.name) k;

  -- And the headline, under nothing: "Slots 2" means two clubs are on the
  -- front page as we speak, whatever the reader has typed underneath it.
  select count(*)::int into v_live
    from public.featured_listings f
   where f.starts_on <= v_today and f.ends_on >= v_today
     -- Cancelled slots are off the homepage, so the figure the Slots tab
     -- wears must not count them. That number is the one thing on this page
     -- that means somebody should look, and a called-off booking inflating
     -- it is the figure lying about the only job it has.
     and f.cancelled_at is null;

  return jsonb_build_object('months', v_months, 'clubs', v_clubs,
                            'live', coalesce(v_live, 0));
end;
$function$;

revoke all on function
  public.admin_featured_slots(text, text, text, text, bigint, text, integer, integer)
  from public, anon;
grant execute on function
  public.admin_featured_slots(text, text, text, text, bigint, text, integer, integer)
  to authenticated;

commit;
