-- 0007 · Controlled vocabularies
--
-- The source data spells the same concept several ways: PayPal/Paypal,
-- "Bank transfer"/"Bank Transfer"/BACS, wifi vs Wi-Fi, "warhammer 40k" vs
-- "Warhammer 40,000". Lookup tables give one canonical row with a slug, so
-- filters actually work and the mess is fixed on import rather than carried
-- forward forever.

create table public.formats (
  id smallint generated always as identity primary key,
  slug citext not null unique,
  label text not null
);

create table public.games (
  id integer generated always as identity primary key,
  slug citext not null unique,
  label text not null
);

create table public.facilities (
  id smallint generated always as identity primary key,
  slug citext not null unique,
  label text not null
);

create table public.payment_methods (
  id smallint generated always as identity primary key,
  slug citext not null unique,
  label text not null
);

create table public.club_formats (
  club_id bigint not null references public.clubs (id) on delete cascade,
  format_id smallint not null references public.formats (id) on delete cascade,
  primary key (club_id, format_id)
);

create table public.club_games (
  club_id bigint not null references public.clubs (id) on delete cascade,
  game_id integer not null references public.games (id) on delete cascade,
  primary key (club_id, game_id)
);

create table public.club_facilities (
  club_id bigint not null references public.clubs (id) on delete cascade,
  facility_id smallint not null references public.facilities (id) on delete cascade,
  primary key (club_id, facility_id)
);

create table public.club_payment_methods (
  club_id bigint not null references public.clubs (id) on delete cascade,
  payment_method_id smallint not null references public.payment_methods (id) on delete cascade,
  primary key (club_id, payment_method_id)
);

create table public.club_discussion_categories (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubs (id) on delete cascade,
  label text not null,
  position smallint not null default 0,
  unique (club_id, label)
);

-- Reverse lookups: "which clubs play Warhammer 40,000" is the common query,
-- and the composite primary keys above only index club_id first.
create index club_formats_format_idx on public.club_formats (format_id);
create index club_games_game_idx on public.club_games (game_id);
create index club_facilities_fac_idx on public.club_facilities (facility_id);
create index club_payment_methods_pm_idx on public.club_payment_methods (payment_method_id);
create index club_discussion_cat_club_idx on public.club_discussion_categories (club_id);

alter table public.formats enable row level security;
alter table public.games enable row level security;
alter table public.facilities enable row level security;
alter table public.payment_methods enable row level security;
alter table public.club_formats enable row level security;
alter table public.club_games enable row level security;
alter table public.club_facilities enable row level security;
alter table public.club_payment_methods enable row level security;
alter table public.club_discussion_categories enable row level security;

create policy formats_public on public.formats for select to anon, authenticated using (true);
create policy games_public on public.games for select to anon, authenticated using (true);
create policy facilities_public on public.facilities for select to anon, authenticated using (true);
create policy payments_public on public.payment_methods for select to anon, authenticated using (true);
create policy club_formats_public on public.club_formats for select to anon, authenticated using (true);
create policy club_games_public on public.club_games for select to anon, authenticated using (true);
create policy club_facilities_public on public.club_facilities for select to anon, authenticated using (true);
create policy club_payments_public on public.club_payment_methods for select to anon, authenticated using (true);
create policy club_disc_cat_public on public.club_discussion_categories for select to anon, authenticated using (true);

grant select on
  public.formats, public.games, public.facilities, public.payment_methods,
  public.club_formats, public.club_games, public.club_facilities,
  public.club_payment_methods, public.club_discussion_categories
to anon, authenticated;
