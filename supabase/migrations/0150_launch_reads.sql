-- 0150 · Two reads the directory has been getting wrong
--
-- **Tickets left on a card is the number the club typed.** 0066 fixed this on
-- the event's own page by counting what has sold, and the card, the map popup
-- and the directory were left reading `club_events.tickets_available`, which
-- nothing ever decrements. Didcot's Autumn Open shows "50 tickets left" on the
-- card and "46 left" on the page it links to. One event at a time was never
-- going to work for a list of fifty, hence the array form.
--
-- Null means "no answer", not "none left", and there are two ways to get it: an
-- event that sells no typed tickets at all, and one where any type is unlimited
-- (`quantity_available is null`). Both fall back to the club's own figure,
-- which is the same rule the hero already follows.
--
-- **The rating on every card is aggregated in Node.** `findReviewAggregates`
-- selects `club_id, rating` for **every review in the database** and sums them
-- in a Map, on every uncached directory request. It is fine at nine hundred
-- rows and it is the shape that stops being fine without warning. A summary
-- table maintained by a trigger makes it one row per club, and the trigger
-- also handles the case the Node version quietly got right: a removed review
-- stops counting the moment it is removed.
--
-- A table rather than a materialised view, for the reason CLAUDE.md gives: a
-- view needs a refresh schedule and lies in between refreshes, and "4.6 from 12
-- reviews" that is an hour stale is worse than no number.
--
-- Checked on a throwaway Postgres built from every migration: the backfill
-- matches the Node aggregation club for club, inserting a review moves the
-- average, removing one moves it back, un-removing moves it again, deleting a
-- club takes its summary with it, and a fifty-event ticket read returns one row
-- per event that sells tickets and nothing for the rest.

-- ---------------------------------------------------------------------------
-- 1. Tickets left, for a page of events
-- ---------------------------------------------------------------------------

create or replace function public.event_tickets_taken_many(p_events bigint[])
returns table (event_id bigint, remaining integer)
language sql
stable
security definer
set search_path = public
as $$
  with sold as (
    select i.ticket_type_id, sum(i.quantity)::integer as taken
      from public.club_event_booking_items i
      join public.club_event_bookings b on b.id = i.booking_id
     where b.status = 'reserved'
     group by i.ticket_type_id
  )
  select t.event_id,
         -- bool_or short-circuits nothing, so the sum is computed either way;
         -- the case is what turns "one unlimited type" into no answer at all.
         case when bool_or(t.quantity_available is null) then null
              else sum(greatest(t.quantity_available - coalesce(sold.taken, 0), 0))::integer
         end
    from public.club_event_ticket_types t
    left join sold on sold.ticket_type_id = t.id
   where t.event_id = any (coalesce(p_events, '{}'::bigint[]))
   group by t.event_id;
$$;

revoke all on function public.event_tickets_taken_many(bigint[]) from public;
grant execute on function public.event_tickets_taken_many(bigint[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The rating, kept up to date rather than recomputed
-- ---------------------------------------------------------------------------

create table if not exists public.club_review_summary (
  club_id      bigint primary key references public.clubs(id) on delete cascade,
  review_count integer not null default 0,
  rating_sum   integer not null default 0,
  -- Stored rather than generated, so a club with no reviews reads null rather
  -- than dividing by zero, and so the column can be indexed for the sort.
  average      numeric(3, 2),
  updated_at   timestamptz not null default now()
);

comment on table public.club_review_summary is
  'One row per club with any visible review. Maintained by trigger; never '
  'refreshed on a schedule, so it is never stale.';

create index if not exists club_review_summary_by_rating
  on public.club_review_summary (average desc nulls last, review_count desc);

alter table public.club_review_summary enable row level security;

drop policy if exists club_review_summary_read on public.club_review_summary;
create policy club_review_summary_read
  on public.club_review_summary for select to anon, authenticated using (true);

/**
 * Recount one club.
 *
 * A recount of one club rather than an increment, because a review can be
 * removed, restored, re-rated and moved between clubs, and five separate
 * arithmetic paths is five chances to drift. One club's reviews is an indexed
 * read of a handful of rows; correctness is worth that.
 */
create or replace function public.refresh_club_review_summary(p_club bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_sum   integer;
begin
  if p_club is null then
    return;
  end if;

  select count(*)::integer, coalesce(sum(rating), 0)::integer
    into v_count, v_sum
    from public.club_reviews
   where club_id = p_club and removed_at is null;

  if v_count = 0 then
    delete from public.club_review_summary where club_id = p_club;
    return;
  end if;

  insert into public.club_review_summary (club_id, review_count, rating_sum, average)
  values (p_club, v_count, v_sum, round(v_sum::numeric / v_count, 2))
  on conflict (club_id) do update
    set review_count = excluded.review_count,
        rating_sum   = excluded.rating_sum,
        average      = excluded.average,
        updated_at   = now();
end;
$$;

create or replace function public.club_reviews_touch_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Both sides on an update, so moving a review between clubs corrects the one
  -- it left as well as the one it joined.
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_club_review_summary(old.club_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_club_review_summary(new.club_id);
  end if;
  return null;
end;
$$;

drop trigger if exists club_reviews_summary on public.club_reviews;
create trigger club_reviews_summary
  after insert or update or delete on public.club_reviews
  for each row execute function public.club_reviews_touch_summary();

-- The backfill. Every club with a visible review, in one statement.
insert into public.club_review_summary (club_id, review_count, rating_sum, average)
select club_id, count(*)::integer, sum(rating)::integer,
       round(sum(rating)::numeric / count(*), 2)
  from public.club_reviews
 where removed_at is null
 group by club_id
on conflict (club_id) do update
  set review_count = excluded.review_count,
      rating_sum   = excluded.rating_sum,
      average      = excluded.average,
      updated_at   = now();

-- `revoke all` then grant back the read. Supabase's whole-table grant carries
-- TRUNCATE as well, and TRUNCATE is not filtered by RLS: a read-only policy
-- does nothing about a role that can empty the table.
revoke all on public.club_review_summary from authenticated, anon;
grant select on public.club_review_summary to anon, authenticated;

revoke all on function public.refresh_club_review_summary(bigint) from public, anon, authenticated;

do $$
declare v_bad boolean;
begin
  -- Everything except the read granted back above.
  select bool_or(true) into v_bad
    from information_schema.role_table_grants
   where table_name = 'club_review_summary' and grantee = 'authenticated'
     and privilege_type <> 'SELECT';
  if coalesce(v_bad, false) then
    raise exception 'club_review_summary still carries a write grant';
  end if;
end $$;
