-- 0110 · Tell the club when it was not the club that did it
--
-- 0109 told the admins and stopped there, which is right for the case it was
-- written for: the owner presses the button, and nobody in this app is told
-- what they just did.
--
-- It is wrong for the other case. `pause_club_listing` takes an owner **or an
-- admin**, so one of us can take somebody's club out of the directory and the
-- club learns about it by noticing. No bell, no email, no reason. Stage 5's
-- auto-hide on a lapsed subscription lands in the same place, and that is the
-- one where being told matters most: a club that does not know it is hidden
-- cannot pay to come back.
--
-- So the owner is told whenever the hand on the switch was not theirs, and
-- nothing is sent when it was. Same test 0103 uses for the same reason.
--
-- The email is the service's half and goes only on the same condition, so the
-- two cannot disagree about who did what.
--
-- Checked on a throwaway Postgres: an owner pausing their own club is told
-- nothing and the admins are; an admin pausing it tells the owner and every
-- other admin but not the admin who pressed it; the same for putting it back;
-- the pause notice on the owner's bell is marked read when it comes back; and
-- a club with no owner row raises nothing.

create or replace function public.clubs_status_told()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin  record;
  v_actor  uuid := (select auth.uid());
  v_kind   text;
  v_stale  text;
  v_stale_owner text;
  v_title  text;
  v_body   text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'paused' then
    v_kind  := 'club-paused';
    v_stale := 'club-resumed';
    v_stale_owner := 'listing-resumed';
    v_title := new.name || ' has paused its listing';
    v_body  := 'It is out of the directory. Nobody new can find the club, join it '
               || 'or book a table, and its members still have everything.';
  elsif old.status = 'paused' and new.status = 'active' then
    v_kind  := 'club-resumed';
    v_stale := 'club-paused';
    v_stale_owner := 'listing-paused';
    v_title := new.name || ' is back in the directory';
    v_body  := 'The club has put its listing back. People can find it again.';
  else
    return new;
  end if;

  -- The opposite notice is about something that stopped being true the moment
  -- this one happened. Same reasoning as 0105, and it covers the owner's own
  -- rail as well as the admins'.
  update public.notifications
     set read_at = now()
   where kind in (v_stale, v_stale_owner)
     and entity_type = 'club'
     and entity_id = new.id::text
     and read_at is null;

  for v_admin in
    select id from public.profiles
     where role = 'admin' and coalesce(is_active, true)
       and id is distinct from v_actor
  loop
    perform public.notify_person(
      v_admin.id, v_kind, v_title, v_body,
      '/clubs/' || new.slug,
      'club', new.id::text);
  end loop;

  -- And the club, when the hand on the switch was not theirs. Different words,
  -- because "your club has paused its listing" said to the person who did not
  -- pause it is the product describing them rather than telling them something.
  if new.owner_id is not null and new.owner_id is distinct from v_actor then
    if new.status = 'paused' then
      perform public.notify_person(
        new.owner_id,
        'listing-paused',
        new.name || ' has been taken out of the directory',
        'Nobody new can find your club, join it or book a table. Your members '
          || 'still have everything. Get in touch if this is not what you expected.',
        '/clubs/' || new.slug || '/manage/listing/review',
        'club', new.id::text);
    else
      perform public.notify_person(
        new.owner_id,
        'listing-resumed',
        new.name || ' is back in the directory',
        'People can find your club again, join it and book tables.',
        '/clubs/' || new.slug,
        'club', new.id::text);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.clubs_status_told() from public, anon, authenticated;
