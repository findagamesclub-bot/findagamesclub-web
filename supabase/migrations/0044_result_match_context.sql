-- 0044 · The rest of what legacy records for a game
--
-- Scores and armies have been stored since 0030. Legacy also keeps a "Match
-- context" panel on every result (_normalise_result_meta, club_store.py:6761):
-- the mission, the deployment, the terrain used, and how settled the result is.
--
-- The confirmation state is not just a fourth field. In legacy it decides who
-- may touch the result afterwards (_can_update_booking_result:16229):
--
--   * a club manager may always edit
--   * once the state is `admin-confirmed` or `disputed`, nobody else may
--   * a player's edit always leaves the state at `submitted`, because the
--     payload's confirmationState is dropped for anyone who cannot manage
--
-- Without it either player can quietly overwrite a score the other agreed to,
-- which is the actual reason the field exists.

alter table public.club_bookings
  add column if not exists result_mission      text not null default '',
  add column if not exists result_deployment   text not null default '',
  add column if not exists result_terrain      text not null default '',
  add column if not exists result_confirmation text not null default 'submitted';

alter table public.club_bookings
  drop constraint if exists club_bookings_result_deployment;
alter table public.club_bookings
  add constraint club_bookings_result_deployment
  check (result_deployment in ('', 'search-and-destroy', 'dawn-of-war', 'hammer-and-anvil',
                               'sweeping-engagement', 'tipping-point', 'crucible-of-battle'));

alter table public.club_bookings
  drop constraint if exists club_bookings_result_confirmation;
alter table public.club_bookings
  add constraint club_bookings_result_confirmation
  check (result_confirmation in ('submitted', 'disputed', 'confirmed', 'admin-confirmed'));

-- Nothing new is granted: the columns are written only through the function
-- below, which is where the lock lives.

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

  v_manages := public.can_manage_club(v_target.club_id);

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

revoke all on function public.record_booking_result(bigint, numeric, numeric, text, text,
                                                    text, text, text, text) from public, anon;
grant execute on function public.record_booking_result(bigint, numeric, numeric, text, text,
                                                       text, text, text, text) to authenticated;

-- Clearing a result puts it back to unrecorded, state included, and is refused
-- on a locked one for the same reason an edit is.
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

  v_manages := public.can_manage_club(v_target.club_id);

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
