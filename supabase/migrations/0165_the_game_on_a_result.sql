-- The game a result was played with.
--
-- The client's words: "When recording game results whether for a normal club
-- night or for an event, we should allow the user to select the Game Type from
-- a drop down and have Warhammer 40k as an option. If this is selected, it then
-- asks for info such as faction, list, detachment, dispositions etc. This needs
-- to be flexible, as if recording a result for a different game, these options
-- will not be relevant and do not need to be shown to the user."
--
-- The army fields were gated on the CLUB, not on the game: `club_army_builder_
-- settings.enabled`. So a club that runs 40k on Thursdays and Blood Bowl on
-- Tuesdays was asked for a faction on both. The game has been on the booking
-- since 0014 (`game_title`, typed by whoever booked), and nothing could change
-- it afterwards, which is why the fix needs a writer rather than only a screen.
--
-- Only one new parameter. Which games count as Warhammer 40,000 is decided in
-- TypeScript, by `canonicalGame`, which folds "warhammer 40k" and "Warhammer
-- 40,000" to one spelling against `canonical-labels.json`. A second copy of
-- that list in SQL would drift from the one the import script and the directory
-- already share, so the service decides and sends empty armies when the game is
-- not 40k. `put_result_army` already deletes a row for an empty army, so
-- switching a game away from 40k takes its factions with it.
--
-- Checked on a throwaway Postgres built from every migration: the game saves,
-- an absent game leaves the booking's own alone, switching to another game
-- clears the armies that were recorded, and none of it is reachable by somebody
-- who did not play and does not run the club.

-- A default parameter makes a NEW function rather than replacing the old one,
-- and every call would then be ambiguous. 0136 learned this; the drop is the
-- same shape.
drop function if exists public.record_booking_result(
  bigint, numeric, numeric, text, text, text, text, text, text, jsonb);

create or replace function public.record_booking_result(
  p_booking bigint,
  p_booked_by_score numeric,
  p_opponent_score numeric,
  p_booked_by_army text default '',
  p_opponent_army text default '',
  p_mission text default '',
  p_deployment text default '',
  p_terrain text default '',
  p_confirmation text default '',
  p_armies jsonb default '{}',
  -- Null leaves the booking's own game alone, which is every caller that has
  -- not been updated and every screen that does not ask.
  p_game text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_target   public.club_bookings%rowtype;
  v_manages  boolean;
  v_plays    boolean;
  v_confirm  text;
  v_deploy   text;
  v_cat      record;
  v_one      jsonb := p_armies -> 'one';
  v_two      jsonb := p_armies -> 'two';
  v_one_label text;
  v_two_label text;
  v_other    uuid;
  v_game     text := nullif(btrim(coalesce(p_game, '')), '');
begin
  if auth.uid() is null then raise exception 'RESULT_NOT_YOURS'; end if;

  select * into v_target from public.club_bookings where id = p_booking;
  if not found then raise exception 'RESULT_NO_BOOKING'; end if;
  if v_target.status <> 'booked' then raise exception 'RESULT_CANCELLED'; end if;

  v_manages := public.club_can(v_target.club_id, 'results.manage');

  -- coalesced, because accepted_by is usually null and `x in (a, b, null)` is
  -- NULL rather than false when x matches neither.
  v_plays := coalesce(
    auth.uid() in (v_target.booked_by, v_target.opponent_profile_id, v_target.accepted_by),
    false);

  if not (v_plays or v_manages) then raise exception 'RESULT_NOT_YOURS'; end if;

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

  if v_game is not null and char_length(v_game) > 120 then
    raise exception 'RESULT_GAME_TOO_LONG';
  end if;

  v_deploy := replace(replace(lower(btrim(coalesce(p_deployment, ''))), ' ', '-'), '_', '-');
  if v_deploy <> '' and v_deploy not in
     ('search-and-destroy', 'dawn-of-war', 'hammer-and-anvil',
      'sweeping-engagement', 'tipping-point', 'crucible-of-battle') then
    raise exception 'RESULT_BAD_DEPLOYMENT';
  end if;

  if v_manages then
    v_confirm := lower(btrim(coalesce(nullif(p_confirmation, ''), 'admin-confirmed')));
    if v_confirm not in ('submitted', 'disputed', 'confirmed', 'admin-confirmed') then
      raise exception 'RESULT_BAD_STATE';
    end if;
  else
    v_confirm := 'submitted';
  end if;

  -- ----------------------------------------------------------- the armies
  select * into v_cat from public.club_catalogue_version(v_target.club_id);

  if v_one is not null then
    perform public.put_result_army('booking', p_booking, 'one',
      v_target.club_id, v_target.session_date, v_target.booked_by,
      -- The booking carries no name for its owner: `booked_by` is an account
      -- and the roster has the name. `opponent_name` exists because a game at
      -- the door has somebody with no account in it.
      coalesce((select full_name from public.profiles
                 where id = v_target.booked_by), ''), v_one,
      v_cat.edition_id, v_cat.catalogue_version);
  end if;
  if v_two is not null then
    -- Whoever took the table off a looking-for-game post sits in the
    -- opponent's seat, which is what every reader already does with this
    -- booking. Reading `opponent_profile_id` alone would file their game under
    -- nobody, and stage 9's "my record" would be missing it.
    v_other := coalesce(v_target.accepted_by, v_target.opponent_profile_id);
    perform public.put_result_army('booking', p_booking, 'two',
      v_target.club_id, v_target.session_date, v_other,
      coalesce(nullif((select full_name from public.profiles where id = v_other), ''),
               v_target.opponent_name, ''), v_two,
      v_cat.edition_id, v_cat.catalogue_version);
  end if;

  -- The free-text columns keep being written, from the army when there is one
  -- and from what was typed otherwise, so every reader that has ever shown
  -- "Adepta Sororitas · Hallowed Martyrs" carries on doing it.
  v_one_label := public.result_army_label(v_one);
  v_two_label := public.result_army_label(v_two);

  update public.club_bookings
     set booked_by_score     = p_booked_by_score,
         opponent_score      = p_opponent_score,
         booked_by_army      = coalesce(v_one_label, p_booked_by_army, ''),
         opponent_army       = coalesce(v_two_label, p_opponent_army, ''),
         game_title          = coalesce(v_game, game_title),
         result_mission      = left(btrim(coalesce(p_mission, '')), 120),
         result_deployment   = v_deploy,
         result_terrain      = left(btrim(coalesce(p_terrain, '')), 120),
         result_confirmation = v_confirm,
         result_by           = auth.uid(),
         result_at           = now()
   where id = p_booking;
end $$;

revoke all on function public.record_booking_result(
  bigint, numeric, numeric, text, text, text, text, text, text, jsonb, text)
  from public, anon;
grant execute on function public.record_booking_result(
  bigint, numeric, numeric, text, text, text, text, text, text, jsonb, text)
  to authenticated;
