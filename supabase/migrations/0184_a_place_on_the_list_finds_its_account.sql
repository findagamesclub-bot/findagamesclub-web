-- 0184 · a place on the list finds its account.
--
-- The client, item 22a: "How has this been implemented in the UI in terms of
-- linking a player by ID for an event? Ideally, we should link members at the
-- beginning in the who is coming section. We have a few different scenarios:
--   1. A member purchases an event ticket under their name, the link is in
--      that case already done.
--   2. A member purchases an event ticket, but changes the name as it is not
--      for them. This other person may not be a member of that club.
--   3. A non member buys a ticket, and then needs to link the event to their
--      account/profile."
--
-- Scenario 1 has always worked: a booking made signed in carries
-- `profile_id`. 0177 gave the club a way to attach an account to a RESULT, on
-- the placing dialog and the matching screen, which is the far end of the
-- weekend. The client is asking for it at the near end, on the door list,
-- which is both earlier and better: link it there and the ticket, the draw,
-- the result and the badge all point at the right person from the start.
--
-- SCENARIO 2 IS NOT A MISSING LINK, IT IS A WRONG ONE, and that is the part
-- worth saying out loud. A member who buys a ticket and puts somebody else's
-- name on it leaves a booking carrying THEIR account and ANOTHER person's
-- name. Everything downstream believes it. It is the same root as 21e, where
-- two such bookings folded into one player in the draw.
--
-- So this is a set AND a clear: the club can attach the right account, and
-- can say "this one is not me" and leave it with nobody behind it.
--
-- WHO MAY BE ATTACHED is `may_link_profile` (0177) unchanged: the club's own
-- approved member, somebody who already holds a booking at this club, or
-- somebody who handed over their member code. A stranger from another club
-- is the third of those, which is scenario 2's "may not be a member of that
-- club" and scenario 3 both.
--
-- NOTHING IS RE-AWARDED. The loyalty points for this booking were earned by
-- whoever paid (0050, on the insert), and moving the name does not move the
-- money. The ticket moves, because the ticket is the thing the name is on.

create or replace function public.set_booking_member(
  p_booking bigint, p_profile uuid, p_code text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_club bigint; v_was uuid;
begin
  select b.club_id, b.profile_id into v_club, v_was
    from public.club_event_bookings b where b.id = p_booking;
  if v_club is null then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'check_violation';
  end if;

  if not (public.club_can(v_club, 'events.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- Clearing is the club saying the name on the door is not the account the
  -- booking was bought under, which is scenario 2 before they know whose it
  -- is. It needs no permission beyond running the event: taking a stranger's
  -- name off your own account is not something to ask them about.
  if p_profile is null then
    update public.club_event_bookings set profile_id = null where id = p_booking;
    return true;
  end if;

  -- Attaching is the other person's to agree to, and this is the one rule
  -- that says so. Restated nowhere: three copies of who may be linked is how
  -- the placing dialog and the door list end up disagreeing.
  if not public.may_link_profile(v_club, p_profile, coalesce(p_code, '')) then
    raise exception 'BOOKING_LINK_NOT_ALLOWED' using errcode = 'check_violation';
  end if;

  update public.club_event_bookings set profile_id = p_profile where id = p_booking;
  return true;
end;
$$;

revoke all on function public.set_booking_member(bigint, uuid, text)
  from public, anon;
grant execute on function public.set_booking_member(bigint, uuid, text)
  to authenticated;

-- The door list already returns `profile_id` (0092) and `DoorRow` already
-- carries it, so nothing else is needed to read this back. The roster simply
-- never drew it, which is why a wrong link was invisible to the club.
