-- 0075 · Letting the site admin write to anybody
--
-- Legacy has no such thing. Its messaging is club-scoped throughout: the
-- thread key is (club, one person, the other), and create_direct_message
-- refuses unless the two share an approved membership. The single exception
-- (_find_manageable_pending_membership_for_user, club_store.py:19754) lets a
-- club owner, or an admin, write to somebody with a pending application at
-- that club. Our can_message_member already ports both rules.
--
-- So an admin could reach an applicant and nobody else. Suspending an account,
-- declining a listing or removing a reported post all left the person with no
-- word about why, which is the gap this closes.
--
-- A message from the site belongs to no club, so club_id becomes nullable and
-- null means "from FindAGamesClub". Only an admin may write one, and only an
-- admin may start one: the recipient can reply into the thread that exists,
-- but cannot open a new one and cannot write to another member through it.

alter table public.club_messages alter column club_id drop not null;

-- The read watermark keys on the same three parts, so it has to allow the same
-- null. A unique constraint treats nulls as distinct, so the partial index
-- below is what actually keeps one row per site thread per person.
alter table public.club_message_reads alter column club_id drop not null;

create unique index if not exists club_message_reads_one_site_thread
  on public.club_message_reads (profile_id, pair_low, pair_high)
  where club_id is null;

-- The pair columns already key a thread; the club is the third part of it, and
-- null groups on its own the way a club id does.
create index if not exists club_messages_site_idx
  on public.club_messages (pair_low, pair_high, created_at desc)
  where club_id is null;

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
    return exists (
      select 1 from public.club_messages m
       where m.club_id is null
         and m.sender_id = other_person
         and m.recipient_id = actor
    );
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

  -- The club answering somebody who has applied to join it. Legacy gives this
  -- to the owner and to an admin; can_manage_club covers both.
  if public.can_manage_club(target_club) and exists (
    select 1 from public.club_memberships m
     where m.club_id = target_club and m.profile_id = other_person
       and m.status in ('pending', 'approved')
  ) then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.can_message_member(bigint, uuid) from public, anon;
grant execute on function public.can_message_member(bigint, uuid) to authenticated;

-- Everybody an admin may write to, which is everybody. A definer function
-- because the admin has no membership tying them to these people, so no policy
-- would return the rows.
create or replace function public.admin_message_contacts(p_query text default '')
returns table (id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = public
as $$
  with wanted as (select nullif(btrim(lower(coalesce(p_query, ''))), '') as q)
  select p.id, p.full_name, u.email::text
    from public.profiles p
    join auth.users u on u.id = p.id, wanted w
   where public.is_admin()
     and p.id <> (select auth.uid())
     and (w.q is null
          or lower(coalesce(p.full_name, '')) like '%' || w.q || '%'
          or lower(coalesce(u.email, '')) like '%' || w.q || '%')
   order by p.full_name
   limit 30;
$$;

revoke all on function public.admin_message_contacts(text) from public, anon;
grant execute on function public.admin_message_contacts(text) to authenticated;
