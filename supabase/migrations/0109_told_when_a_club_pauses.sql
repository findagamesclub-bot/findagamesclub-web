-- 0109 · Somebody should be told when a club leaves the directory
--
-- 0108 let a club take itself out and told nobody. The admin console went on
-- saying "Approved and live" about a club that is not live, which is the screen
-- stating something that stopped being true, and the only way to find out was
-- to go looking.
--
-- A club leaving the directory is platform news. It is the difference between
-- a directory of forty clubs and a directory of thirty-nine, it is usually the
-- first sign something is wrong at a club, and on a paid plan it is the thing
-- that comes just before a cancellation.
--
-- By trigger, not by the service, for the reason the loyalty awards and the
-- booking notices are: the status moves from the owner's console today and will
-- move from the admin's screens in Stage 5 and from the lapse job in Stage 6,
-- and a notice that only fires on one of those paths is worse than none.
--
-- Scale: one insert per active admin per pause. Pausing is rare and admins are
-- few, and if that ever stops being true the fix is a digest rather than
-- dropping the notice. The **email** already scales, because it goes once to
-- the site contact address rather than once per admin.
--
-- Only the two moves an owner makes. Suspending and restoring are an admin's
-- own doing and Stage 5 will have its own words for them.
--
-- Checked on a throwaway Postgres: pausing tells every active admin and not the
-- one who pressed it; resuming tells them too and marks the pause notice read,
-- so the bell does not carry a club that came back; a suspended club generates
-- nothing; a suspended admin is not on the rail; pausing twice without anybody
-- reading it leaves one notice, not two.

create or replace function public.clubs_status_told()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin  record;
  v_kind   text;
  v_stale  text;
  v_title  text;
  v_body   text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'paused' then
    v_kind  := 'club-paused';
    v_stale := 'club-resumed';
    v_title := new.name || ' has paused its listing';
    v_body  := 'It is out of the directory. Nobody new can find the club, join it '
               || 'or book a table, and its members still have everything.';
  elsif old.status = 'paused' and new.status = 'active' then
    v_kind  := 'club-resumed';
    v_stale := 'club-paused';
    v_title := new.name || ' is back in the directory';
    v_body  := 'The club has put its listing back. People can find it again.';
  else
    -- Suspending, restoring, archiving. An admin's own doing, with its own
    -- words to come in Stage 5.
    return new;
  end if;

  -- The opposite notice is about something that stopped being true the moment
  -- this one happened. Same reasoning as 0105.
  update public.notifications
     set read_at = now()
   where kind = v_stale
     and entity_type = 'club'
     and entity_id = new.id::text
     and read_at is null;

  for v_admin in
    select id from public.profiles
     where role = 'admin' and coalesce(is_active, true)
       and id is distinct from (select auth.uid())
  loop
    perform public.notify_person(
      v_admin.id, v_kind, v_title, v_body,
      '/clubs/' || new.slug,
      'club', new.id::text);
  end loop;

  return new;
end;
$$;

revoke all on function public.clubs_status_told() from public, anon, authenticated;

drop trigger if exists clubs_status_told on public.clubs;
create trigger clubs_status_told
  after update of status on public.clubs
  for each row execute function public.clubs_status_told();
