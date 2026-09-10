-- 0069 · Opening the night to helpers
--
-- 0067 gave managers everything can_manage_club() already guarded. Helpers get
-- nothing from that on purpose: they run the night, and the night is a short
-- list. This is that list, one policy and one function at a time.
--
--   bookings.manage   move, cancel and re-people a table; the waitlist; the
--                     looking-for-game board
--   results.manage    record a score, confirm one, clear one
--   board.moderate    take a post or a reply down, on the club board and on an
--                     event board
--
-- Everything else a helper opens is read-only, because is_club_member() now
-- admits any team role: they can see the roster they are checking people in
-- against without being able to approve anybody onto it.
--
-- The four function bodies below are the current definitions with one line
-- changed each. They were lifted from the migrations that own them (0014,
-- 0044, 0064) rather than retyped, so nothing else about them moved.

-- ---------------------------------------------------------------------------
-- 1. Table bookings
-- ---------------------------------------------------------------------------

drop policy if exists club_bookings_manage on public.club_bookings;
create policy club_bookings_manage
  on public.club_bookings for update to authenticated
  using (public.club_can(club_id, 'bookings.manage') and status = 'booked')
  with check (public.club_can(club_id, 'bookings.manage') and status = 'cancelled');

-- Same policy as 0049, with the club's arm of it widened. Everyone else on the
-- booking keeps the "not on the day" rule; the club may still take a table
-- back at any time.
drop policy if exists club_bookings_cancel on public.club_bookings;
create policy club_bookings_cancel
  on public.club_bookings for update to authenticated
  using (
    status = 'booked'
    and session_date > public.london_today()
    and (booked_by = (select auth.uid())
         or opponent_profile_id = (select auth.uid())
         or accepted_by = (select auth.uid())
         or public.club_can(club_id, 'bookings.manage'))
  )
  with check (status = 'cancelled');

-- ---------------------------------------------------------------------------
-- 2. The waiting list and the looking-for-game board
-- ---------------------------------------------------------------------------

drop policy if exists club_booking_waitlist_manage on public.club_booking_waitlist;
create policy club_booking_waitlist_manage
  on public.club_booking_waitlist for update to authenticated
  using (public.club_can(club_id, 'bookings.manage') and status = 'active')
  with check (public.club_can(club_id, 'bookings.manage')
              and status in ('skipped', 'withdrawn') and booking_id is null);

drop policy if exists club_lfg_manage on public.club_looking_for_games;
create policy club_lfg_manage
  on public.club_looking_for_games for update to authenticated
  using (public.club_can(club_id, 'bookings.manage') and status = 'open')
  with check (public.club_can(club_id, 'bookings.manage')
              and status = 'cancelled' and accepted_by is null);

-- ---------------------------------------------------------------------------
-- 3. Taking a post down
-- ---------------------------------------------------------------------------

create or replace function public.remove_discussion_post(target bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  row_club bigint;
  row_author uuid;
begin
  if actor is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;

  select club_id, author_profile_id into row_club, row_author
    from public.club_discussion_posts
   where id = target and removed_at is null
   for update;

  if row_club is null then
    raise exception 'NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- The author takes their own thread down; anybody moderating takes anyone's.
  if row_author <> actor and not public.club_can(row_club, 'board.moderate') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  update public.club_discussion_posts
     set removed_at = now(), removed_by = actor, updated_at = now()
   where id = target;

  return target;
end;
$$;

create or replace function public.remove_discussion_reply(target bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  row_post bigint;
  row_author uuid;
  row_club bigint;
begin
  if actor is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;

  select r.post_id, r.author_profile_id, p.club_id
    into row_post, row_author, row_club
    from public.club_discussion_replies r
    join public.club_discussion_posts p on p.id = r.post_id
   where r.id = target and r.removed_at is null
   for update of r;

  if row_post is null then
    raise exception 'NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if row_author <> actor and not public.club_can(row_club, 'board.moderate') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  update public.club_discussion_replies
     set removed_at = now(), removed_by = actor
   where id = target;

  return row_post;
end;
$$;

drop policy if exists club_event_board_posts_remove on public.club_event_board_posts;
create policy club_event_board_posts_remove on public.club_event_board_posts
  for update to authenticated
  using (
    removed_at is null
    and (author_profile_id = (select auth.uid())
         or exists (select 1 from public.club_events e
                     where e.id = event_id and public.club_can(e.club_id, 'board.moderate')))
  )
  with check (removed_at is not null);

drop policy if exists club_event_board_replies_remove on public.club_event_board_replies;
create policy club_event_board_replies_remove on public.club_event_board_replies
  for update to authenticated
  using (
    removed_at is null
    and (author_profile_id = (select auth.uid())
         or exists (
           select 1 from public.club_event_board_posts p
            join public.club_events e on e.id = p.event_id
           where p.id = post_id and public.club_can(e.club_id, 'board.moderate')))
  )
  with check (removed_at is not null);

-- ---------------------------------------------------------------------------
-- 4. Scores, the waiting list promotion, and re-peopling a booking
-- ---------------------------------------------------------------------------

create or replace function public.record_booking_result(
  p_booking bigint,
  p_booked_by_score numeric,
  p_opponent_score numeric,
  p_booked_by_army text default '',
  p_opponent_army text default '',
  p_mission text default '',
  p_deployment text default '',
  p_terrain text default '',
  p_confirmation text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target     public.club_bookings%rowtype;
  v_manages    boolean;
  v_plays      boolean;
  v_confirm    text;
  v_deploy     text;
begin
  if auth.uid() is null then
    raise exception 'RESULT_NOT_YOURS';
  end if;

  select * into v_target from public.club_bookings where id = p_booking;
  if not found then
    raise exception 'RESULT_NO_BOOKING';
  end if;

  if v_target.status <> 'booked' then
    raise exception 'RESULT_CANCELLED';
  end if;

  v_manages := public.club_can(v_target.club_id, 'results.manage');

  -- coalesced, because accepted_by is usually null and `x in (a, b, null)` is
  -- NULL rather than false when x matches neither. `not (NULL or false)` is
  -- NULL, so the guard silently did not fire and a stranger fell through to
  -- the lock check instead of being refused outright.
  v_plays := coalesce(
    auth.uid() in (v_target.booked_by, v_target.opponent_profile_id, v_target.accepted_by),
    false);

  if not (v_plays or v_manages) then
    raise exception 'RESULT_NOT_YOURS';
  end if;

  -- The lock. A settled or contested result is the club's to change.
  if not v_manages and v_target.result_confirmation in ('admin-confirmed', 'disputed') then
    raise exception 'RESULT_LOCKED';
  end if;

  if p_booked_by_score is null or p_opponent_score is null then
    raise exception 'RESULT_SCORES_MISSING';
  end if;

  if p_booked_by_score < 0 or p_opponent_score < 0
     or p_booked_by_score > 9999 or p_opponent_score > 9999 then
    raise exception 'RESULT_SCORES_RANGE';
  end if;

  -- Legacy accepts "Dawn of War" as well as the slug and normalises it
  -- (_normalise_result_deployment), then refuses anything else with a message.
  -- Without this the check constraint answers with a raw 23514.
  v_deploy := replace(replace(lower(btrim(coalesce(p_deployment, ''))), ' ', '-'), '_', '-');
  if v_deploy <> '' and v_deploy not in
     ('search-and-destroy', 'dawn-of-war', 'hammer-and-anvil',
      'sweeping-engagement', 'tipping-point', 'crucible-of-battle') then
    raise exception 'RESULT_BAD_DEPLOYMENT';
  end if;

  -- Only the club sets the state. A player editing a result always puts it back
  -- to `submitted`, so an edit after a confirmation cannot pass itself off as
  -- still agreed. Same as legacy dropping confirmationState from the payload.
  if v_manages then
    v_confirm := lower(btrim(coalesce(nullif(p_confirmation, ''), 'admin-confirmed')));
    if v_confirm not in ('submitted', 'disputed', 'confirmed', 'admin-confirmed') then
      raise exception 'RESULT_BAD_STATE';
    end if;
  else
    v_confirm := 'submitted';
  end if;

  update public.club_bookings
     set booked_by_score     = p_booked_by_score,
         opponent_score      = p_opponent_score,
         booked_by_army      = coalesce(p_booked_by_army, ''),
         opponent_army       = coalesce(p_opponent_army, ''),
         result_mission      = left(btrim(coalesce(p_mission, '')), 120),
         result_deployment   = v_deploy,
         result_terrain      = left(btrim(coalesce(p_terrain, '')), 120),
         result_confirmation = v_confirm,
         result_by           = auth.uid(),
         result_at           = now()
   where id = p_booking;
end;
$$;

create or replace function public.clear_booking_result(p_booking bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.club_bookings%rowtype;
  v_manages boolean;
begin
  select * into v_target from public.club_bookings where id = p_booking;
  if not found then
    raise exception 'RESULT_NO_BOOKING';
  end if;

  v_manages := public.club_can(v_target.club_id, 'results.manage');

  if not (coalesce(
            auth.uid() in (v_target.booked_by, v_target.opponent_profile_id, v_target.accepted_by),
            false)
          or v_manages) then
    raise exception 'RESULT_NOT_YOURS';
  end if;

  if not v_manages and v_target.result_confirmation in ('admin-confirmed', 'disputed') then
    raise exception 'RESULT_LOCKED';
  end if;

  update public.club_bookings
     set booked_by_score = null, opponent_score = null,
         booked_by_army = '', opponent_army = '',
         result_mission = '', result_deployment = '', result_terrain = '',
         result_confirmation = 'submitted',
         result_by = null, result_at = null
   where id = p_booking;
end;
$$;

create or replace function public.promote_waitlist_entry_as_manager(entry_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  target_club bigint;
begin
  select club_id into target_club from public.club_booking_waitlist where id = entry_id;
  if target_club is null then
    return null;
  end if;
  if not public.club_can(target_club, 'bookings.manage') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  return public.promote_waitlist_entry(entry_id);
end;
$$;

create or replace function public.edit_booking_details(
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

  v_manages := public.club_can(v_target.club_id, 'bookings.manage');

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

-- Grants are unchanged from the migrations these came from, restated so this
-- file stands on its own if it is ever replayed against a fresh database.
revoke all on function public.promote_waitlist_entry_as_manager(bigint) from public, anon;
grant execute on function public.promote_waitlist_entry_as_manager(bigint) to authenticated;
revoke all on function public.record_booking_result(bigint, numeric, numeric, text, text,
                                                    text, text, text, text) from public, anon;
grant execute on function public.record_booking_result(bigint, numeric, numeric, text, text,
                                                       text, text, text, text) to authenticated;
revoke all on function public.clear_booking_result(bigint) from public, anon;
grant execute on function public.clear_booking_result(bigint) to authenticated;
revoke all on function public.edit_booking_details(bigint, text, text, text, boolean, uuid, uuid)
  from public, anon;
grant execute on function public.edit_booking_details(bigint, text, text, text, boolean, uuid, uuid)
  to authenticated;
