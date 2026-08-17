-- 0009 · Events and reviews
--
-- Events belong to a club. legacy_id is the slug-like id from the source
-- ("2026-04-04-warhammer-40k-rtt"), unique within a club.
-- Result army data stays jsonb: it is deep, varies by game system, and is only
-- ever rendered whole.

create table public.club_events (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  legacy_id text not null,
  title text not null,
  summary text,
  start_date date,
  start_time text,
  end_date date,
  end_time text,
  event_type text,
  event_types text[] not null default '{}',
  formats text[] not null default '{}',
  featured_games text[] not null default '{}',
  facilities text[] not null default '{}',
  round_count smallint,
  price text,
  tickets_available integer,
  logo_src text,
  logo_alt text,
  venue_name text,
  venue_address text,
  venue_postcode text,
  info_board text,
  bestcoast_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, legacy_id)
);

create trigger club_events_set_updated_at
  before update on public.club_events
  for each row execute function public.set_updated_at();

create index club_events_start_idx on public.club_events (start_date) where start_date is not null;
create index club_events_club_idx on public.club_events (club_id, start_date desc);

create table public.club_event_social_links (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.club_events (id) on delete cascade,
  label text not null,
  url text not null,
  position smallint not null default 0
);
create index club_event_social_event_idx on public.club_event_social_links (event_id, position);

create table public.club_event_ticket_types (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.club_events (id) on delete cascade,
  label text not null,
  price text not null default '',
  audience text,
  audience_label text,
  minimum_tier_key text,
  quantity_available integer,
  position smallint not null default 0
);
create index club_event_ticket_event_idx on public.club_event_ticket_types (event_id, position);

create table public.club_event_notices (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.club_events (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);
create index club_event_notices_event_idx on public.club_event_notices (event_id, created_at desc);

create table public.club_event_results (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.club_events (id) on delete cascade,
  rank smallint,
  placement text,
  member_name text not null default '',
  member_legacy_id integer,
  member_profile_id uuid references public.profiles (id) on delete set null,
  is_member boolean not null default false,
  army jsonb not null default '{}'::jsonb
);
create index club_event_results_event_idx on public.club_event_results (event_id, rank);
create index club_event_results_profile_idx on public.club_event_results (member_profile_id);

create table public.club_event_pairings (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.club_events (id) on delete cascade,
  round smallint not null,
  label text,
  matches jsonb not null default '[]'::jsonb,
  unique (event_id, round)
);

create table public.club_reviews (
  id bigint primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  author_profile_id uuid references public.profiles (id) on delete set null,
  author_legacy_id integer,
  author_name text not null default '',
  rating smallint not null check (rating between 1 and 5),
  comment text,
  flagged_at timestamptz,
  flagged_by_name text,
  removed_at timestamptz,
  removed_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger club_reviews_set_updated_at
  before update on public.club_reviews
  for each row execute function public.set_updated_at();

create index club_reviews_club_idx on public.club_reviews (club_id, created_at desc)
  where removed_at is null;
create index club_reviews_author_idx on public.club_reviews (author_profile_id);

alter table public.club_events enable row level security;
alter table public.club_event_social_links enable row level security;
alter table public.club_event_ticket_types enable row level security;
alter table public.club_event_notices enable row level security;
alter table public.club_event_results enable row level security;
alter table public.club_event_pairings enable row level security;
alter table public.club_reviews enable row level security;

create policy club_events_public on public.club_events for select to anon, authenticated using (true);
create policy event_social_public on public.club_event_social_links for select to anon, authenticated using (true);
create policy event_tickets_public on public.club_event_ticket_types for select to anon, authenticated using (true);
create policy event_notices_public on public.club_event_notices for select to anon, authenticated using (true);
create policy event_results_public on public.club_event_results for select to anon, authenticated using (true);
create policy event_pairings_public on public.club_event_pairings for select to anon, authenticated using (true);

-- Removed reviews stay for moderation history but are never served.
create policy club_reviews_public
  on public.club_reviews for select
  to anon, authenticated
  using (removed_at is null);

grant select on
  public.club_events, public.club_event_social_links, public.club_event_ticket_types,
  public.club_event_notices, public.club_event_results, public.club_event_pairings,
  public.club_reviews
to anon, authenticated;
