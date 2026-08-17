-- 0008 · Club page content
--
-- Everything that hangs off a club and is rendered on its page. benefits and
-- billing_options stay jsonb: they are rendered as a block, never filtered or
-- joined on, and their shape varies between clubs.

create table public.club_images (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  src text not null,
  alt text not null default '',
  position smallint not null default 0
);
create index club_images_club_idx on public.club_images (club_id, position);

create table public.club_social_links (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  label text not null,
  url text not null,
  position smallint not null default 0
);
create index club_social_links_club_idx on public.club_social_links (club_id, position);

-- Kept as text rather than time: the source has ranges like "19:00 - 22:30"
-- and free-text labels. Normalising would lose what the club wrote.
create table public.club_sessions (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  day text not null,
  time text not null default '',
  label text not null default '',
  position smallint not null default 0
);
create index club_sessions_club_idx on public.club_sessions (club_id, position);
create index club_sessions_day_idx on public.club_sessions (lower(day));

create table public.club_pricing_models (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  label text not null,
  price text not null default '',
  notes text not null default '',
  position smallint not null default 0
);
create index club_pricing_models_club_idx on public.club_pricing_models (club_id, position);

create table public.club_announcements (
  id bigint primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);
create index club_announcements_club_idx on public.club_announcements (club_id, created_at desc);

create table public.club_membership_tiers (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  tier_key text not null,
  label text not null,
  price text not null default '',
  price_duration text not null default '',
  description text,
  tone text,
  profile_flair text,
  premium_badge_label text,
  is_basic boolean not null default false,
  position smallint not null default 0,
  benefits jsonb not null default '[]'::jsonb,
  billing_options jsonb not null default '[]'::jsonb,
  unique (club_id, tier_key)
);
create index club_membership_tiers_club_idx on public.club_membership_tiers (club_id, position);

create table public.club_membership_settings (
  club_id bigint primary key references public.clubs (id) on delete cascade,
  basic_label text,
  advance_booking_dates smallint,
  upcoming_booking_limit smallint,
  event_advance_days smallint,
  looking_for_game_future_dates smallint,
  looking_for_game_post_limit smallint,
  loyalty_redemption_cap_percent smallint
);

-- The public roster. These are display records from the legacy data, not
-- accounts; member_profile_id links the ones that are.
create table public.club_members (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  legacy_member_id integer,
  name text not null,
  initials text not null default '',
  member_profile_id uuid references public.profiles (id) on delete set null,
  position smallint not null default 0,
  unique (club_id, legacy_member_id)
);
create index club_members_club_idx on public.club_members (club_id, position);
create index club_members_profile_idx on public.club_members (member_profile_id);

alter table public.club_images enable row level security;
alter table public.club_social_links enable row level security;
alter table public.club_sessions enable row level security;
alter table public.club_pricing_models enable row level security;
alter table public.club_announcements enable row level security;
alter table public.club_membership_tiers enable row level security;
alter table public.club_membership_settings enable row level security;
alter table public.club_members enable row level security;

create policy club_images_public on public.club_images for select to anon, authenticated using (true);
create policy club_social_public on public.club_social_links for select to anon, authenticated using (true);
create policy club_sessions_public on public.club_sessions for select to anon, authenticated using (true);
create policy club_pricing_public on public.club_pricing_models for select to anon, authenticated using (true);
create policy club_announce_public on public.club_announcements for select to anon, authenticated using (true);
create policy club_tiers_public on public.club_membership_tiers for select to anon, authenticated using (true);
create policy club_msettings_public on public.club_membership_settings for select to anon, authenticated using (true);

-- The roster names real people. Signed-in only, not scrapeable anonymously.
create policy club_members_authenticated on public.club_members for select to authenticated using (true);

grant select on
  public.club_images, public.club_social_links, public.club_sessions,
  public.club_pricing_models, public.club_announcements,
  public.club_membership_tiers, public.club_membership_settings
to anon, authenticated;

grant select on public.club_members to authenticated;
