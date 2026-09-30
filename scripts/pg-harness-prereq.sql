-- What Supabase provides and plain Postgres does not: the roles, the auth and
-- storage schemas, the realtime publication and a cron stub. Used by
-- scripts/pg-harness.sh to build a database from the real migrations.
--
-- Nothing here stands in for one of our own tables. That is the whole point:
-- the previous scaffold did, got three column names wrong, and every test
-- written against it passed while the real thing was broken.

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_auth_admin nologin; exception when duplicate_object then null; end $$;
grant usage on schema public to anon, authenticated, service_role;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
grant usage on schema auth to anon, authenticated, service_role;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  banned_until timestamptz,
  created_at timestamptz not null default now());
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', 'anon') $$;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text,
  owner uuid, created_at timestamptz default now(), metadata jsonb);
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
create schema if not exists cron;
create or replace function cron.schedule(text, text, text) returns bigint
  language sql as $$ select 1::bigint $$;
create or replace function cron.unschedule(text) returns boolean
  language sql as $$ select true $$;
alter table auth.users add column if not exists last_sign_in_at timestamptz;
alter table auth.users add column if not exists email_confirmed_at timestamptz;
alter table auth.users add column if not exists confirmed_at timestamptz;
alter table auth.users add column if not exists phone text;
alter table auth.users add column if not exists deleted_at timestamptz;
alter table auth.users add column if not exists is_anonymous boolean default false;
alter table auth.users add column if not exists updated_at timestamptz default now();
alter table auth.users add column if not exists encrypted_password text;
alter table auth.users add column if not exists raw_app_meta_data jsonb default '{}'::jsonb;

-- Supabase grants EXECUTE on everything in `public` to these four by default,
-- and sets a default privilege so anything a migration creates later is
-- granted too. Without this the harness refuses calls that the real database
-- allows, and worse, a migration that forgot to revoke looks safe here because
-- nothing was granted in the first place. The guards have to be doing the
-- work, not the absence of a grant.
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
-- Table grants are not defaulted here, but they CAN be: run the build with
-- PGHARNESS_SUPABASE_GRANTS=1 and the harness adds
--   alter default privileges in schema public grant all on tables to ...
-- which is what Supabase really does. It is off by default because the chain
-- then stops at 0114, whose guard fires on `clubs` for a real reason: 0002
-- revokes UPDATE and leaves the whole-table INSERT, DELETE and TRUNCATE that
-- Supabase handed out. RLS covers the first two (there is no insert or delete
-- policy) and does NOT cover TRUNCATE, which ignores row security entirely.
-- DEFERRED.md carries the finding.
--
-- Turn it on when writing a migration that creates a table: without it,
-- `revoke insert, update, delete` looks complete here and leaves TRUNCATE,
-- REFERENCES and TRIGGER behind on the real database. That is how 0149 passed
-- locally and failed its own guard on Supabase.
