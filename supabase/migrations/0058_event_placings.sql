-- 0058 · A club recording who won its event
--
-- club_event_results came across in 0009 as read-only: `select` to anon and
-- authenticated, and no insert, update or delete policy at all. Every placing
-- on the site was imported from legacy, so a club that ran an event through
-- FindAGamesClub had no way to say who won it.
--
-- Functions rather than policies plus column grants, matching the two other
-- owner-side writes (record_booking_result in 0044, edit_booking_details in
-- 0057). Three reasons here:
--
--  1. `army` is jsonb that will carry an Army Builder snapshot in M3. A
--     straight update from the form would wipe it. This merges.
--  2. The placement label is derived from the rank, so "3rd place" cannot
--     disagree with a rank of 4.
--  3. can_manage_club needs the event's club, which the row does not carry.

/**
 * Add or correct one placing.
 *
 * p_placing null adds; an id corrects. Returns the row's id either way, so the
 * caller does not need a second round trip to find what it just made.
 */
create or replace function public.save_event_placing(
  p_event bigint,
  p_placing bigint,
  p_rank integer,
  p_name text,
  p_profile uuid,
  p_faction text,
  p_detachment text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club    bigint;
  v_name    text := btrim(coalesce(p_name, ''));
  v_army    jsonb;
  v_label   text;
  v_id      bigint;
begin
  if auth.uid() is null then
    raise exception 'PLACING_NOT_YOURS';
  end if;

  select e.club_id into v_club from public.club_events e where e.id = p_event;
  if v_club is null then
    raise exception 'PLACING_NO_EVENT';
  end if;

  if not public.can_manage_club(v_club) then
    raise exception 'PLACING_NOT_YOURS';
  end if;

  if p_rank is null or p_rank < 1 or p_rank > 999 then
    raise exception 'PLACING_RANK_RANGE';
  end if;

  -- A member may be named without being linked, but a link with no name gives
  -- the page nothing to print, so the name is what is required.
  if v_name = '' then
    raise exception 'PLACING_NAME_MISSING';
  end if;

  -- 1st, 2nd, 3rd, then th. 11th to 13th are the exceptions every naive
  -- version of this gets wrong.
  v_label := p_rank || case
    when p_rank % 100 between 11 and 13 then 'th'
    when p_rank % 10 = 1 then 'st'
    when p_rank % 10 = 2 then 'nd'
    when p_rank % 10 = 3 then 'rd'
    else 'th'
  end || ' place';

  if p_placing is null then
    v_army := '{}'::jsonb;
  else
    -- Merged, not replaced. The army object will hold an Army Builder list
    -- snapshot in M3, and a club fixing a spelling must not delete it.
    select coalesce(r.army, '{}'::jsonb) into v_army
      from public.club_event_results r
     where r.id = p_placing and r.event_id = p_event;

    if v_army is null then
      raise exception 'PLACING_NOT_FOUND';
    end if;
  end if;

  v_army := v_army || jsonb_build_object(
    'factionLabel', nullif(btrim(coalesce(p_faction, '')), ''),
    'detachment',   nullif(btrim(coalesce(p_detachment, '')), '')
  );

  if p_placing is null then
    insert into public.club_event_results
      (event_id, rank, placement, member_name, member_profile_id, is_member, army)
    values
      (p_event, p_rank::smallint, v_label, left(v_name, 120), p_profile,
       p_profile is not null, v_army)
    returning id into v_id;
  else
    update public.club_event_results
       set rank = p_rank::smallint,
           placement = v_label,
           member_name = left(v_name, 120),
           member_profile_id = p_profile,
           is_member = p_profile is not null,
           army = v_army
     where id = p_placing and event_id = p_event
    returning id into v_id;

    if v_id is null then
      raise exception 'PLACING_NOT_FOUND';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.save_event_placing(bigint, bigint, integer, text, uuid, text, text)
  from public, anon;
grant execute on function public.save_event_placing(bigint, bigint, integer, text, uuid, text, text)
  to authenticated;

/** Remove a placing. Scoped to its event so an id alone cannot reach another club's. */
create or replace function public.delete_event_placing(p_event bigint, p_placing bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club bigint;
begin
  if auth.uid() is null then
    raise exception 'PLACING_NOT_YOURS';
  end if;

  select e.club_id into v_club from public.club_events e where e.id = p_event;
  if v_club is null or not public.can_manage_club(v_club) then
    raise exception 'PLACING_NOT_YOURS';
  end if;

  delete from public.club_event_results where id = p_placing and event_id = p_event;
  if not found then
    raise exception 'PLACING_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.delete_event_placing(bigint, bigint) from public, anon;
grant execute on function public.delete_event_placing(bigint, bigint) to authenticated;
