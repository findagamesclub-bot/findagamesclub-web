-- 0090 · A club can run its own events
--
-- Until now `club_events` carried one policy and it was a select. Everything
-- about an event, its title, its dates, its ticket types, its notices, was
-- readable by the whole internet and writable by nobody: a club fixing a typo
-- had to ask for the SQL console. This is the write side.
--
-- Three things beyond the obvious grants:
--
--   `status`        drafts. Legacy has no such idea, so every row that exists
--                   today is published, and the select policy has to narrow or
--                   a draft would be public the moment it is saved.
--   `legacy_id`     is the URL. It is generated once, from the date and the
--                   title, and never changes afterwards, because a link in
--                   somebody's email has to keep working.
--   ticket guards   a ticket type somebody holds cannot be deleted, repriced,
--                   or cut below what is already sold.

-- ------------------------------------------------------------------ columns

alter table public.club_events
  add column if not exists status text not null default 'published',
  add column if not exists published_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists logo_path text;

do $$
begin
  alter table public.club_events
    add constraint club_events_status_check
    check (status in ('draft', 'published', 'cancelled'));
exception
  when duplicate_object then null;
end $$;

-- Everything imported is live, and has been since milestone 1.
update public.club_events
   set published_at = coalesce(published_at, created_at)
 where status = 'published' and published_at is null;

create index if not exists club_events_status_idx
  on public.club_events (club_id, status, start_date desc);

-- ----------------------------------------------------------------- reading
--
-- A draft belongs to the club that is writing it. Everybody else reads the
-- table exactly as before.
--
-- Two policies, not one, and this is the whole reason: 0067 revokes
-- `club_can` from `anon` on purpose, so a single policy naming it would fail
-- every signed-out visitor with "permission denied for function club_can"
-- rather than simply hiding the draft. Policies are OR'd and each only applies
-- to its own role, so the signed-out half never reaches the function.

drop policy if exists club_events_public on public.club_events;
drop policy if exists club_events_public_anon on public.club_events;

create policy club_events_public_anon on public.club_events
  for select to anon
  using (status <> 'draft');

create policy club_events_public on public.club_events
  for select to authenticated
  using (status <> 'draft' or public.club_can(club_id, 'events.manage'));

-- ----------------------------------------------------------------- writing

revoke insert, update, delete on
  public.club_events, public.club_event_ticket_types,
  public.club_event_notices, public.club_event_social_links
  from authenticated, anon;

drop policy if exists club_events_write on public.club_events;
create policy club_events_write on public.club_events
  for all to authenticated
  using (public.club_can(club_id, 'events.manage'))
  with check (public.club_can(club_id, 'events.manage'));

-- `club_id` and `legacy_id` are insertable and never updatable: one decides
-- whose event it is and the other is the URL.
grant insert (club_id, legacy_id, title, summary, price, start_date, start_time,
              end_date, end_time, venue_name, venue_address, venue_postcode,
              formats, event_types, featured_games, facilities, event_type,
              info_board, bestcoast_link, logo_src, logo_alt, logo_path,
              round_count, tickets_available, status, published_at, cancel_reason),
      update (title, summary, price, start_date, start_time, end_date, end_time,
              venue_name, venue_address, venue_postcode,
              formats, event_types, featured_games, facilities, event_type,
              info_board, bestcoast_link, logo_src, logo_alt, logo_path,
              round_count, tickets_available, status, published_at, cancel_reason)
  on public.club_events to authenticated;

grant delete on public.club_events to authenticated;

-- The three children hang off the event, so their policy is the event's.
do $$
declare
  child text;
begin
  foreach child in array array['club_event_ticket_types', 'club_event_notices',
                               'club_event_social_links']
  loop
    execute format('drop policy if exists %I on public.%I', child || '_write', child);
    execute format($f$
      create policy %I on public.%I
        for all to authenticated
        using (exists (select 1 from public.club_events e
                        where e.id = event_id and public.club_can(e.club_id, 'events.manage')))
        with check (exists (select 1 from public.club_events e
                             where e.id = event_id and public.club_can(e.club_id, 'events.manage')))
    $f$, child || '_write', child);
  end loop;
end $$;

grant insert (event_id, label, price, audience, audience_label, minimum_tier_key,
              quantity_available, position),
      update (label, price, audience, audience_label, minimum_tier_key,
              quantity_available, position)
  on public.club_event_ticket_types to authenticated;

grant insert (event_id, message, created_at), update (message)
  on public.club_event_notices to authenticated;

grant insert (event_id, label, url, position), update (label, url, position)
  on public.club_event_social_links to authenticated;

grant delete on
  public.club_event_ticket_types, public.club_event_notices,
  public.club_event_social_links to authenticated;

-- ------------------------------------------------------------ creating one
--
-- Through a function because `legacy_id` is the URL and has to be unique
-- within the club. A club naming two events the same thing on the same day
-- gets a numbered suffix rather than an error it cannot act on.

create or replace function public.create_club_event(
  p_club bigint, p_title text, p_start_date date
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  base  text;
  key   text;
  n     integer := 2;
  fresh bigint;
begin
  if not public.club_can(p_club, 'events.manage') then
    raise exception 'NOT_PERMITTED';
  end if;
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'EVENT_NEEDS_TITLE';
  end if;
  if p_start_date is null then
    raise exception 'EVENT_NEEDS_DATE';
  end if;

  base := coalesce(nullif(public.slugify(p_title), ''), 'event');
  key := to_char(p_start_date, 'YYYY-MM-DD') || '-' || base;

  while exists (select 1 from public.club_events
                 where club_id = p_club and legacy_id = key) loop
    key := to_char(p_start_date, 'YYYY-MM-DD') || '-' || base || '-' || n;
    n := n + 1;
  end loop;

  insert into public.club_events (club_id, legacy_id, title, start_date, status)
  values (p_club, key, btrim(p_title), p_start_date, 'draft')
  returning id into fresh;

  return fresh;
end;
$$;

revoke all on function public.create_club_event(bigint, text, date) from public, anon;
grant execute on function public.create_club_event(bigint, text, date) to authenticated;

-- ------------------------------------------------------------- the refusals

/**
 * An event somebody holds a ticket for is not deletable.
 *
 * Cancelling it is the move: that keeps the booking, so the club still has the
 * list of who to tell, and the member still has a record of what they bought.
 */
create or replace function public.club_events_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  live integer;
begin
  select count(*) into live
    from public.club_event_bookings
   where event_id = old.id and status <> 'cancelled';

  if live > 0 then
    raise exception 'EVENT_HAS_BOOKINGS: % % a ticket for %',
      live,
      case when live = 1 then 'person holds' else 'people hold' end,
      old.title
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists club_events_no_delete_with_bookings on public.club_events;
create trigger club_events_no_delete_with_bookings
  before delete on public.club_events
  for each row execute function public.club_events_delete_guard();

/**
 * A ticket type people have bought is close to frozen.
 *
 * The price, the audience and the tier are what somebody agreed to when they
 * booked, so they cannot move underneath them, and the quantity cannot drop
 * below what is already taken. Closing a type is done by setting its quantity
 * to exactly what has gone.
 */
create or replace function public.club_event_ticket_types_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  taken integer;
begin
  select coalesce(sum(i.quantity), 0) into taken
    from public.club_event_booking_items i
    join public.club_event_bookings b on b.id = i.booking_id
   where i.ticket_type_id = coalesce(new.id, old.id)
     and b.status <> 'cancelled';

  if taken = 0 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'TICKET_TYPE_SOLD: % of % have gone', taken, old.label
      using errcode = 'check_violation';
  end if;

  if new.price is distinct from old.price
     or new.audience is distinct from old.audience
     or new.minimum_tier_key is distinct from old.minimum_tier_key then
    raise exception 'TICKET_LOCKED: % has been sold, so its price and who it is for cannot change',
      old.label using errcode = 'check_violation';
  end if;

  if new.quantity_available is not null and new.quantity_available < taken then
    raise exception 'TICKET_QUANTITY_BELOW_TAKEN: % of % have gone', taken, old.label
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists club_event_ticket_types_locked on public.club_event_ticket_types;
create trigger club_event_ticket_types_locked
  before update or delete on public.club_event_ticket_types
  for each row execute function public.club_event_ticket_types_guard();

-- --------------------------------------------------------------- the guard
--
-- Supabase grants `authenticated` the whole table on create, and a later
-- column grant is additive rather than a replacement. Every one of these was
-- revoked above; this fails the migration loudly if one was missed.

do $$
declare
  bad boolean;
  t   text;
begin
  foreach t in array array['club_events', 'club_event_ticket_types',
                           'club_event_notices', 'club_event_social_links']
  loop
    execute format($q$
      select bool_or(column_name is null) from (
        select null::text as column_name from information_schema.role_table_grants
         where table_name = %L and grantee = 'authenticated'
           and privilege_type in ('INSERT', 'UPDATE')
        union all
        select column_name from information_schema.role_column_grants
         where table_name = %L and grantee = 'authenticated'
           and privilege_type in ('INSERT', 'UPDATE')
      ) g $q$, t, t) into bad;

    if bad then
      raise exception '% carries a whole-table grant', t;
    end if;
  end loop;
end $$;
