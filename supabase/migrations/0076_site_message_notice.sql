-- 0076 · The notice for a message from the site
--
-- notify_on_message built its link by concatenating the club id into a path.
-- A message from the site has no club, and `'/a/' || null || '/b'` is null in
-- Postgres rather than '/a//b', so the whole href came out null and clicking
-- the notification did nothing at all. The entity id went the same way, which
-- also broke the dedupe that stops one thread ringing the bell twice.
--
-- Zero is what the application already calls the site, so the link is built
-- with that, and the notice says who it is from rather than leaving the line
-- blank where a club name would be.

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  -- A plain text variable, not a record. plpgsql evaluates the whole CASE
  -- before choosing a branch, and referring to an unassigned record raises
  -- even in the arm that never runs.
  club_name text := '';
  from_site boolean := new.club_id is null;
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
  select full_name into sender_name from public.profiles where id = new.sender_id;
  if not from_site then
    select name into club_name from public.clubs where id = new.club_id;
  end if;

  perform public.notify_person(
    new.recipient_id,
    -- Its own kind, so the bell can mark it. A notice from the site is not one
    -- more message from one more member, and it should not look like one.
    case when from_site then 'site_message' else 'message' end,
    case
      when from_site
        then 'FindAGamesClub sent you a message'
      else coalesce(nullif(btrim(sender_name), ''), 'A member') || ' messaged you'
    end,
    case
      when from_site
        then 'From the site team, about your account.'
      else coalesce(club_name, '')
    end,
    inbox || club_key || '/' || new.sender_id,
    'thread',
    club_key || ':' || new.sender_id
  );
  return new;
end;
$$;

-- Notices written before this fix carry a null href, because concatenating the
-- missing club into the path produced null rather than a path. Nothing can be
-- reconstructed from the row, and a notification with nowhere to go is worse
-- than none: it is read as broken. Removed rather than left to be clicked.
delete from public.notifications
 where kind = 'message' and (href is null or btrim(href) = '');

-- Notices already written point at whichever shell was right when they were
-- created, and for an admin that was the member area. The application corrects
-- this on the way out too, because a role can change after a notice is
-- written, but the stored rows are worth repairing so the data is not lying.
update public.notifications n
   set href = '/admin/messages/' || substring(n.href from length('/account/messages/') + 1)
  from public.profiles p
 where p.id = n.profile_id
   and p.role = 'admin'
   and n.href like '/account/messages/%';
