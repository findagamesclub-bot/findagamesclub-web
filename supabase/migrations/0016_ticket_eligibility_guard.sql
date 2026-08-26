-- Who may hold a ticket, enforced where it cannot be talked around.
--
-- ticketBlockedReason() decides what the buyer is shown, but the cart is an
-- ordinary table and the anon key is public: a members-only ticket could be
-- inserted straight into a cart over PostgREST and carried through checkout.
-- This is the same reasoning that put the capacity check in a trigger rather
-- than in the service.
--
-- Ported from _can_user_buy_event_ticket (club_store.py:23032). Position is the
-- ladder: a tier further down the club's own list is higher.

create or replace function public.club_event_booking_items_eligible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audience text;
  needed   text;
  club     bigint;
  buyer    uuid;
  manager  boolean;
  held_pos smallint;
  need_pos smallint;
begin
  select coalesce(nullif(btrim(lower(t.audience)), ''), 'all'),
         nullif(btrim(t.minimum_tier_key), '')
    into audience, needed
    from public.club_event_ticket_types t
   where t.id = new.ticket_type_id;

  -- Open to everyone with no tier attached. Nothing to check.
  if audience = 'all' and needed is null then
    return new;
  end if;

  select b.club_id, b.profile_id into club, buyer
    from public.club_event_bookings b where b.id = new.booking_id;

  -- Deliberately not can_manage_club(): that reads auth.uid(), and this must
  -- judge the person the booking is in the name of.
  manager := exists (select 1 from public.clubs c where c.id = club and c.owner_id = buyer)
          or exists (select 1 from public.profiles p where p.id = buyer and p.role = 'admin');

  if manager then
    return new;
  end if;

  if buyer is null then
    raise exception 'TICKET_NOT_ELIGIBLE' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.club_memberships m
     where m.club_id = club and m.profile_id = buyer and m.status = 'approved'
  ) then
    raise exception 'TICKET_NOT_ELIGIBLE' using errcode = 'insufficient_privilege';
  end if;

  if needed is not null then
    select t.position into need_pos
      from public.club_membership_tiers t
     where t.club_id = club and t.tier_key = needed;

    select t.position into held_pos
      from public.club_memberships m
      join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = club and m.profile_id = buyer and m.status = 'approved';

    -- A tier the club has since deleted leaves need_pos null; that is not a
    -- reason to refuse a member who met the rule as it stood.
    if need_pos is not null and coalesce(held_pos, -1) < need_pos then
      raise exception 'TICKET_NOT_ELIGIBLE' using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.club_event_booking_items_eligible() from public, anon, authenticated;

-- After the capacity trigger, so a sold-out ticket still reports sold out.
create trigger club_event_booking_items_eligibility
  before insert or update on public.club_event_booking_items
  for each row execute function public.club_event_booking_items_eligible();
