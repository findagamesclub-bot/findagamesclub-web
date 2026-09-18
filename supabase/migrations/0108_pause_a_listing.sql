-- 0108 · A club that needs to stop for a while
--
-- Legacy lets an owner do this and we did not copy it. `update_club`
-- (club_store.py:12488) is reachable by the owner, the payload carries
-- `status`, and `_normalise_listing_status` (23378) folds it to `active` or
-- `inactive`; an inactive club drops out of the directory. Here `status` is
-- revoked from the owner's column grants, correctly, since a club that could
-- name its own status could approve itself out of `pending`. The mistake was
-- revoking it and then never giving back the one move an owner is entitled to.
--
-- Clubs close for the summer, lose a venue, or have an organiser step back.
-- Without this the only options are leaving a listing up that invites people to
-- a night that is not running, or asking an admin by email.
--
-- `paused` rather than `suspended`, which is a thing done TO a club by an admin
-- and Stage 5 will use for a lapsed subscription. They look the same to a
-- visitor and they are not the same to anybody else.
--
-- What pausing does and does not do:
--
--   · gone from the directory, the map, search and the events list
--   · still there for its own members, who keep the board, their bookings and
--     their membership: pausing the listing is not throwing people out
--   · the console still opens, so the owner can undo it
--   · nobody new can join, book a table or take a ticket, refused in the
--     database rather than only in the screens
--   · refused outright while a published event in the future has places taken,
--     because twenty people holding tickets to a tournament is not something to
--     resolve by quietly hiding the club
--
-- Deleting a listing is deliberately not here. Legacy has no delete for an
-- owner or an admin, only for reviews, so it goes to RECOMMENDATIONS.md.
--
-- Checked on a throwaway Postgres: an owner pauses and resumes; a manager and a
-- stranger are refused; an admin can do both; a paused club is invisible to
-- anon and to a non-member and visible to its own approved member; joining,
-- booking and taking a ticket are all refused while paused and work again after
-- resuming; and pausing is refused while a future published event holds a
-- reserved place, naming how many.

alter table public.clubs drop constraint if exists clubs_status_check;
alter table public.clubs add constraint clubs_status_check
  check (status in ('active', 'pending', 'suspended', 'archived', 'paused'));

-- A paused club keeps its members. Without this the select policy hides it from
-- everybody but the owner, which would take the board, the bookings page and
-- the membership itself away from people who did nothing.
drop policy if exists clubs_select_paused_member on public.clubs;
create policy clubs_select_paused_member on public.clubs
  for select to authenticated
  using (status = 'paused' and public.is_club_member(id));

/**
 * Stop the listing.
 *
 * Owner or admin, not a manager: taking a club out of the directory is not the
 * same kind of act as editing its summary, and `listing.edit` admits both.
 */
create or replace function public.pause_club_listing(p_club bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_events integer;
begin
  if coalesce(public.club_role_of(p_club), '') not in ('owner', 'admin') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select status into v_status from public.clubs where id = p_club for update;

  if v_status is null then
    raise exception 'CLUB_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Only from live. A club an admin has suspended must not be able to relabel
  -- itself as merely paused, which is the one way this could be used to shed a
  -- suspension.
  if v_status <> 'active' then
    raise exception 'CLUB_NOT_LIVE' using errcode = 'check_violation';
  end if;

  select count(*) into v_events
    from public.club_events e
   where e.club_id = p_club
     and e.status = 'published'
     and e.start_date >= public.london_today()
     and exists (select 1 from public.club_event_bookings b
                  where b.event_id = e.id and b.status = 'reserved');

  if v_events > 0 then
    raise exception 'CLUB_HAS_LIVE_EVENTS (%)', v_events using errcode = 'check_violation';
  end if;

  update public.clubs set status = 'paused', updated_at = now() where id = p_club;
  return 'paused';
end;
$$;

create or replace function public.resume_club_listing(p_club bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if coalesce(public.club_role_of(p_club), '') not in ('owner', 'admin') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select status into v_status from public.clubs where id = p_club for update;

  if v_status is null then
    raise exception 'CLUB_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Paused is the only one an owner put themselves in, so it is the only one
  -- they can get themselves out of. Suspended stays an admin's to lift.
  if v_status <> 'paused' then
    raise exception 'CLUB_NOT_PAUSED' using errcode = 'check_violation';
  end if;

  update public.clubs set status = 'active', updated_at = now() where id = p_club;
  return 'active';
end;
$$;

revoke all on function public.pause_club_listing(bigint) from public, anon;
revoke all on function public.resume_club_listing(bigint) from public, anon;
grant execute on function public.pause_club_listing(bigint) to authenticated;
grant execute on function public.resume_club_listing(bigint) to authenticated;

/**
 * Nobody new while it is paused.
 *
 * In the database rather than only in the screens, for the reason every other
 * guard here is: the anon key is public, the tables are reachable over
 * PostgREST with anybody's own JWT, and a page somebody left open half an hour
 * ago still has a working join button on it.
 */
create or replace function public.club_is_taking_people()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.clubs where id = new.club_id;

  if v_status = 'paused' then
    raise exception 'CLUB_PAUSED' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.club_is_taking_people() from public, anon, authenticated;

drop trigger if exists club_memberships_club_open on public.club_memberships;
create trigger club_memberships_club_open
  before insert on public.club_memberships
  for each row execute function public.club_is_taking_people();

drop trigger if exists club_bookings_club_open on public.club_bookings;
create trigger club_bookings_club_open
  before insert on public.club_bookings
  for each row execute function public.club_is_taking_people();

drop trigger if exists club_event_bookings_club_open on public.club_event_bookings;
create trigger club_event_bookings_club_open
  before insert on public.club_event_bookings
  for each row execute function public.club_is_taking_people();
