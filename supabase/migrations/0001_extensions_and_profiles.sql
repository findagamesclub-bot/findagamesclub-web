-- 0001 · Extensions and user profiles
--
-- Auth lives in Supabase (auth.users). Everything the application knows about a
-- person lives here in public.profiles, linked one-to-one.
--
-- legacy_id is load-bearing: the imported club data references users by the
-- integer ids used in the old JSON files (297 references across 27 files —
-- club ownership, bookings, loyalty, messages). Keeping that column lets the
-- imported data keep working without rewriting any of it.

-- Extensions live in the `extensions` schema, not `public`. Supabase already
-- keeps pgcrypto and uuid-ossp there, and the database linter flags anything
-- installed into public. Role search_path includes extensions, so functions
-- like ll_to_earth() still resolve unqualified.
create schema if not exists extensions;

create extension if not exists cube          with schema extensions; -- earthdistance needs it
create extension if not exists earthdistance with schema extensions; -- "within N miles"
create extension if not exists pg_trgm       with schema extensions; -- fuzzy name search
create extension if not exists citext        with schema extensions; -- case-insensitive slugs

-- ---------------------------------------------------------------- profiles --

create table public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  legacy_id              integer unique,
  full_name              text not null default '',
  role                   text not null default 'member'
                           check (role in ('member', 'admin')),
  bio                    text,
  home_postcode          text,
  preferred_travel_miles integer check (preferred_travel_miles between 0 and 500),
  games_interested       text[] not null default '{}',
  factions_armies        text[] not null default '{}',
  availability_days      text[] not null default '{}',
  age_groups             text[] not null default '{}',
  play_style_tags        text[] not null default '{}',
  social_profiles        jsonb  not null default '{}'::jsonb,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on column public.profiles.legacy_id is
  'Integer id from the pre-migration JSON data. Imported club records point at this, not at the uuid.';

create index profiles_role_idx on public.profiles (role) where role = 'admin';

-- --------------------------------------------------------------- updated_at --

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ------------------------------------------- create a profile on sign-up ----
-- Runs as definer because it writes to public.profiles during Supabase's own
-- auth transaction, where the calling role has no rights here. It performs no
-- authorisation decision and reads nothing user-supplied beyond the new row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------- RLS --

alter table public.profiles enable row level security;

-- Profiles are visible to signed-in users: member lists, club rosters and
-- message threads all need to show who someone is.
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

-- A person may edit only their own profile, and may not hand it to someone
-- else. Both using and with check are required — without with check a user
-- could reassign the row's id.
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- RLS decides which ROWS you may touch, not which COLUMNS. Without the grants
-- below, the policy above would happily let someone set their own role to
-- 'admin'. Column-level privileges are what actually prevent that.
revoke update on public.profiles from anon, authenticated;

grant update (
  full_name,
  bio,
  home_postcode,
  preferred_travel_miles,
  games_interested,
  factions_armies,
  availability_days,
  age_groups,
  play_style_tags,
  social_profiles
) on public.profiles to authenticated;

-- role, legacy_id and is_active are changed only server-side via the service
-- role, after our own authorisation check.
