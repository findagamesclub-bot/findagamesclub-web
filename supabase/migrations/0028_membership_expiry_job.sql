-- 0028 · Warning people before their membership lapses, and tidying up after
--
-- A payment running out is not an event: no row is inserted when a date
-- passes, so no trigger and no realtime subscription will ever fire for it.
-- It has to be looked for, which means a scheduled job.
--
-- Requires pg_cron. Enable it first (Database → Extensions → pg_cron), then
-- run this. Everything except the last block works without it, so the
-- functions can also be called by hand.

/**
 * Warn members whose paid-up period ends within the next week.
 *
 * Paid-through is the same calculation the app makes: the latest period end
 * among payments for the tier they are on now. Payments toward a tier they
 * have since left do not count, which is what tier_assigned_at is for.
 *
 * The period's end date is part of the notification's identity, so a member
 * gets one warning per period rather than one a night, and renewing then
 * lapsing again later is a fresh warning rather than a silent one.
 */
create or replace function public.warn_expiring_memberships(within interval default '7 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  row record;
  sent integer := 0;
begin
  for row in
    select m.id, m.profile_id, c.name as club_name, c.slug as club_slug,
           paid.ends_at
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
       and paid.ends_at <= now() + within
  loop
    perform public.notify_person(
      row.profile_id,
      'membership_expiring',
      'Your ' || row.club_name || ' membership runs out soon',
      'It ends on ' || to_char(row.ends_at, 'DD Mon YYYY') || '.',
      '/account/memberships',
      'membership_period',
      row.id || ':' || to_char(row.ends_at, 'YYYY-MM-DD')
    );
    sent := sent + 1;
  end loop;

  return sent;
end;
$$;

/**
 * Drop notifications somebody read a long time ago.
 *
 * Unread ones are never touched, however old: an unread notification is still
 * something nobody has dealt with. This is what stops the table growing for
 * ever, which is the usual way a bell gets slow.
 */
create or replace function public.prune_notifications(keep interval default '90 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.notifications
   where read_at is not null
     and read_at < now() - keep;

  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.warn_expiring_memberships(interval) from public, anon, authenticated;
revoke all on function public.prune_notifications(interval) from public, anon, authenticated;

-- --------------------------------------------------------------- scheduling
--
-- Guarded, so this migration still applies on a project without pg_cron and
-- can be re-run once it is enabled. Times are UTC. Both jobs are idempotent:
-- the warning dedupes on the period, the prune only removes what is already
-- read, so a missed night costs nothing and a double run changes nothing.

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron is not enabled; functions created but not scheduled';
    return;
  end if;

  perform cron.unschedule('warn-expiring-memberships')
    where exists (select 1 from cron.job where jobname = 'warn-expiring-memberships');
  perform cron.unschedule('prune-notifications')
    where exists (select 1 from cron.job where jobname = 'prune-notifications');

  -- 08:00 UTC: a warning that lands overnight is read in the morning anyway.
  perform cron.schedule(
    'warn-expiring-memberships', '0 8 * * *',
    $job$ select public.warn_expiring_memberships(); $job$
  );

  -- 03:30 UTC, when nobody is looking.
  perform cron.schedule(
    'prune-notifications', '30 3 * * *',
    $job$ select public.prune_notifications(); $job$
  );
end;
$$;
