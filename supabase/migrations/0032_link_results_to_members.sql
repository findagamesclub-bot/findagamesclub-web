-- 0032 · Saying which account a recorded name belongs to
--
-- Competition standings and event results came across from the old site with a
-- player's name as text and no account behind it. That is what stops a
-- member's league record, their badges and their podium finishes appearing on
-- their profile, and it is what the meta tracker will need later.
--
-- Rather than guess by name, this lets a club say. One pass over their own
-- unlinked names and the whole history attaches itself.

/**
 * Attach a standing to a member, or detach it by passing null.
 *
 * The club's own call, so a club manager only. Matching on name would be a
 * guess: two members called Joe is ordinary at a forty-member club.
 */
create or replace function public.link_standing_member(
  p_standing bigint,
  p_profile uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_club bigint;
begin
  select c.club_id into owner_club
    from public.club_competition_standings s
    join public.club_competitions c on c.id = s.competition_id
   where s.id = p_standing;

  if owner_club is null then
    raise exception 'No such standing';
  end if;
  if not public.can_manage_club(owner_club) then
    raise exception 'That is not your club';
  end if;

  -- Only somebody who is actually in the club. Otherwise a stray id would put
  -- a stranger's face on the club's league table.
  if p_profile is not null and not exists (
    select 1 from public.club_memberships m
     where m.club_id = owner_club and m.profile_id = p_profile
       and m.status = 'approved'
  ) then
    raise exception 'That person is not an approved member of this club';
  end if;

  update public.club_competition_standings
     set profile_id = p_profile
   where id = p_standing;
end;
$$;

/** The same, for an event's podium. */
create or replace function public.link_event_result_member(
  p_result bigint,
  p_profile uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_club bigint;
begin
  select e.club_id into owner_club
    from public.club_event_results r
    join public.club_events e on e.id = r.event_id
   where r.id = p_result;

  if owner_club is null then
    raise exception 'No such result';
  end if;
  if not public.can_manage_club(owner_club) then
    raise exception 'That is not your club';
  end if;

  if p_profile is not null and not exists (
    select 1 from public.club_memberships m
     where m.club_id = owner_club and m.profile_id = p_profile
       and m.status = 'approved'
  ) then
    raise exception 'That person is not an approved member of this club';
  end if;

  update public.club_event_results
     set member_profile_id = p_profile
   where id = p_result;
end;
$$;

/**
 * A member's competition record, for their profile.
 *
 * Only standings somebody has been linked to. Reads for one person across
 * every club they are in, which is one indexed scan of a small table.
 */
create index if not exists club_competition_standings_member_idx
  on public.club_competition_standings (profile_id)
  where profile_id is not null;

create index if not exists club_event_results_member_idx
  on public.club_event_results (member_profile_id)
  where member_profile_id is not null;

revoke all on function public.link_standing_member(bigint, uuid) from public, anon;
grant execute on function public.link_standing_member(bigint, uuid) to authenticated;
revoke all on function public.link_event_result_member(bigint, uuid) from public, anon;
grant execute on function public.link_event_result_member(bigint, uuid) to authenticated;
