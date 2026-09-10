-- 0077 · A message notice says who wrote it, what they are, and what they said
--
-- The bell said "FindAGamesClub sent you a message · From the site team, about
-- your account" for every message on a site thread, in both directions. When a
-- member replied to the admin, the admin was told the site team had written to
-- them. The notice described the channel, not the sender, so the one thing a
-- reader wants from it — who this is and whether it needs answering — was the
-- one thing missing.
--
-- Three parts to a notice now: who wrote it, what they are, and the opening of
-- what they wrote. `body` alone could not carry all three, so the standing of
-- the sender moves to its own column. It is empty for every other kind, which
-- renders exactly as those kinds render today.

alter table public.notifications
  add column if not exists meta text not null default '';

-- Whole-table select grant, so the new column is already readable. Stated
-- rather than assumed: a column grant here would have needed extending and the
-- rows would have come back short with no error.
grant select on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- 1. What the notice says
-- ---------------------------------------------------------------------------

/**
 * The opening of a message, on one or two lines.
 *
 * Newlines and runs of spaces collapse, because a message that starts with a
 * blank line would otherwise show as an empty preview. Cut on a space so the
 * preview does not end mid-word, unless the tail has no space to cut on.
 */
create or replace function public.message_preview(p_content text)
returns text
language sql
immutable
as $$
  with flat as (
    select btrim(regexp_replace(coalesce(p_content, ''), '\s+', ' ', 'g')) as t
  ), cut as (
    select t, left(t, 180) as head from flat
  )
  select case
    when char_length(t) <= 180 then t
    when position(' ' in reverse(head)) between 1 and 40
      then btrim(left(head, 180 - position(' ' in reverse(head)))) || '…'
    else btrim(head) || '…'
  end
  from cut;
$$;

/**
 * What the sender is to the person reading: their standing, and where.
 *
 * "Somebody messaged you" is not enough to decide whether to open it. An owner
 * writing about a booking, a site admin writing about an account and a member
 * saying hello need different amounts of attention, and the name alone does not
 * say which is which.
 *
 * On a club thread that is their role at that club. On the site's own thread
 * there is no club, so an admin is the site and anybody else is placed by the
 * club they run, which is the only thing that says who they are.
 */
create or replace function public.message_sender_line(p_club bigint, p_sender uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  site_admin boolean;
  role_here text;
  club_name text;
begin
  select p.role = 'admin' into site_admin from public.profiles p where p.id = p_sender;

  if p_club is null then
    if coalesce(site_admin, false) then
      return 'SITE ADMIN';
    end if;

    select upper(t.role) || ' · ' || upper(c.name) into role_here
      from public.club_team t
      join public.clubs c on c.id = t.club_id
     where t.profile_id = p_sender
     order by case t.role when 'owner' then 1 when 'manager' then 2 else 3 end, c.name
     limit 1;

    return coalesce(role_here, 'MEMBER');
  end if;

  select c.name into club_name from public.clubs c where c.id = p_club;
  role_here := public.club_role_for(p_club, p_sender);

  -- An admin holds no row in club_team, and writing from a club's inbox is
  -- still writing as the site.
  if role_here is null and coalesce(site_admin, false) then
    role_here := 'site admin';
  end if;

  if role_here is null and exists (
    select 1 from public.club_memberships m
     where m.club_id = p_club and m.profile_id = p_sender and m.status = 'approved'
  ) then
    role_here := 'member';
  end if;

  return upper(coalesce(role_here, 'member'))
      || coalesce(' · ' || upper(club_name), '');
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. The extra line, carried through the one function that writes notices
-- ---------------------------------------------------------------------------

-- Dropped rather than replaced: `create or replace` with a longer argument list
-- makes an overload, and every existing seven-argument call would then match
-- two candidates and raise "function is not unique".
drop function if exists public.notify_person(uuid, text, text, text, text, text, text);

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
  p_entity_id text default '',
  p_meta text default ''
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
    (profile_id, kind, title, body, href, entity_type, entity_id, meta)
  values
    (p_target, p_kind, p_title, coalesce(p_body, ''), coalesce(p_href, ''),
     coalesce(p_entity_type, ''), coalesce(p_entity_id, ''), coalesce(p_meta, ''))
  on conflict (profile_id, kind, entity_type, entity_id)
    where read_at is null and entity_id <> ''
  do update set
    title = excluded.title,
    body = excluded.body,
    meta = excluded.meta,
    created_at = now();
end;
$$;

revoke all on function public.notify_person(uuid, text, text, text, text, text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The message notice itself
-- ---------------------------------------------------------------------------

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  -- The application's name for "no club". Kept here so the link it builds and
  -- the link the app reads are the same string.
  club_key text := coalesce(new.club_id::text, '0');
  -- Where the reader's messages live. An admin's are in their console, and
  -- sending them to the member area drops them into a shell with a different
  -- rail, no clubs, and a New button that offers nobody.
  inbox text := case
    when exists (select 1 from public.profiles p
                  where p.id = new.recipient_id and p.role = 'admin')
      then '/admin/messages/'
    else '/account/messages/'
  end;
begin
  select coalesce(nullif(btrim(full_name), ''), 'Somebody') into sender_name
    from public.profiles where id = new.sender_id;

  perform public.notify_person(
    new.recipient_id,
    -- Its own kind for the site's thread, so the bell can mark it. That thread
    -- is not one more conversation with one more member and should not look
    -- like one, whichever end the message came from.
    case when new.club_id is null then 'site_message' else 'message' end,
    sender_name || ' sent you a message',
    public.message_preview(new.content),
    inbox || club_key || '/' || new.sender_id,
    'thread',
    club_key || ':' || new.sender_id,
    public.message_sender_line(new.club_id, new.sender_id)
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The notices already written
-- ---------------------------------------------------------------------------

-- Every message notice standing today describes the channel, and half of them
-- name the wrong sender. The thread is recoverable from the entity id it was
-- deduped on, so they are rewritten rather than left to be read.
with waiting as (
  select n.id as notice_id,
         n.profile_id,
         nullif(split_part(n.entity_id, ':', 1), '0')::bigint as club_id,
         split_part(n.entity_id, ':', 2)::uuid as sender_id
    from public.notifications n
   where n.kind in ('message', 'site_message')
     and n.entity_type = 'thread'
     and n.entity_id ~* '^[0-9]+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
update public.notifications n
   set kind = case when w.club_id is null then 'site_message' else 'message' end,
       title = coalesce(nullif(btrim(p.full_name), ''), 'Somebody') || ' sent you a message',
       meta = public.message_sender_line(w.club_id, w.sender_id),
       -- Left empty when the message behind the notice has gone, which drops
       -- the row to its title and its standing line rather than keeping a
       -- sentence about the site team under somebody else's name.
       body = case when m.content is null then ''
                   else public.message_preview(m.content) end
  from waiting w
  join public.profiles p on p.id = w.sender_id
  left join lateral (
    select c.content
      from public.club_messages c
     where c.sender_id = w.sender_id
       and c.recipient_id = w.profile_id
       and c.club_id is not distinct from w.club_id
     order by c.created_at desc
     limit 1
  ) m on true
 where n.id = w.notice_id;
