-- 0149 · What is due to be sent, and what has already gone
--
-- **The matching is deliberately not in SQL.** The plan called for
-- `match_event_alerts` to apply "the same rules `utils/event-filters.ts`
-- applies on the page". Reading that file settled it the other way: the page
-- does not filter in SQL at all. `listEvents` reads the events, folds accents
-- and case, splits the search into facets, resolves a place name to
-- coordinates and measures distance, all in TypeScript. A second
-- implementation in SQL would be two sets of rules for one saved search, which
-- is exactly the disagreement the plan set out to prevent. So SQL answers only
-- "which alerts are due and what is their window", and the cron route runs the
-- member's saved filters through `listEvents` itself. Same code, same answer.
--
-- Twenty hours rather than twenty-four, so a daily job that drifts by a few
-- minutes does not skip a day. The window starts at `last_sent_at`, or at the
-- alert's own `created_at` on the first run, so somebody who saves a search
-- today is told about what appears after today rather than about the whole
-- directory at once.
--
-- `notification_deliveries` is the ledger every scheduled email checks first.
-- A trigger-sent email happens because a row was written, and the row is its
-- own proof; a job that looks for a date passing has no such proof and will
-- send again tomorrow unless something remembers. One row per person per kind
-- per thing, and `record_delivery` returns false when it has gone already.
--
-- Checked on a throwaway Postgres built from every migration: an alert becomes
-- due and stops being due once marked, a first run windows from `created_at`,
-- `record_delivery` returns true once and false after, the expiry read matches
-- what `warn_expiring_memberships` notifies about, and neither new table
-- carries a whole-table grant.

-- ---------------------------------------------------------------------------
-- 1. Which saved searches are due
-- ---------------------------------------------------------------------------

create or replace function public.event_alerts_due(p_limit integer default 200)
returns table (
  id bigint, profile_id uuid, label text, filters jsonb, since timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.profile_id, a.label, a.filters,
         coalesce(a.last_sent_at, a.created_at)
    from public.club_event_alerts a
   where a.last_sent_at is null
      or a.last_sent_at < now() - interval '20 hours'
   order by coalesce(a.last_sent_at, a.created_at)
   limit greatest(coalesce(p_limit, 200), 1);
$$;

/** Marked in one statement, whether or not anything matched. A search with no
    new events has still been looked at, and re-looking every hour is waste. */
create or replace function public.mark_event_alerts_sent(p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  update public.club_event_alerts
     set last_sent_at = now()
   where id = any (coalesce(p_ids, '{}'::bigint[]));
  get diagnostics touched = row_count;
  return touched;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. What has already been sent
-- ---------------------------------------------------------------------------

create table if not exists public.notification_deliveries (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  entity_key text not null default '',
  sent_at    timestamptz not null default now(),
  primary key (profile_id, kind, entity_key)
);

comment on table public.notification_deliveries is
  'Scheduled email only. A trigger-sent email is proved by the row that caused '
  'it; a job that watches a date pass needs this instead.';

create index if not exists notification_deliveries_age
  on public.notification_deliveries (sent_at);

alter table public.notification_deliveries enable row level security;
-- No policy. Nobody reads this but the jobs, through the function below.

/**
 * True the first time, false every time after.
 *
 * The insert is the claim, so two jobs racing cannot both be told to send: the
 * loser's `on conflict` writes nothing and it gets false.
 */
create or replace function public.record_delivery(
  p_profile uuid, p_kind text, p_key text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  fresh integer;
begin
  if p_profile is null or p_kind is null then
    return false;
  end if;

  insert into public.notification_deliveries (profile_id, kind, entity_key)
  values (p_profile, p_kind, coalesce(p_key, ''))
  on conflict (profile_id, kind, entity_key) do nothing;

  get diagnostics fresh = row_count;
  return fresh = 1;
end;
$$;

/** Two years is long past any period these keys name. */
create or replace function public.prune_notification_deliveries(keep interval default '24 months')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.notification_deliveries where sent_at < now() - keep;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Memberships running out, and memberships that have
-- ---------------------------------------------------------------------------

/*
 * 0028 already warns the bell a week ahead, with the period's end date folded
 * into the notification's identity so a member gets one warning per period.
 * These two read the same thing so the job can also write to them, and the
 * period end comes back as the delivery key for the same reason.
 *
 * `paid_through` repeats 0028's calculation rather than sharing it, because
 * 0028's version is inside a loop that notifies. Splitting it out would rewrite
 * a working job to add a read; the SQL test asserts the two agree.
 */
create or replace function public.memberships_expiring(p_within interval default '7 days')
returns table (
  membership_id bigint, profile_id uuid, club_slug text, club_name text,
  tier_key text, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.profile_id, c.slug, c.name, m.tier_key, paid.ends_at
    from public.club_memberships m
    join public.clubs c on c.id = m.club_id
    join lateral (
      select max(p.period_end_at) as ends_at
        from public.club_membership_payments p
       where p.membership_id = m.id
         and p.tier_key is not distinct from m.tier_key
         and (m.tier_assigned_at is null or p.created_at >= m.tier_assigned_at)
    ) paid on true
   where m.status = 'approved'
     and paid.ends_at is not null
     and paid.ends_at >= now()
     and paid.ends_at <= now() + coalesce(p_within, interval '7 days')
   order by paid.ends_at;
$$;

/** The ones that ran out since the job last looked. */
create or replace function public.memberships_lapsed(p_since interval default '25 hours')
returns table (
  membership_id bigint, profile_id uuid, club_slug text, club_name text,
  tier_key text, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.profile_id, c.slug, c.name, m.tier_key, paid.ends_at
    from public.club_memberships m
    join public.clubs c on c.id = m.club_id
    join lateral (
      select max(p.period_end_at) as ends_at
        from public.club_membership_payments p
       where p.membership_id = m.id
         and p.tier_key is not distinct from m.tier_key
         and (m.tier_assigned_at is null or p.created_at >= m.tier_assigned_at)
    ) paid on true
   where m.status = 'approved'
     and paid.ends_at is not null
     and paid.ends_at < now()
     and paid.ends_at >= now() - coalesce(p_since, interval '25 hours')
   order by paid.ends_at;
$$;

-- ---------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------

-- `revoke all`, not a list of the four privileges anybody thinks about.
-- Supabase's whole-table grant also carries TRUNCATE, REFERENCES and TRIGGER,
-- and **TRUNCATE is not filtered by RLS**: a policy that hides every row does
-- nothing about a role that can empty the table. Naming four privileges passed
-- the local harness, which does not reproduce Supabase's table grants, and
-- failed this migration's own guard on the real database. The guard was right.
revoke all on public.notification_deliveries from authenticated, anon;

revoke all on function public.event_alerts_due(integer) from public, anon, authenticated;
revoke all on function public.mark_event_alerts_sent(bigint[]) from public, anon, authenticated;
revoke all on function public.record_delivery(uuid, text, text) from public, anon, authenticated;
revoke all on function public.prune_notification_deliveries(interval) from public, anon, authenticated;
revoke all on function public.memberships_expiring(interval) from public, anon, authenticated;
revoke all on function public.memberships_lapsed(interval) from public, anon, authenticated;

-- The cron routes hold the service role and nothing else calls these.
grant execute on function public.event_alerts_due(integer) to service_role;
grant execute on function public.mark_event_alerts_sent(bigint[]) to service_role;
grant execute on function public.record_delivery(uuid, text, text) to service_role;
grant execute on function public.prune_notification_deliveries(interval) to service_role;
grant execute on function public.memberships_expiring(interval) to service_role;
grant execute on function public.memberships_lapsed(interval) to service_role;

-- ---------------------------------------------------------------------------
-- 5. The prune, beside the other two
-- ---------------------------------------------------------------------------

-- Pure SQL and time-based, so pg_cron rather than a route: CLAUDE.md's rule is
-- that a Vercel cron is for a job that needs to send something.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('prune-notification-deliveries')
      where exists (select 1 from cron.job where jobname = 'prune-notification-deliveries');
    perform cron.schedule(
      'prune-notification-deliveries', '50 3 * * 0',
      $job$ select public.prune_notification_deliveries() $job$);
  else
    raise notice 'pg_cron is not enabled, so the delivery prune was not scheduled';
  end if;
end $$;

do $$
declare v_bad boolean;
begin
  select bool_or(column_name is null) into v_bad from (
    select null::text as column_name from information_schema.role_table_grants
     where table_name = 'notification_deliveries' and grantee = 'authenticated'
    union all
    select column_name from information_schema.role_column_grants
     where table_name = 'notification_deliveries' and grantee = 'authenticated') g;
  if coalesce(v_bad, false) then
    raise exception 'notification_deliveries still carries a grant to authenticated';
  end if;
end $$;
