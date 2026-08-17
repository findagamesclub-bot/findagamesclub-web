-- 0002 · Clubs
--
-- The core listing. Integer ids are preserved from the legacy JSON so imported
-- child records (events, bookings, memberships, 297 user references) keep
-- pointing at the right rows.
--
-- Venue and pricing are flattened onto the club rather than split out: there is
-- exactly one venue per club in the source data, and splitting would add a join
-- to every directory query for no gain.

create table public.clubs (
  id                bigint primary key,
  slug              citext not null unique,
  name              text not null,
  status            text not null default 'active'
                      check (status in ('active', 'pending', 'suspended', 'archived')),
  owner_id          uuid references public.profiles (id) on delete set null,

  -- Where
  city              text not null default '',
  neighbourhood     text,
  country           text not null default 'United Kingdom',
  venue_name        text,
  venue_address     text,
  venue_postcode    text,
  latitude          double precision check (latitude between -90 and 90),
  longitude         double precision check (longitude between -180 and 180),

  -- Copy
  summary           text,
  description       text,
  logo_url          text,

  -- Facts shown in the stat line
  tables_available  integer check (tables_available >= 0),
  member_count      integer check (member_count >= 0),
  price_drop_in     text,   -- free text: "£8", "Pay what you can", or null
  price_membership  text,

  ages              text,
  accessibility     text,
  tags              text[] not null default '{}',

  -- Contact
  contact_email     citext,
  contact_phone     text,
  website_url       text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on column public.clubs.tables_available is
  'Null means the club does not offer table booking. Zero would wrongly read as "none free".';
comment on column public.clubs.price_drop_in is
  'Free text by design. Source data contains "Pay what you can" alongside amounts.';

create trigger clubs_set_updated_at
  before update on public.clubs
  for each row execute function public.set_updated_at();

-- Directory listing: only active clubs, most complete first.
create index clubs_status_idx on public.clubs (status) where status = 'active';
create index clubs_city_idx   on public.clubs (lower(city));
create index clubs_owner_idx  on public.clubs (owner_id);

-- Fuzzy search over club and town name, for the directory search box.
create index clubs_name_trgm_idx on public.clubs using gin (name gin_trgm_ops);
create index clubs_city_trgm_idx on public.clubs using gin (city gin_trgm_ops);

-- "Clubs within N miles of here". earthdistance is far lighter than PostGIS
-- and this index makes the radius query a bounded scan rather than a full one.
create index clubs_earth_idx on public.clubs
  using gist (ll_to_earth(latitude, longitude))
  where latitude is not null and longitude is not null;

-- --------------------------------------------------------------------- RLS --

alter table public.clubs enable row level security;

-- The directory is public. Anonymous visitors are the primary audience.
create policy clubs_select_active
  on public.clubs for select
  to anon, authenticated
  using (status = 'active');

-- Owners and admins can also see their club while it is pending or suspended.
create policy clubs_select_own
  on public.clubs for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- Editing a listing is an owner/admin action. Insert and delete stay
-- server-side only: listings are created through the submission and approval
-- flow, not written directly by a client.
create policy clubs_update_own
  on public.clubs for update
  to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  )
  with check (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

-- Owners must not be able to move their club between statuses (e.g. approve
-- themselves out of 'pending'), nor reassign ownership.
revoke update on public.clubs from anon, authenticated;

grant update (
  name, city, neighbourhood, venue_name, venue_address, venue_postcode,
  summary, description, logo_url, tables_available,
  price_drop_in, price_membership, ages, accessibility, tags,
  contact_email, contact_phone, website_url
) on public.clubs to authenticated;
