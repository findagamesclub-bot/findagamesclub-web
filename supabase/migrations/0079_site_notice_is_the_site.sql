-- 0079 · A message from the site is from the site, not from whoever typed it
--
-- 0077 made every message notice name its sender, which was right for a club
-- and wrong for the site: a member has no idea who "gul-admin" is, and the one
-- thing that makes an official message worth opening is that it came from
-- FindAGamesClub. The name of the person on the other end is staff rota, not
-- something the reader needs.
--
-- The rule is about the sender, not the thread. A member replying to the site
-- team is still a person, and the admin reading that reply needs their name.

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  -- The site writing, rather than somebody writing to the site.
  from_site boolean := new.club_id is null and exists (
    select 1 from public.profiles p
     where p.id = new.sender_id and p.role = 'admin');
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
    case when new.club_id is null then 'site_message' else 'message' end,
    case when from_site
      then 'FindAGamesClub sent you a message'
      else sender_name || ' sent you a message' end,
    public.message_preview(new.content),
    inbox || club_key || '/' || new.sender_id,
    'thread',
    club_key || ':' || new.sender_id,
    -- No standing line under the site's own name. It would read SITE ADMIN
    -- under "FindAGamesClub sent you a message", which is the same fact twice
    -- and pushes the message itself further down the row.
    case when from_site then ''
         else public.message_sender_line(new.club_id, new.sender_id) end
  );
  return new;
end;
$$;

-- The ones already standing, so the panel is not half one wording and half the
-- other while the older notices are still on screen.
update public.notifications n
   set title = 'FindAGamesClub sent you a message',
       meta = ''
 where n.kind = 'site_message'
   and n.entity_type = 'thread'
   and n.entity_id ~* '^0:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and exists (
     select 1 from public.profiles p
      where p.id = substring(n.entity_id from 3)::uuid
        and p.role = 'admin');
