-- 0148 · Which emails a person wants, and how to stop one without signing in
--
-- There are **forty-five** notification kinds, not the thirty the plan
-- estimated, and they are spread across a hundred migrations under two naming
-- conventions (`badge-awarded` and `badge_awarded` both exist). Counting them
-- is what settled the design: forty-five switches is a screen nobody finishes,
-- and a table keyed on kind needs a migration every time a feature adds one.
-- So the preference is per **family**, and six families cover all forty-five.
--
-- **The map lives in `src/utils/notification-families.ts`, not here.** The plan
-- called for `notification_family(kind)` in SQL, and that was written before it
-- was clear that no SQL ever sends an email: `notify_person` writes the bell
-- row, and every email goes out through one TypeScript funnel, `deliver()`.
-- A copy of the map in SQL would have no caller and would drift from the one
-- that does. The plan's actual requirement, one place decides, is kept and
-- made stronger: `deliver()` now takes the kind as a typed argument, so a
-- sender that forgets the gate does not compile. The map's test reads these
-- migrations and fails if a kind is sent that nobody has placed.
--
-- **The preference gates the email, never the bell.** A notification row is
-- free and already written by a trigger; an email is the thing that interrupts
-- somebody. Turning a family off stops the email and leaves the record, so the
-- bell stays the honest log of what happened. `bell` is stored anyway, and the
-- screen shows it, so the column is there the day the client wants one of these
-- gone entirely.
--
-- A missing row means on, with the default read from the family. No backfill,
-- so a new account needs no write and nobody's preferences are invented for
-- them.
--
-- Checked on a throwaway Postgres built from every migration: a member saves
-- and re-saves a family, cannot write anybody else's row, cannot read anybody
-- else's, an unsubscribe token is reused rather than reissued, applying one
-- twice is not an error, and neither table carries a whole-table grant.

-- ---------------------------------------------------------------------------
-- 1. The preferences
-- ---------------------------------------------------------------------------

create table if not exists public.notification_preferences (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  family     text not null,
  bell       boolean not null default true,
  email      boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (profile_id, family),
  constraint notification_preferences_family_known check (
    family in ('replies', 'bookings', 'membership', 'events', 'running', 'money'))
);

comment on table public.notification_preferences is
  'One row per person per family, written only when they change something. '
  'The map from kind to family is src/utils/notification-families.ts.';

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_read_own on public.notification_preferences;
create policy notification_preferences_read_own
  on public.notification_preferences for select to authenticated
  using (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Stopping one email without signing in
-- ---------------------------------------------------------------------------

/*
 * The person who most wants to unsubscribe is the person least willing to log
 * in to do it. One token per person per family, reused rather than reissued so
 * that a link in a March email still works in September, and `used_at` only
 * records the last press. A second press is not an error: telling somebody
 * their unsubscribe link is invalid is how a spam complaint starts.
 *
 * The token carries no address and no name. Resolving one answers which family
 * it is for and nothing else.
 */
create table if not exists public.unsubscribe_tokens (
  token      text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  family     text not null,
  created_at timestamptz not null default now(),
  used_at    timestamptz,
  constraint unsubscribe_tokens_family_known check (
    family in ('replies', 'bookings', 'membership', 'events', 'running', 'money'))
);

create unique index if not exists unsubscribe_tokens_one_per_family
  on public.unsubscribe_tokens (profile_id, family);

alter table public.unsubscribe_tokens enable row level security;
-- No policy. A token is a secret, so it is reachable only through the definer
-- functions below, which never return one they were not handed.

-- ---------------------------------------------------------------------------
-- 3. Reading and writing them
-- ---------------------------------------------------------------------------

/** A member changing their own mind. Upsert, because a first change has no row. */
create or replace function public.save_notification_preference(
  p_family text, p_bell boolean, p_email boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  -- "Replies to things you did" cannot be turned off by email. Enforced here
  -- rather than only in the screen, because a switch the server honours is the
  -- only one that is really locked.
  if p_family = 'replies' and p_email is distinct from true then
    raise exception 'REPLIES_EMAIL_LOCKED';
  end if;

  insert into public.notification_preferences (profile_id, family, bell, email)
  values (v_me, p_family, coalesce(p_bell, true), coalesce(p_email, true))
  on conflict (profile_id, family) do update
    set bell = excluded.bell, email = excluded.email, updated_at = now();
end;
$$;

/**
 * The token for one family, made on first use and handed back every time after.
 *
 * Service role only: it is called while addressing an email, on behalf of
 * somebody who is not the caller. Two uuids rather than one, so the token is
 * 256 bits and not something anybody can guess from a row they already have;
 * `gen_random_bytes` would have been the obvious choice and is pgcrypto, which
 * a function pinned to `search_path = public` cannot see.
 */
create or replace function public.issue_unsubscribe_token(p_profile uuid, p_family text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if p_profile is null or p_family is null then
    return null;
  end if;

  insert into public.unsubscribe_tokens (token, profile_id, family)
  values (replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', ''), p_profile, p_family)
  on conflict (profile_id, family) do nothing;

  select token into v_token from public.unsubscribe_tokens
   where profile_id = p_profile and family = p_family;

  return v_token;
end;
$$;

/** What a link is for, without saying whose it is. */
create or replace function public.resolve_unsubscribe_token(p_token text)
returns table (family text, already_off boolean)
language sql
stable
security definer
set search_path = public
as $$
  select t.family,
         coalesce((select not p.email from public.notification_preferences p
                    where p.profile_id = t.profile_id and p.family = t.family), false)
    from public.unsubscribe_tokens t
   where t.token = p_token;
$$;

/** The press. Idempotent, so a second click says the same thing as the first. */
create or replace function public.apply_unsubscribe(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.unsubscribe_tokens;
begin
  select * into v_row from public.unsubscribe_tokens where token = p_token;
  if v_row.token is null then
    return null;
  end if;

  insert into public.notification_preferences (profile_id, family, bell, email)
  values (v_row.profile_id, v_row.family, true, false)
  on conflict (profile_id, family) do update
    set email = false, updated_at = now();

  update public.unsubscribe_tokens set used_at = now() where token = p_token;

  return v_row.family;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------

-- `revoke all` first, then grant back the one thing that is wanted. Supabase's
-- whole-table grant carries TRUNCATE, REFERENCES and TRIGGER as well as the
-- four privileges anybody thinks to name, and **TRUNCATE is not filtered by
-- RLS**: a policy that hides every row does nothing about a role that can
-- empty the table. The local harness does not reproduce those grants, so the
-- shorter form looks complete there and is not.
revoke all on public.notification_preferences from authenticated, anon;
revoke all on public.unsubscribe_tokens from authenticated, anon;

-- Reading your own rows, filtered by the policy above. Nothing else.
grant select on public.notification_preferences to authenticated;

revoke all on function public.save_notification_preference(text, boolean, boolean) from public, anon;
revoke all on function public.issue_unsubscribe_token(uuid, text) from public, anon, authenticated;
revoke all on function public.resolve_unsubscribe_token(text) from public;
revoke all on function public.apply_unsubscribe(text) from public;

grant execute on function public.save_notification_preference(text, boolean, boolean) to authenticated;
grant execute on function public.issue_unsubscribe_token(uuid, text) to service_role;
-- Signed out is the whole point of these two.
grant execute on function public.resolve_unsubscribe_token(text) to anon, authenticated;
grant execute on function public.apply_unsubscribe(text) to anon, authenticated;

-- The guard, so a whole-table grant fails the migration rather than the audit.
do $$
declare v_bad boolean; v_table text;
begin
  foreach v_table in array array['notification_preferences', 'unsubscribe_tokens'] loop
    -- Everything except the one SELECT granted back above.
    select bool_or(true) into v_bad
      from information_schema.role_table_grants
     where table_name = v_table and grantee = 'authenticated'
       and not (table_name = 'notification_preferences' and privilege_type = 'SELECT');
    if coalesce(v_bad, false) then
      raise exception '% still carries a grant to authenticated', v_table;
    end if;
  end loop;
end $$;
