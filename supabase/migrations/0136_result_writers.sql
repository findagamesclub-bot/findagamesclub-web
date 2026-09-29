-- 0136 · The four ways an army reaches a result
--
-- A table board game, a competition match, an event draw and an event podium.
-- Four sources, one table, because stage 9 reads one thing rather than four,
-- and because "which armies win at this club" is a question about games and
-- not about where they were recorded.
--
-- Each writer checks its own permission before it calls `put_result_army`.
-- That is deliberate: "may this person record this result" has a different
-- answer per source, and answering it inside the shared writer would be
-- answering it four times badly. The shared writer's job is the validation and
-- the shape.
--
-- Three of the four are functions the app calls. The competition standing is a
-- trigger, because its table is replaced wholesale on every save and a row's
-- id does not survive an edit: see the note above it.
--
-- `booked_by_army` and `opponent_army` keep being written as
-- `faction · detachment`, so every existing reader carries on working and
-- nothing has to be migrated at once. That is the same call 0090 made about
-- `legacy_id`: a column somebody's page still reads is not one to drop on the
-- day a better one arrives.
--
-- Checked on a throwaway Postgres built from every migration: a stranger
-- cannot record, a player can, an army lands as its own row, clearing a result
-- takes the armies with it, a faction that is not in the pinned version is
-- refused by name, a disposition from another detachment is refused even when
-- the faction and detachment are both right, and rewriting a league table
-- moves its armies with it rather than leaving the old rows counting.

/**
 * The version a club records against.
 *
 * One lookup, so every writer pins the same thing and none of them has to know
 * how the setting is stored.
 */
create or replace function public.club_catalogue_version(p_club bigint)
returns table (edition_id text, catalogue_version text)
language sql stable security definer set search_path = public as $$
  select b.edition_id, b.catalogue_version
    from public.army_builder_for(p_club) b
   where b.enabled;
$$;

-- A default parameter makes a NEW function, not a replacement, so both would
-- exist and every call that passes the old argument count would be ambiguous:
-- "function record_booking_result(...) is not unique". The old ones go first.
-- Every caller in the app passes named parameters through PostgREST, so
-- dropping is safe the moment the new one is in the same migration.
drop function if exists public.record_booking_result(
  bigint, numeric, numeric, text, text, text, text, text, text);
drop function if exists public.save_event_placing(
  bigint, bigint, integer, text, uuid, text, text);

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
  -- New: { one: {...}, two: {...} }, either side optional. Absent means the
  -- club does not run the builder, or nobody filled the fields in.
  p_armies jsonb default '{}'
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
         result_mission      = left(btrim(coalesce(p_mission, '')), 120),
         result_deployment   = v_deploy,
         result_terrain      = left(btrim(coalesce(p_terrain, '')), 120),
         result_confirmation = v_confirm,
         result_by           = auth.uid(),
         result_at           = now()
   where id = p_booking;
end $$;

/**
 * Clearing a result takes its armies with it.
 *
 * Without this the meta rollups would go on counting a game the club has said
 * did not happen, which is exactly the caveat the tracker is supposed to be
 * able to explain.
 */
create or replace function public.clear_booking_result(p_booking bigint)
returns void
language plpgsql security definer set search_path = public as $$
declare v_target public.club_bookings%rowtype; v_manages boolean;
begin
  select * into v_target from public.club_bookings where id = p_booking;
  if not found then raise exception 'RESULT_NO_BOOKING'; end if;

  v_manages := public.club_can(v_target.club_id, 'results.manage');

  if not (coalesce(
            auth.uid() in (v_target.booked_by, v_target.opponent_profile_id,
                           v_target.accepted_by), false)
          or v_manages) then
    raise exception 'RESULT_NOT_YOURS';
  end if;

  if not v_manages and v_target.result_confirmation in ('admin-confirmed', 'disputed') then
    raise exception 'RESULT_LOCKED';
  end if;

  delete from public.game_result_armies
   where source_type = 'booking' and source_id = p_booking;

  update public.club_bookings
     set booked_by_score = null, opponent_score = null,
         booked_by_army = '', opponent_army = '',
         result_mission = '', result_deployment = '', result_terrain = '',
         result_confirmation = 'submitted',
         -- Nulled, not signed. Clearing a result is unrecording it, so leaving
         -- a `result_by` behind would say somebody recorded nothing.
         result_by = null, result_at = null
   where id = p_booking;
end $$;

-- ------------------------------------------------- an event's finishing places

/**
 * A placing, with the disposition the client asked for.
 *
 * 0058 already stored `factionLabel` and `detachment` in the placing's own
 * jsonb and merged rather than replaced, "because the army object will hold an
 * Army Builder list snapshot in M3". This is that. The jsonb keeps working for
 * the event page, and the same three values are mirrored into
 * `game_result_armies` so the rollups read one table.
 */
create or replace function public.save_event_placing(
  p_event bigint, p_placing bigint, p_rank integer, p_name text, p_profile uuid,
  p_faction text, p_detachment text, p_disposition text default ''
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_club bigint; v_name text := btrim(coalesce(p_name, ''));
  v_army jsonb; v_label text; v_id bigint; v_cat record; v_event record;
begin
  if auth.uid() is null then raise exception 'PLACING_NOT_YOURS'; end if;

  select e.club_id, e.start_date into v_event from public.club_events e where e.id = p_event;
  v_club := v_event.club_id;
  if v_club is null then raise exception 'PLACING_NO_EVENT'; end if;
  if not public.can_manage_club(v_club) then raise exception 'PLACING_NOT_YOURS'; end if;
  if p_rank is null or p_rank < 1 or p_rank > 999 then
    raise exception 'PLACING_RANK_RANGE';
  end if;
  if v_name = '' then raise exception 'PLACING_NAME_MISSING'; end if;

  -- 1st, 2nd, 3rd, then th. 11th to 13th are the exceptions every naive
  -- version of this gets wrong.
  v_label := p_rank || case
    when p_rank % 100 between 11 and 13 then 'th'
    when p_rank % 10 = 1 then 'st'
    when p_rank % 10 = 2 then 'nd'
    when p_rank % 10 = 3 then 'rd'
    else 'th' end || ' place';

  if p_placing is null then
    v_army := '{}'::jsonb;
  else
    -- Merged, not replaced: a club fixing a spelling must not delete a list
    -- snapshot stage 10 will put here.
    select coalesce(r.army, '{}'::jsonb) into v_army
      from public.club_event_results r
     where r.id = p_placing and r.event_id = p_event;
    if v_army is null then raise exception 'PLACING_NOT_FOUND'; end if;
  end if;

  v_army := v_army || jsonb_build_object(
    'factionLabel', nullif(btrim(coalesce(p_faction, '')), ''),
    'detachment',   nullif(btrim(coalesce(p_detachment, '')), ''),
    'disposition',  nullif(btrim(coalesce(p_disposition, '')), ''));

  if p_placing is null then
    insert into public.club_event_results
      (event_id, rank, placement, member_name, member_profile_id, is_member, army)
    values (p_event, p_rank::smallint, v_label, left(v_name, 120), p_profile,
            p_profile is not null, v_army)
    returning id into v_id;
  else
    update public.club_event_results
       set rank = p_rank::smallint, placement = v_label,
           member_name = left(v_name, 120), member_profile_id = p_profile,
           is_member = p_profile is not null, army = v_army
     where id = p_placing and event_id = p_event
    returning id into v_id;
    if v_id is null then raise exception 'PLACING_NOT_FOUND'; end if;
  end if;

  -- And into the one table stage 9 reads. A podium has no scores of its own,
  -- so only the army travels.
  select * into v_cat from public.club_catalogue_version(v_club);
  perform public.put_result_army('event_podium', v_id, 'one', v_club,
    v_event.start_date, p_profile, v_name,
    jsonb_build_object(
      'factionId', lower(btrim(coalesce(p_faction, ''))),
      'factionLabel', btrim(coalesce(p_faction, '')),
      'detachment', btrim(coalesce(p_detachment, '')),
      'disposition', btrim(coalesce(p_disposition, ''))),
    v_cat.edition_id, v_cat.catalogue_version);

  return v_id;
end $$;

-- ------------------------------------------------------- a round of the draw

/**
 * Both armies on one table of a draw.
 *
 * Its own function rather than a wider `save_pairing_match`, because scores and
 * armies are entered on different screens at different moments: scores between
 * rounds with twenty tables waiting, armies whenever somebody gets round to it.
 */
create or replace function public.save_pairing_armies(
  p_match bigint, p_armies jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_match record; v_club bigint; v_date date; v_cat record;
begin
  select m.*, e.club_id, e.start_date into v_match
    from public.club_event_pairing_matches m
    join public.club_events e on e.id = m.event_id
   where m.id = p_match;
  if v_match is null then raise exception 'PAIRING_NOT_FOUND'; end if;

  v_club := v_match.club_id;
  v_date := v_match.start_date;
  if not public.can_manage_club(v_club) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select * into v_cat from public.club_catalogue_version(v_club);

  if p_armies ? 'one' then
    perform public.put_result_army('event_pairing', p_match, 'one', v_club, v_date,
      v_match.player_one_id, v_match.player_one, p_armies -> 'one',
      v_cat.edition_id, v_cat.catalogue_version);
  end if;
  if p_armies ? 'two' then
    perform public.put_result_army('event_pairing', p_match, 'two', v_club, v_date,
      v_match.player_two_id, v_match.player_two, p_armies -> 'two',
      v_cat.edition_id, v_cat.catalogue_version);
  end if;

  return true;
end $$;

-- ----------------------------------------------------- a competition standing

/**
 * The disposition, beside the faction and detachment 0024 already stores.
 *
 * A standing is the one source with nowhere else to put it: a booking has its
 * own army row and a placing has its `army` jsonb, but the standings table is
 * columns, and without this the disposition would survive only in the mirror
 * and vanish the next time the table was saved.
 */
alter table public.club_competition_standings
  add column if not exists disposition text not null default '';

/**
 * A standing mirrors itself into the one table stage 9 reads.
 *
 * A trigger rather than a function the app calls, because **the standings
 * table is replaced wholesale on every save**: `replaceStandings` deletes the
 * competition's rows and inserts them again, so a row's id does not survive an
 * edit and nothing on the screen could name one to write against. The trigger
 * follows the rows instead, which also means a row removed from a table stops
 * counting towards "which factions win here" the moment it goes.
 *
 * Definer, because `put_result_army` is granted to nobody: the writers are
 * what decide who may record a result, and this one's answer is the policy on
 * the standings table itself.
 */
create or replace function public.competition_standing_army()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_club bigint; v_cat record;
begin
  if tg_op = 'DELETE' then
    delete from public.game_result_armies
     where source_type = 'competition' and source_id = old.id;
    return old;
  end if;

  select c.club_id into v_club from public.club_competitions c
   where c.id = new.competition_id;
  if v_club is null then return new; end if;

  select * into v_cat from public.club_catalogue_version(v_club);

  -- An empty army deletes its row rather than filing a blank, which is what
  -- `put_result_army` does with one and why this is not conditional here.
  perform public.put_result_army('competition', new.id, 'one', v_club,
    public.london_today(), new.profile_id, new.member_name,
    jsonb_build_object(
      'factionId', lower(btrim(coalesce(new.faction, ''))),
      'factionLabel', btrim(coalesce(new.faction, '')),
      'detachment', btrim(coalesce(new.detachment, '')),
      'disposition', btrim(coalesce(new.disposition, ''))),
    v_cat.edition_id, v_cat.catalogue_version);

  return new;
end $$;

drop trigger if exists competition_standing_army on public.club_competition_standings;
create trigger competition_standing_army
  after insert or update or delete on public.club_competition_standings
  for each row execute function public.competition_standing_army();

revoke all on function public.club_catalogue_version(bigint) from public, anon;
revoke all on function public.save_pairing_armies(bigint, jsonb) from public, anon;
revoke all on function public.save_event_placing(
  bigint, bigint, integer, text, uuid, text, text, text) from public, anon;

grant execute on function public.club_catalogue_version(bigint) to authenticated;
grant execute on function public.save_pairing_armies(bigint, jsonb) to authenticated;
grant execute on function public.save_event_placing(
  bigint, bigint, integer, text, uuid, text, text, text) to authenticated;
