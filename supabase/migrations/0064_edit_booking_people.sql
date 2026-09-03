-- 0064 · Letting the club change who is on a table, not just what it says
--
-- 0057 let a club correct a booking's game, notes and the free text an
-- opponent was typed in as. The client came back: "currently you can only
-- manage the opponent, and not the original person who booked the table. Can
-- we amend so the club owner can change either person?"
--
-- Which is the real request behind the original one. A table gets handed over
-- on the night, somebody is entered against the wrong name, or a guest who has
-- since joined should be linked to their account. Cancelling and rebooking
-- loses the table number and offers the slot to the waiting list on the way
-- past, so the club needs to edit the row rather than replace it.
--
-- Members are deliberately NOT given this. A member fixing their own typo is
-- one thing; a member handing their table to somebody else, or taking one, is
-- another, and it is the club's to do.
--
-- Reassigning has three consequences the row cannot work out for itself, so
-- they are handled here:
--
--  1. Price and tier were frozen at insert from the ORIGINAL booker's tier
--     (0043). Left alone, a table handed from a member whose tier waives the
--     fee to one whose tier does not still reads as free, and the club
--     collects nothing. Both are recomputed for the new booker.
--  2. Points spent are the original booker's, and the ledger is append-only by
--     design. Rather than quietly leave somebody's points on somebody else's
--     table, a booking with points on it refuses the swap and says so.
--  3. One booking per person per club night is a unique index on the
--     participants table, so the swap can collide. Caught and named, or it
--     surfaces as a raw 23505.

drop function if exists public.edit_booking_details(bigint, text, text, text);

create function public.edit_booking_details(
  p_booking bigint,
  p_game_title text,
  p_opponent_name text,
  p_notes text,
  -- Off unless the caller means it. Null p_opponent_id has to mean "nobody is
  -- linked", which is a real thing to save, so it cannot also mean "leave the
  -- people alone" — hence a flag rather than reading intent out of the nulls.
  p_set_people boolean default false,
  p_booked_by uuid default null,
  p_opponent_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target     public.club_bookings%rowtype;
  v_manages    boolean;
  v_booker     uuid;
  v_opponent   uuid;
  v_name       text;
  v_base       numeric(10,2);
  v_pct        smallint;
  v_discount   numeric(10,2);
  v_tier_key   text;
  v_tier_label text;
begin
  if auth.uid() is null then
    raise exception 'BOOKING_NOT_YOURS';
  end if;

  select * into v_target from public.club_bookings where id = p_booking;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_target.status <> 'booked' then
    raise exception 'BOOKING_CANCELLED';
  end if;

  v_manages := public.can_manage_club(v_target.club_id);

  -- The club may correct any booking at any time, which is how it already
  -- cancels them (club_bookings_manage, 0014). The member who booked it may
  -- fix their own typo up to the night; after that the record is the club's,
  -- matching the cancel window they already have.
  if not v_manages then
    if v_target.booked_by <> auth.uid() then
      raise exception 'BOOKING_NOT_YOURS';
    end if;
    if v_target.session_date <= public.london_today() then
      raise exception 'BOOKING_PAST';
    end if;
  end if;

  if btrim(coalesce(p_game_title, '')) = '' then
    raise exception 'BOOKING_GAME_MISSING';
  end if;

  v_booker   := v_target.booked_by;
  v_opponent := v_target.opponent_profile_id;
  -- Naming a registered member happens through the booking form, which links
  -- their profile and is what the page actually displays. Typing over the text
  -- must not silently unlink somebody, so a linked opponent keeps their name
  -- unless the people are being set outright.
  v_name := case
    when v_target.opponent_profile_id is null
      then left(btrim(coalesce(p_opponent_name, '')), 120)
    else v_target.opponent_name
  end;

  if p_set_people then
    if not v_manages then
      raise exception 'BOOKING_NOT_YOURS';
    end if;
    if p_booked_by is null then
      raise exception 'BOOKING_BOOKER_MISSING';
    end if;
    if not exists (select 1 from public.club_memberships m
                    where m.club_id = v_target.club_id
                      and m.profile_id = p_booked_by
                      and m.status = 'approved') then
      raise exception 'BOOKING_BOOKER_NOT_MEMBER';
    end if;

    if p_opponent_id is not null then
      if p_opponent_id = p_booked_by then
        raise exception 'BOOKING_SAME_PERSON';
      end if;
      if not exists (select 1 from public.club_memberships m
                      where m.club_id = v_target.club_id
                        and m.profile_id = p_opponent_id
                        and m.status = 'approved') then
        raise exception 'BOOKING_OPPONENT_NOT_MEMBER';
      end if;
    end if;

    -- A third seat exists: somebody may have accepted an open table. Putting
    -- them in one of the other two seats would leave the same person on the
    -- booking twice, and the participants key would take the strongest role
    -- and silently drop the rest.
    if v_target.accepted_by is not null
       and v_target.accepted_by in (p_booked_by, coalesce(p_opponent_id, p_booked_by)) then
      raise exception 'BOOKING_SAME_PERSON';
    end if;

    if p_booked_by <> v_target.booked_by
       and coalesce(v_target.loyalty_points_spent, 0) > 0 then
      raise exception 'BOOKING_POINTS_SPENT';
    end if;

    v_booker   := p_booked_by;
    v_opponent := p_opponent_id;
    v_name := case
      when p_opponent_id is null then left(btrim(coalesce(p_opponent_name, '')), 120)
      else coalesce((select nullif(btrim(pr.full_name), '')
                       from public.profiles pr where pr.id = p_opponent_id), 'A member')
    end;
  end if;

  if p_set_people and v_booker <> v_target.booked_by then
    -- Repricing, from the same sources the insert trigger reads (0043), so a
    -- reassigned table is priced the way it would have been had the new member
    -- booked it themselves.
    select coalesce(s.table_booking_price, 5.00) into v_base
      from public.club_booking_settings s where s.club_id = v_target.club_id;
    v_base := coalesce(v_base, 5.00);

    v_pct := public.booking_discount_percent(v_target.club_id, v_booker);
    v_discount := round(v_base * v_pct / 100.0, 2);

    select m.tier_key, coalesce(t.label, '')
      into v_tier_key, v_tier_label
      from public.club_memberships m
      left join public.club_membership_tiers t
        on t.club_id = m.club_id and t.tier_key = m.tier_key
     where m.club_id = v_target.club_id and m.profile_id = v_booker
       and m.status = 'approved'
     limit 1;
  end if;

  begin
    update public.club_bookings
       set game_title           = left(btrim(p_game_title), 120),
           opponent_name        = v_name,
           notes                = left(btrim(coalesce(p_notes, '')), 500),
           booked_by            = v_booker,
           opponent_profile_id  = v_opponent,
           base_price            = coalesce(v_base, base_price),
           tier_discount_percent = coalesce(v_pct, tier_discount_percent),
           tier_discount_amount  = coalesce(v_discount, tier_discount_amount),
           membership_tier_key   = case when v_base is null then membership_tier_key
                                        else v_tier_key end,
           membership_tier_label = case when v_base is null then membership_tier_label
                                        else coalesce(v_tier_label, '') end,
           total_price = case
             when v_base is null then total_price
             else greatest(v_base - v_discount
                             - coalesce(v_target.loyalty_discount_amount, 0), 0)
           end
     where id = p_booking;
  exception when unique_violation then
    -- club_booking_participants_one_per_date. The club is looking at one
    -- night; the clash is on another table of the same night, or the same date
    -- at another of the club's sessions.
    raise exception 'BOOKING_DATE_CLASH';
  end;
end;
$$;

revoke all on function public.edit_booking_details(bigint, text, text, text, boolean, uuid, uuid)
  from public, anon;
grant execute on function public.edit_booking_details(bigint, text, text, text, boolean, uuid, uuid)
  to authenticated;
