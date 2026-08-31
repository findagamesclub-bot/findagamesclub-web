-- 0027 · The bell
--
-- One row per thing that happened to somebody, written by triggers on the
-- tables where those things happen. Triggers rather than application code:
-- a notification written by the app is missed the moment a row arrives from
-- the importer, an admin, a fix run by hand, or a feature written later.
--
-- Everything the panel shows is denormalised onto the row, so opening the bell
-- is one indexed read with no joins.

create table public.notifications (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  href text not null default '',
  -- What it is about. Two notifications of the same kind about the same thing
  -- are one notification with a newer timestamp, not two rows.
  entity_type text not null default '',
  entity_id text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- The badge counts unread rows for one person, so that is the index. Partial,
-- because read rows are never counted and there will be far more of them.
create index notifications_unread_idx
  on public.notifications (profile_id, created_at desc)
  where read_at is null;

create index notifications_recent_idx
  on public.notifications (profile_id, created_at desc);

-- Dedupe target. Only unread rows collapse: once somebody has read "3 new
-- messages", the next one is news again.
create unique index notifications_unread_entity_idx
  on public.notifications (profile_id, kind, entity_type, entity_id)
  where read_at is null and entity_id <> '';

/**
 * Add a notification, or freshen the one already waiting about the same thing.
 *
 * Fifty messages from one person must be one bell item. Collapsing here rather
 * than in the UI keeps the count meaningful and stops the table growing a row
 * per keystroke.
 */
create or replace function public.notify_person(
  p_target uuid,
  p_kind text,
  p_title text,
  p_body text default '',
  p_href text default '',
  p_entity_type text default '',
  p_entity_id text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nobody is told about their own doing.
  if p_target is null then
    return;
  end if;

  -- Prefixed parameters: named after the columns, every one of them would be
  -- ambiguous inside this INSERT and the function would raise.
  insert into public.notifications
    (profile_id, kind, title, body, href, entity_type, entity_id)
  values
    (p_target, p_kind, p_title, coalesce(p_body, ''), coalesce(p_href, ''),
     coalesce(p_entity_type, ''), coalesce(p_entity_id, ''))
  on conflict (profile_id, kind, entity_type, entity_id)
    where read_at is null and entity_id <> ''
  do update set
    title = excluded.title,
    body = excluded.body,
    created_at = now();
end;
$$;

-- ------------------------------------------------------------------ messages

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  club record;
begin
  select full_name into sender_name from public.profiles where id = new.sender_id;
  select slug, name into club from public.clubs where id = new.club_id;

  perform public.notify_person(
    new.recipient_id,
    'message',
    coalesce(nullif(btrim(sender_name), ''), 'A member') || ' messaged you',
    coalesce(club.name, ''),
    '/account/messages/' || new.club_id || '/' || new.sender_id,
    'thread',
    new.club_id || ':' || new.sender_id
  );
  return new;
end;
$$;

create trigger club_messages_notify
  after insert on public.club_messages
  for each row execute function public.notify_on_message();

-- --------------------------------------------------------------- memberships

create or replace function public.notify_on_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  club record;
  who text;
begin
  select slug, name, owner_id into club from public.clubs where id = new.club_id;

  -- Somebody has applied. The club is the one who has to act.
  if tg_op = 'INSERT' and new.status = 'pending' then
    select full_name into who from public.profiles where id = new.profile_id;
    perform public.notify_person(
      club.owner_id, 'join_request',
      coalesce(nullif(btrim(who), ''), 'Someone') || ' wants to join',
      coalesce(club.name, ''),
      '/clubs/' || club.slug || '/members',
      'membership', new.id::text
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- The club has answered an application.
    if new.status is distinct from old.status then
      if new.status = 'approved' then
        perform public.notify_person(
          new.profile_id, 'membership',
          'You are in at ' || coalesce(club.name, 'the club'),
          'Your membership was approved.',
          '/clubs/' || club.slug, 'membership', new.id::text
        );
      elsif new.status = 'declined' then
        perform public.notify_person(
          new.profile_id, 'membership',
          coalesce(club.name, 'The club') || ' could not take you on',
          coalesce(new.decline_reason, ''),
          '/clubs/' || club.slug, 'membership', new.id::text
        );
      end if;
    end if;

    -- A member has asked to move tier, or the club has moved them.
    if new.requested_tier_key is distinct from old.requested_tier_key
       and new.requested_tier_key is not null then
      select full_name into who from public.profiles where id = new.profile_id;
      perform public.notify_person(
        club.owner_id, 'tier_request',
        coalesce(nullif(btrim(who), ''), 'A member') || ' wants a tier change',
        coalesce(club.name, ''),
        '/clubs/' || club.slug || '/members',
        'membership', new.id::text
      );
    end if;

    if new.tier_key is distinct from old.tier_key then
      perform public.notify_person(
        new.profile_id, 'tier',
        'Your tier changed at ' || coalesce(club.name, 'the club'),
        'You are now on ' || coalesce(new.tier_key, 'a new tier') || '.',
        '/account/memberships', 'membership', new.id::text
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger club_memberships_notify
  after insert or update on public.club_memberships
  for each row execute function public.notify_on_membership();

-- -------------------------------------------------------------------- rivals

create or replace function public.notify_on_rival()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who text;
  club record;
begin
  select full_name into who from public.profiles where id = new.profile_id;
  select slug, name into club from public.clubs where id = new.club_id;

  perform public.notify_person(
    new.rival_id, 'rival',
    coalesce(nullif(btrim(who), ''), 'A member') || ' named you a rival',
    coalesce(club.name, ''),
    '/clubs/' || club.slug || '/members',
    'rival', new.id::text
  );
  return new;
end;
$$;

create trigger club_rivals_notify
  after insert on public.club_rivals
  for each row execute function public.notify_on_rival();

-- ---------------------------------------------------------------- club kit

create or replace function public.notify_on_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  club record;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status <> 'fulfilled' then
    return new;
  end if;

  select slug, name into club from public.clubs where id = new.club_id;
  perform public.notify_person(
    new.profile_id, 'order',
    'Your order is ready at ' || coalesce(club.name, 'the club'),
    'Collect it next time you are in.',
    '/account/orders', 'order', new.id::text
  );
  return new;
end;
$$;

create trigger club_merchandise_orders_notify
  after update on public.club_merchandise_orders
  for each row execute function public.notify_on_order();

-- ----------------------------------------------------------------- policies

alter table public.notifications enable row level security;

create policy notifications_own on public.notifications
  for select to authenticated
  using (profile_id = auth.uid());

-- Marking as read is the only thing a person may write, and only on their own.
create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant select on public.notifications to authenticated;
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke all on function public.notify_person(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;

-- Realtime respects RLS on postgres_changes, so publishing this table changes
-- when somebody learns about their own rows, not which rows they can read.
alter publication supabase_realtime add table public.notifications;
alter table public.notifications replica identity default;
