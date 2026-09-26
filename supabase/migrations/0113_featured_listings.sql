-- 0113 · Featured means somebody paid to be there
--
-- Legacy has `spotlight`, a boolean on the club, and the homepage takes the
-- first three clubs carrying it (club_store.py:1061). No dates, no price, no
-- record of who agreed to what. Ours says "Featured clubs" over
-- `clubs.slice(0, 6)`, which is worse: it is the first six clubs in the
-- directory wearing a word that means somebody paid.
--
-- A featured slot is a dated, priced thing here. Two reasons beyond honesty:
-- a slot that ends on its own is a slot nobody has to remember to take down,
-- and a slot with a price is a row the treasurer's CSV can add up.
--
-- `spotlight` stays and stays admin-only. It is the fallback when nobody has
-- bought a slot, so a homepage with no paying customers still leads with the
-- clubs worth leading with rather than with whatever sorted first.
--
-- Overlapping slots are refused rather than merged. Two clubs can share a week;
-- the same club holding two overlapping slots is somebody being charged twice
-- for one thing.
--
-- Checked on a throwaway Postgres: an admin books a slot and the club leads the
-- homepage; a slot that has not started and one that has ended do not; two
-- clubs share a week; the same club cannot; a non-admin books nothing; the
-- fallback fills the list from `spotlight` and never repeats a club that
-- already has a slot; and anybody may read what is featured today.

create table if not exists public.featured_listings (
  id          bigint generated always as identity primary key,

  club_id     bigint not null references public.clubs (id) on delete cascade,

  -- Inclusive both ends, in London days like every other date in this app.
  starts_on   date not null,
  ends_on     date not null,

  price_pence integer not null default 0 check (price_pence >= 0),
  currency    text not null default 'GBP',
  note        text not null default '',

  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint featured_listings_dates check (ends_on >= starts_on)
);

create index if not exists featured_listings_window_idx
  on public.featured_listings (starts_on, ends_on);
create index if not exists featured_listings_club_idx
  on public.featured_listings (club_id, starts_on desc);

alter table public.featured_listings enable row level security;
revoke insert, update, delete on public.featured_listings from authenticated, anon;
grant select on public.featured_listings to anon, authenticated;

-- Readable by everybody: what is featured today is on the front page, so
-- hiding the row while showing the result would be theatre.
drop policy if exists featured_listings_read on public.featured_listings;
create policy featured_listings_read on public.featured_listings
  for select to anon, authenticated using (true);

/**
 * Book a slot.
 *
 * Admin only, and it refuses to overlap one this club already holds. Two clubs
 * sharing a week is the product working; one club holding two overlapping
 * slots is somebody being invoiced twice for the same week.
 */
create or replace function public.feature_club(
  p_club bigint, p_from date, p_to date,
  p_price_pence integer default null, p_note text default ''
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id    bigint;
  v_from  date := coalesce(p_from, public.london_today());
  v_to    date;
  v_price integer := p_price_pence;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.clubs where id = p_club) then
    raise exception 'CLUB_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  select coalesce(p_to, v_from + (featured_duration_days - 1)),
         coalesce(v_price, featured_price_pence)
    into v_to, v_price
    from public.listing_billing_settings where id = 1;

  if v_to < v_from then
    raise exception 'FEATURED_BAD_DATES' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.featured_listings
     where club_id = p_club and starts_on <= v_to and ends_on >= v_from
  ) then
    raise exception 'FEATURED_OVERLAPS' using errcode = 'check_violation';
  end if;

  insert into public.featured_listings
    (club_id, starts_on, ends_on, price_pence, note, created_by)
  values (p_club, v_from, v_to, v_price, coalesce(p_note, ''), (select auth.uid()))
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.feature_club(bigint, date, date, integer, text)
  from public, anon;
grant execute on function public.feature_club(bigint, date, date, integer, text)
  to authenticated;

create or replace function public.unfeature_club(p_slot bigint)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  delete from public.featured_listings where id = p_slot;
  return found;
end $$;

revoke all on function public.unfeature_club(bigint) from public, anon;
grant execute on function public.unfeature_club(bigint) to authenticated;

/**
 * Who leads the homepage today.
 *
 * Paid slots first, oldest booking first so a club that booked in January is
 * not pushed down by one that booked last week. Then `spotlight` fills whatever
 * is left, which is legacy's behaviour and is what stops the front page looking
 * empty before anybody has bought anything.
 *
 * `paid` comes back with each row so the page can say "Featured" only about the
 * ones that are. Calling the fallback featured is the thing this migration
 * exists to stop.
 *
 * The slug comes back as well as the id: every public page addresses a club by
 * slug, and the directory's own `ClubSummary` deliberately carries no id.
 */
create or replace function public.featured_clubs(p_limit integer default 6)
returns table (club_id bigint, slug text, paid boolean)
language sql stable security definer set search_path = public as $$
  with slots as (
    select f.club_id, c.slug, f.id
      from public.featured_listings f
      join public.clubs c on c.id = f.club_id
     where f.starts_on <= public.london_today()
       and f.ends_on   >= public.london_today()
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
$$;

revoke all on function public.featured_clubs(integer) from public;
grant execute on function public.featured_clubs(integer) to anon, authenticated;
