-- 0225 · a suspension is something the member can read
--
-- The client, item 26: "when you suspend a member, they then cannot see any of
-- their memberships to other clubs in the dashboard and get the below error
-- when trying to access them. They should still be able to see all the
-- membership details, this should just stop them from using the suspended
-- clubs features ... Also, when visiting the club they are suspended from, it
-- shows them like a non-member. It should show their previous membership level
-- but provide a message to say you are suspended and give the reason the club
-- owner provided."
--
-- 0212 made a suspension a membership STATUS, which was the right call: every
-- guard in the app asks for `approved`, so the club's door closed without a
-- single screen having to know the word existed. The cost is that no screen
-- knew the word existed. `suspended_reason` has been written since 0212 and
-- read by nobody but the club's own roster.
--
-- The app half of this is three places that had four statuses in a union and
-- now have five. What needs a migration is the reason: the column is not in
-- the generated `database.ts`, so the member's own two screens cannot select
-- it, and `check:columns` is right to refuse a select that names it.
--
-- One function for both screens, the same call 0224 made: the club page asks
-- about one club and the memberships list asks about all of them, and a second
-- round trip for a sentence neither of them usually needs is not worth having.
--
-- `security invoker`, so `club_memberships_select` decides. A member reads
-- their own row; nothing here widens that by a inch, and in particular it does
-- NOT return who suspended them, which is the club's business and not a name
-- to hand somebody who has just been told they are out.
--
-- Checked on a throwaway Postgres built from every migration with
-- supabase/tests/stage13-a-suspension-is-readable.sql.

begin;

create or replace function public.my_suspensions()
returns table (
  membership_id bigint,
  club_id       bigint,
  suspended_at  timestamptz,
  reason        text
)
language sql
stable
security invoker
set search_path = public
as $$
  select m.id, m.club_id, m.suspended_at, coalesce(btrim(m.suspended_reason), '')
    from public.club_memberships m
   where m.profile_id = (select auth.uid())
     and m.status = 'suspended'
$$;

revoke all on function public.my_suspensions() from public, anon;
grant execute on function public.my_suspensions() to authenticated;

-- ------------------------------------- and something they can answer
--
-- The client's last line on item 26: "A nice addition would then be to show a
-- message club owner button." It is more than a nice addition, because without
-- it the screen tells somebody they are out, gives them the club's reason, and
-- offers them nothing to do about it.
--
-- Copied from 0215, its latest definition, with two branches changed and
-- nothing else. The signature does not move, so the grant stands.

create or replace function public.can_message_member(target_club bigint, other_person uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or other_person is null or actor = other_person then
    return false;
  end if;

  -- Suspended accounts write nothing, the same as everywhere else.
  if not public.is_active_user() then
    return false;
  end if;

  -- From the site rather than from a club. The admin may open one with
  -- anybody; the person they wrote to may answer, and only them.
  if target_club is null then
    if public.is_admin() then
      return true;
    end if;
    if exists (
      select 1 from public.club_messages m
       where m.club_id is null
         and m.sender_id = other_person
         and m.recipient_id = actor
    ) then
      return true;
    end if;
    -- An owner whose listing or event a site admin has taken down, writing to
    -- an admin. They are being asked to put something right and had no way to
    -- ask what: a site thread could only ever be opened by an admin going
    -- first, so the conversation the client wants depended on us starting it.
    --
    -- Narrow on purpose. Only while something of theirs is actually down, and
    -- only to an active admin; it closes the moment the listing goes back up,
    -- and it gives them no reach over any other account on the site.
    return exists (select 1 from public.profiles p
                    where p.id = other_person and p.role = 'admin'
                      and coalesce(p.is_active, true))
       and (exists (select 1 from public.clubs c
                     where c.owner_id = actor and c.status = 'suspended')
            or exists (select 1 from public.club_events e
                         join public.clubs c2 on c2.id = e.club_id
                        where c2.owner_id = actor and e.status = 'suspended'));
  end if;

  -- Both approved at the same club.
  if exists (
    select 1 from public.club_memberships mine
      join public.club_memberships theirs on theirs.club_id = mine.club_id
     where mine.club_id = target_club
       and mine.profile_id = actor and mine.status = 'approved'
       and theirs.profile_id = other_person and theirs.status = 'approved'
  ) then
    return true;
  end if;

  -- Somebody the club has suspended, writing to whoever runs it. Exactly the
  -- shape the branch above gives an owner whose listing was taken down, and
  -- for the same reason: they have been told they are out and given a reason,
  -- and had no way to answer it. 0212 shut every door at once, which was the
  -- point, and left this one person with nothing to knock on.
  --
  -- Narrow on purpose. Only while the suspension stands, only to somebody who
  -- can actually lift it, and it closes the moment the club does.
  if exists (
    select 1 from public.club_memberships m
     where m.club_id = target_club and m.profile_id = actor
       and m.status = 'suspended'
  ) and exists (
    select 1 from public.club_team t
     where t.club_id = target_club and t.profile_id = other_person
  ) then
    return true;
  end if;

  -- The club answering somebody who has applied to join it, or somebody it has
  -- suspended. Legacy gives this to the owner and to an admin; can_manage_club
  -- covers both. `suspended` is 0225's: a club that can shut somebody out and
  -- then cannot answer them is a conversation with one side.
  if public.can_manage_club(target_club) and exists (
    select 1 from public.club_memberships m
     where m.club_id = target_club and m.profile_id = other_person
       and m.status in ('pending', 'approved', 'suspended')
  ) then
    return true;
  end if;

  return false;
end;
$$;

commit;
