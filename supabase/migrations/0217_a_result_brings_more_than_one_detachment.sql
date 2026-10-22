-- 0217 · A result brings more than one detachment
--
-- The client's words: "Where we record game results anywhere across the site
-- (table bookings, events, competitions), currently we only allow one
-- detachment to be selected, which is incorrect. This should follow the same
-- process as the army list builder, where multiple detachments can be
-- selected but only one disposition."
--
-- So this is the builder's own rule, one layer out. The builder gained a
-- disposition step of its own in the same sitting: several detachments, and
-- ONE disposition for the army rather than one per detachment.
--
-- THE LEAD DETACHMENT STAYS CANONICAL. `game_result_armies.detachment` goes
-- on holding the first of the list, so the Meta Tracker's three rollups, the
-- event breakdown, `result_army_label` and every repository select keep
-- working untouched. That is the move 0069 made with `clubs.owner_id` against
-- `club_team` and 0173 made with `club_events.logo_src` against
-- `club_event_images`: add the list, mirror position 0 onto the column that
-- was already there, and nothing downstream has to learn anything.
--
-- There is no trigger doing the mirroring, deliberately. Every write to this
-- table goes through `put_result_army` and nothing else can reach it, so the
-- derivation lives in the one writer rather than in a trigger beside it.

begin;

-- ------------------------------------------------------------ the columns

alter table public.game_result_armies
  add column if not exists detachments text[] not null default '{}';

comment on column public.game_result_armies.detachments is
  'Every detachment this army brought. detachment holds the first of them.';

-- What is already recorded, as a list of one. Without it every army on the
-- site reads as having brought none the moment a reader asks for the list.
update public.game_result_armies
   set detachments = array[btrim(detachment)]
 where btrim(coalesce(detachment, '')) <> ''
   and coalesce(array_length(detachments, 1), 0) = 0;

-- A league table keeps its own typed columns, which is where the trigger
-- below reads from, so the list has to exist there too.
alter table public.club_competition_standings
  add column if not exists detachments text[] not null default '{}';

update public.club_competition_standings
   set detachments = array[btrim(detachment)]
 where btrim(coalesce(detachment, '')) <> ''
   and coalesce(array_length(detachments, 1), 0) = 0;

-- 0024 grants this table by column and a column nobody may name is readable
-- and never writable, which is the trap 0183 paid for two migrations ago.
grant insert (detachments), update (detachments)
  on public.club_competition_standings to authenticated;

-- ------------------------------------------------------------- validation

/**
 * Does this army exist in the pinned version, and what is everything called
 * there?
 *
 * 0135's own function with a list in place of the single detachment. The
 * disposition is checked against what the chosen detachments offer BETWEEN
 * them, which is `dispositionsForAll` in TypeScript and the same union for
 * the same reason: a disposition one of them can play is a disposition the
 * army can play, and narrowing to what they all share would refuse a legal
 * choice the moment somebody added a second detachment.
 *
 * Answers in the catalogue's own spelling, in the order the caller asked,
 * deduplicated on the fold. A detachment named twice is one detachment.
 */
create or replace function public.resolve_result_armies(
  p_edition text, p_version text,
  p_faction text, p_detachments text[], p_disposition text
) returns table (faction_id text, faction_label text, detachments text[])
language plpgsql stable security definer set search_path = public as $$
declare
  v_faction jsonb;
  v_det jsonb;
  v_asked text := btrim(coalesce(p_faction, ''));
  v_one text;
  v_out text[] := '{}';
  v_offered text[] := '{}';
begin
  if v_asked = '' then
    return query select ''::text, ''::text, '{}'::text[];
    return;
  end if;

  -- Nothing pinned, so nothing to validate against and nothing to
  -- canonicalise either: a club with the builder off still records what was
  -- typed, and the tracker can say the row was unpinned.
  if p_edition is null or p_version is null then
    select coalesce(array_agg(distinct btrim(x)) filter (where btrim(x) <> ''), '{}')
      into v_out
      from unnest(coalesce(p_detachments, '{}'::text[])) x;
    return query select lower(v_asked), v_asked, v_out;
    return;
  end if;

  select f into v_faction
    from public.army_catalogue_snapshots s,
         lateral jsonb_array_elements(s.catalogue -> 'systems' -> 0 -> 'factions') f
   where s.edition_id = p_edition and s.catalogue_version = p_version
     and (lower(f ->> 'id') = lower(v_asked)
          or lower(f ->> 'label') = lower(v_asked));

  if v_faction is null then raise exception 'RESULT_BAD_FACTION'; end if;

  foreach v_one in array coalesce(p_detachments, '{}'::text[]) loop
    if btrim(coalesce(v_one, '')) = '' then continue; end if;

    select d into v_det
      from jsonb_array_elements(v_faction -> 'detachmentOptions') d
     where lower(d ->> 'label') = lower(btrim(v_one))
        or lower(d ->> 'id') = lower(btrim(v_one));

    if v_det is null then raise exception 'RESULT_BAD_DETACHMENT'; end if;

    -- The same detachment twice is one, and the fold is what decides, so a
    -- caller sending two spellings of one cannot make the army look wider.
    if not (lower(v_det ->> 'label') = any (select lower(x) from unnest(v_out) x)) then
      v_out := v_out || (v_det ->> 'label');
      v_offered := v_offered || array(
        select x from jsonb_array_elements_text(v_det -> 'dispositions') x);
    end if;
  end loop;

  -- The union of what the chosen detachments offer, never the faction's whole
  -- list. A disposition that belongs to a detachment nobody brought is the one
  -- thing the pickers make unofferable, and this is what stops a hand-rolled
  -- PostgREST call doing it anyway.
  if coalesce(btrim(p_disposition), '') <> '' and not exists (
    select 1 from unnest(v_offered) x where lower(x) = lower(btrim(p_disposition))) then
    raise exception 'RESULT_BAD_DISPOSITION';
  end if;

  return query select lower(v_faction ->> 'id'), v_faction ->> 'label', v_out;
end $$;

revoke all on function public.resolve_result_armies(text, text, text, text[], text)
  from public, anon;

/**
 * The single-detachment form, kept as one line over the list.
 *
 * Its callers are the four writers in 0136 and the behaviour suites. Keeping
 * it as a wrapper rather than a second implementation is the whole point: two
 * readings of one rule drift, and the first thing they would disagree about
 * is whether a disposition is offerable.
 */
create or replace function public.resolve_result_army(
  p_edition text, p_version text,
  p_faction text, p_detachment text, p_disposition text
) returns table (faction_id text, faction_label text, detachment text)
language sql stable security definer set search_path = public as $$
  select r.faction_id, r.faction_label, coalesce(r.detachments[1], '')
    from public.resolve_result_armies(
      p_edition, p_version, p_faction,
      case when btrim(coalesce(p_detachment, '')) = '' then '{}'::text[]
           else array[btrim(p_detachment)] end,
      p_disposition) r;
$$;

revoke all on function public.resolve_result_army(text, text, text, text, text)
  from public, anon;

-- ---------------------------------------------------------------- the write

/**
 * Write one side's army, with every detachment it brought.
 *
 * 0135's writer. The army jsonb may carry `detachments` as an array or the
 * older `detachment` as one string, and a caller that has not been updated
 * goes on working: a screen posting one detachment is an army with one.
 */
create or replace function public.put_result_army(
  p_source text, p_source_id bigint, p_side text,
  p_club bigint, p_played_on date, p_profile uuid, p_name text,
  p_army jsonb, p_edition text, p_version text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_faction text := btrim(coalesce(p_army ->> 'factionId', ''));
  v_asked text[];
  v_disposition text := btrim(coalesce(p_army ->> 'disposition', ''));
  v_primary integer := nullif(p_army ->> 'primaryScore', '')::integer;
  v_secondary integer := nullif(p_army ->> 'secondaryScore', '')::integer;
  v_units text[];
  v_under text[];
  v_named record;
  v_detachments text[];
begin
  -- Nothing said, nothing stored. A result with no army fields leaves no row
  -- rather than an empty one, so the meta rollups never count a blank.
  if v_faction = '' and v_primary is null and v_secondary is null then
    delete from public.game_result_armies
     where source_type = p_source and source_id = p_source_id and side = p_side;
    return null;
  end if;

  if jsonb_typeof(p_army -> 'detachments') = 'array' then
    select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}')
      into v_asked
      from jsonb_array_elements_text(p_army -> 'detachments') x;
  else
    v_asked := case when btrim(coalesce(p_army ->> 'detachment', '')) = ''
                    then '{}'::text[]
                    else array[btrim(p_army ->> 'detachment')] end;
  end if;

  -- Refuses what is wrong and hands back the catalogue's own spelling of what
  -- is right, which is what the row stores.
  select * into v_named from public.resolve_result_armies(
    p_edition, p_version, v_faction, v_asked, v_disposition);

  if v_primary is not null and (v_primary < 0 or v_primary > 50) then
    raise exception 'RESULT_VP_RANGE';
  end if;
  if v_secondary is not null and (v_secondary < 0 or v_secondary > 40) then
    raise exception 'RESULT_VP_RANGE';
  end if;

  v_detachments := case when coalesce(array_length(v_named.detachments, 1), 0) > 0
                        then v_named.detachments else v_asked end;

  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}')
    into v_units
    from jsonb_array_elements_text(coalesce(p_army -> 'mvpUnits', '[]')) x;
  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}')
    into v_under
    from jsonb_array_elements_text(coalesce(p_army -> 'underwhelmingUnits', '[]')) x;

  insert into public.game_result_armies (
    source_type, source_id, side, club_id, played_on, profile_id, player_name,
    faction_id, faction_label, detachment, detachments, disposition,
    mvp_units, underwhelming_units,
    primary_score, secondary_score, painted, first_turn, battle_role,
    edition_id, catalogue_version)
  values (
    p_source, p_source_id, p_side, p_club, p_played_on, p_profile,
    left(coalesce(p_name, ''), 200),
    v_named.faction_id,
    -- The catalogue's label when there is one, so two spellings of one faction
    -- cannot read as two. What the caller sent is the fallback for a club with
    -- nothing pinned.
    coalesce(nullif(v_named.faction_label, ''),
             nullif(btrim(coalesce(p_army ->> 'factionLabel', '')), ''),
             v_faction),
    -- The lead one, which is what every reader of this column already means.
    coalesce(v_detachments[1], ''),
    v_detachments,
    v_disposition, v_units, v_under,
    v_primary, v_secondary,
    coalesce((p_army ->> 'painted')::boolean, false),
    case when coalesce(p_army ->> 'firstTurn', '') in ('first', 'second')
         then p_army ->> 'firstTurn' else '' end,
    case when coalesce(p_army ->> 'battleRole', '') in ('attacker', 'defender')
         then p_army ->> 'battleRole' else '' end,
    p_edition, p_version)
  on conflict (source_type, source_id, side) do update
    set club_id = excluded.club_id, played_on = excluded.played_on,
        profile_id = excluded.profile_id, player_name = excluded.player_name,
        faction_id = excluded.faction_id, faction_label = excluded.faction_label,
        detachment = excluded.detachment, detachments = excluded.detachments,
        disposition = excluded.disposition,
        mvp_units = excluded.mvp_units,
        underwhelming_units = excluded.underwhelming_units,
        primary_score = excluded.primary_score,
        secondary_score = excluded.secondary_score,
        painted = excluded.painted, first_turn = excluded.first_turn,
        battle_role = excluded.battle_role,
        edition_id = excluded.edition_id,
        catalogue_version = excluded.catalogue_version
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.put_result_army(
  text, bigint, text, bigint, date, uuid, text, jsonb, text, text) from public, anon;

/**
 * What an army reads as on a result row, so a reader shows one string.
 *
 * Several detachments are joined with a comma inside the middle dots, never
 * with more dots: the dots divide the KINDS of fact, and a reader cannot tell
 * a second detachment from a disposition otherwise. `detachmentLine` in
 * `src/utils/result-army.ts` is the same rule for the same reason.
 */
create or replace function public.result_army_label(p_army jsonb)
returns text
language sql immutable as $$
  select nullif(btrim(concat_ws(' · ',
    nullif(btrim(coalesce(p_army ->> 'factionLabel', '')), ''),
    nullif(btrim(coalesce(
      case when jsonb_typeof(p_army -> 'detachments') = 'array'
           then (select string_agg(btrim(x), ', ')
                   from jsonb_array_elements_text(p_army -> 'detachments') x
                  where btrim(x) <> '')
           else p_army ->> 'detachment' end, '')), ''))), '');
$$;

revoke all on function public.result_army_label(jsonb) from public, anon;
grant execute on function public.result_army_label(jsonb) to authenticated;

-- ------------------------------------------------- a league table's own row
--
-- 0194's trigger, with the list in place of the single detachment. Every
-- comment on it is that migration's and still true; what moved is `detachment`
-- becoming `detachments`, and a named list filling in ALL of what it was built
-- with rather than only its first.

create or replace function public.competition_standing_army()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_club bigint;
  v_cat record;
  v_list public.army_lists%rowtype;
  v_version public.army_list_versions%rowtype;
  v_faction text;
  v_detachments text[];
  v_disposition text;
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

  v_faction     := btrim(coalesce(new.faction, ''));
  v_disposition := btrim(coalesce(new.disposition, ''));

  -- The list, or the one column that came before it. A row saved before 0217
  -- carries the second and not the first.
  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}')
    into v_detachments
    from unnest(coalesce(new.detachments, '{}'::text[])) x;
  if coalesce(array_length(v_detachments, 1), 0) = 0
     and btrim(coalesce(new.detachment, '')) <> '' then
    v_detachments := array[btrim(new.detachment)];
  end if;

  -- 0140's wrapper, kept. The table is saved whole, so one bad row refuses
  -- twenty, and the code alone ("RESULT_BAD_FACTION") gave a club no way to
  -- tell WHICH row. Everything that can refuse goes inside it, including the
  -- list guards added in 0194: a league table with a mis-named list has
  -- exactly the same problem as one with a mis-typed faction.
  begin
    if new.army_list_id is not null then
      select * into v_list from public.army_lists
       where id = new.army_list_id and deleted_at is null;
      if v_list.id is null then raise exception 'ARMY_LIST_NOT_FOUND'; end if;
      if v_list.club_id <> v_club then raise exception 'ARMY_WRONG_CLUB'; end if;
      -- Whose list it is, not whose it might have been. A free-text name on a
      -- league table has no account behind it and therefore no list to name,
      -- which is the same line `club_set_result_list` draws.
      if new.profile_id is null or v_list.profile_id <> new.profile_id then
        raise exception 'ARMY_NOT_THEIRS';
      end if;

      select * into v_version from public.army_list_versions
       where id = v_list.current_version_id;
      if v_version.id is null then raise exception 'ARMY_LIST_NOT_FOUND'; end if;

      -- Only where the club has not said. A club that typed a faction and then
      -- named a list keeps what it typed: the list fills a gap, it does not
      -- overrule somebody.
      if v_faction = '' then
        v_faction := btrim(coalesce(v_version.faction_label, v_list.faction_label, ''));
      end if;
      if coalesce(array_length(v_detachments, 1), 0) = 0 then
        -- All of them, which is the item: a list built on two detachments
        -- names two. Taking the first alone is what this migration exists to
        -- stop, and it would be the one place still doing it.
        select coalesce(array_agg(btrim(d ->> 'detachment'))
                 filter (where btrim(coalesce(d ->> 'detachment', '')) <> ''), '{}')
          into v_detachments
          from jsonb_array_elements(coalesce(v_version.detachment_selections, '[]'::jsonb)) d;
        -- The disposition rides with the detachments it came from. Taking them
        -- from the list and leaving it typed would pair a disposition with
        -- detachments it does not belong to, which is the one rule the whole
        -- catalogue is shaped around. One for the army since the builder's
        -- disposition step, so the first row answers for all of them.
        if v_disposition = '' then
          v_disposition := btrim(coalesce(
            v_version.detachment_selections -> 0 ->> 'disposition', ''));
        end if;
      end if;
    end if;

    -- An empty army deletes its row rather than filing a blank, which is what
    -- `put_result_army` does with one and why this is not conditional here.
    perform public.put_result_army('competition', new.id, 'one', v_club,
      public.london_today(), new.profile_id, new.member_name,
      jsonb_build_object(
        -- The typed spelling, NOT lowercased, which 0194 records in full.
        'factionId', v_faction,
        'factionLabel', v_faction,
        'detachments', to_jsonb(v_detachments),
        'disposition', v_disposition),
      v_cat.edition_id, v_cat.catalogue_version);

    -- The list columns, onto the row that now exists. Frozen, so a later edit
    -- to the list does not rewrite what a season was played with.
    if new.army_list_id is not null then
      update public.game_result_armies
         set list_id = v_list.id,
             list_version_id = v_version.id,
             list_name = left(v_list.name, 200),
             list_version_number = v_version.version_number,
             snapshot = jsonb_build_object(
               'units', v_version.units,
               'detachments', v_version.detachment_selections,
               'totalPoints', v_version.total_points,
               'catalogueVersion', v_version.catalogue_version)
       where source_type = 'competition' and source_id = new.id and side = 'one';
    else
      -- And taking the list off has to reach the mirror, which the upsert
      -- inside `put_result_army` does not.
      update public.game_result_armies
         set list_id = null, list_version_id = null, list_name = '',
             list_version_number = null, snapshot = '{}'::jsonb
       where source_type = 'competition' and source_id = new.id and side = 'one'
         and list_id is not null;
    end if;
  exception
    when others then
      -- The code stays at the front so the service can still match on it.
      raise exception '% for %', sqlerrm,
        coalesce(nullif(btrim(new.member_name), ''), 'a player');
  end;

  return new;
end $$;

drop trigger if exists competition_standing_army on public.club_competition_standings;
create trigger competition_standing_army
  after insert or update or delete on public.club_competition_standings
  for each row execute function public.competition_standing_army();

-- ------------------------------------------------------------- a placing
--
-- 0177's function with the list in place of the single detachment. A new
-- parameter type makes a NEW function in Postgres rather than replacing the
-- one that is there, so the nine-argument form is dropped first: a caller
-- that forgets to update would otherwise go on resolving to it and quietly
-- record one detachment, which is the bug being fixed.

drop function if exists public.save_event_placing(
  bigint, bigint, integer, text, uuid, text, text, text, text);

create or replace function public.save_event_placing(
  p_event bigint, p_placing bigint, p_rank integer, p_name text, p_profile uuid,
  p_faction text, p_detachments text[], p_disposition text default '',
  p_code text default null
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_club bigint; v_name text := btrim(coalesce(p_name, ''));
  v_army jsonb; v_label text; v_id bigint; v_cat record; v_event record;
  v_detachments text[];
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

  if p_profile is not null and not public.may_link_profile(v_club, p_profile, p_code) then
    raise exception 'MEMBER_CODE_NEEDED';
  end if;

  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}')
    into v_detachments
    from unnest(coalesce(p_detachments, '{}'::text[])) x;

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
    -- snapshot stage 10 put here.
    select coalesce(r.army, '{}'::jsonb) into v_army
      from public.club_event_results r
     where r.id = p_placing and r.event_id = p_event;
    if v_army is null then raise exception 'PLACING_NOT_FOUND'; end if;
  end if;

  -- Both keys. `detachment` is still what the placing card, the placing row
  -- and every imported result read, so it keeps holding the lead one, and the
  -- list sits beside it for a reader that wants all of them.
  v_army := v_army || jsonb_build_object(
    'factionLabel', nullif(btrim(coalesce(p_faction, '')), ''),
    'detachment',   nullif(v_detachments[1], ''),
    'detachments',  to_jsonb(v_detachments),
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
      'detachments', to_jsonb(v_detachments),
      'disposition', btrim(coalesce(p_disposition, ''))),
    v_cat.edition_id, v_cat.catalogue_version);

  return v_id;
end $$;

-- Grants go with a dropped function and have to be restated.
revoke all on function public.save_event_placing(
  bigint, bigint, integer, text, uuid, text, text[], text, text) from public, anon;
grant execute on function public.save_event_placing(
  bigint, bigint, integer, text, uuid, text, text[], text, text) to authenticated;

-- ---------------------------------------------------------------- the reads
--
-- Four functions that hand a result's army to a screen, each gaining the list.
-- A return type cannot change under `create or replace`, so every one of them
-- is dropped first.

/**
 * One row per side per game, for the games already on a page.
 *
 * It was a select over `game_result_armies` in `findResultArmies`, which could
 * not name `detachments`: `src/types/database.ts` has not been regenerated
 * since 0151 and `check:columns` is right to refuse a column its schema has
 * never heard of. `security invoker`, because the table's own policies already
 * decide which of these rows a reader may see and a definer here would mean
 * writing that rule out a second time.
 */
create or replace function public.result_armies_for(
  p_source text, p_ids bigint[]
) returns table (
  source_id bigint, side text,
  faction_id text, faction_label text,
  detachment text, detachments text[], disposition text,
  mvp_units text[], underwhelming_units text[],
  primary_score integer, secondary_score integer, painted boolean,
  first_turn text, battle_role text,
  list_id bigint, list_name text
)
language sql stable security invoker set search_path = public as $$
  select a.source_id, a.side, a.faction_id, a.faction_label,
         a.detachment, a.detachments, a.disposition,
         a.mvp_units, a.underwhelming_units,
         a.primary_score, a.secondary_score, a.painted,
         a.first_turn, a.battle_role, a.list_id, a.list_name
    from public.game_result_armies a
   where a.source_type = p_source
     and a.source_id = any (coalesce(p_ids, '{}'::bigint[]));
$$;

revoke all on function public.result_armies_for(text, bigint[]) from public;
grant execute on function public.result_armies_for(text, bigint[])
  to anon, authenticated;

/**
 * Both sides of a set of games, whatever kind of game they were.
 *
 * `findGameArmies`'s select, for the same reason. `source_type` comes back and
 * is part of the key, so the deliberately wide list of ids cannot cross a
 * booking with a competition game that happens to share a number.
 */
create or replace function public.game_armies_for(
  p_sources text[], p_ids bigint[]
) returns table (
  source_type text, source_id bigint, side text,
  faction_id text, faction_label text,
  detachment text, detachments text[], disposition text,
  mvp_units text[], underwhelming_units text[],
  primary_score integer, secondary_score integer, painted boolean,
  first_turn text, battle_role text,
  mission text, deployment text, terrain text,
  profile_id uuid, player_name text,
  list_id bigint, list_name text, list_version_number integer, snapshot jsonb
)
language sql stable security invoker set search_path = public as $$
  select a.source_type, a.source_id, a.side, a.faction_id, a.faction_label,
         a.detachment, a.detachments, a.disposition,
         a.mvp_units, a.underwhelming_units,
         a.primary_score, a.secondary_score, a.painted,
         a.first_turn, a.battle_role,
         a.mission, a.deployment, a.terrain,
         a.profile_id, a.player_name,
         a.list_id, a.list_name, a.list_version_number, a.snapshot
    from public.game_result_armies a
   where a.source_type = any (coalesce(p_sources, '{}'::text[]))
     and a.source_id = any (coalesce(p_ids, '{}'::bigint[]));
$$;

revoke all on function public.game_armies_for(text[], bigint[]) from public;
grant execute on function public.game_armies_for(text[], bigint[])
  to anon, authenticated;

/** Every army on one event's draw, with the setup beside it. 0181, widened. */
drop function if exists public.event_pairing_armies(bigint);
create or replace function public.event_pairing_armies(p_event bigint)
returns table (
  source_id bigint, side text,
  faction_id text, faction_label text,
  detachment text, detachments text[], disposition text,
  list_id bigint, list_name text, list_version_number integer, snapshot jsonb,
  mvp_units text[], underwhelming_units text[],
  primary_score integer, secondary_score integer, painted boolean,
  first_turn text, battle_role text, outcome text,
  mission text, deployment text, terrain text
)
language sql stable security invoker set search_path = public as $$
  select a.source_id, a.side,
         a.faction_id, a.faction_label, a.detachment, a.detachments, a.disposition,
         a.list_id, a.list_name, a.list_version_number, a.snapshot,
         a.mvp_units, a.underwhelming_units,
         a.primary_score, a.secondary_score, a.painted,
         a.first_turn, a.battle_role, a.outcome,
         m.result_mission, m.result_deployment, m.result_terrain
    from public.game_result_armies a
    join public.club_event_pairing_matches m on m.id = a.source_id
   where a.source_type = 'event_pairing' and m.event_id = p_event;
$$;

grant execute on function public.event_pairing_armies(bigint) to anon, authenticated;

/** Every army on one competition's games. 0181, widened. */
drop function if exists public.competition_game_armies(bigint);
create or replace function public.competition_game_armies(p_competition bigint)
returns table (
  source_id bigint, side text,
  faction_id text, faction_label text,
  detachment text, detachments text[], disposition text,
  list_id bigint, list_name text, list_version_number integer, snapshot jsonb,
  mvp_units text[], underwhelming_units text[],
  primary_score integer, secondary_score integer, painted boolean,
  first_turn text, battle_role text, outcome text
)
language sql stable security invoker set search_path = public as $$
  select a.source_id, a.side,
         a.faction_id, a.faction_label, a.detachment, a.detachments, a.disposition,
         a.list_id, a.list_name, a.list_version_number, a.snapshot,
         a.mvp_units, a.underwhelming_units,
         a.primary_score, a.secondary_score, a.painted,
         a.first_turn, a.battle_role, a.outcome
    from public.game_result_armies a
   where a.source_type = 'competition_match'
     and a.source_id in (
       select m.id from public.club_competition_matches m
         join public.club_competition_updates u on u.id = m.update_id
        where u.competition_id = p_competition);
$$;

grant execute on function public.competition_game_armies(bigint) to anon, authenticated;

/**
 * What a league table's rows were played with. 0194, widened.
 *
 * The list-only filter is gone with it: the detachments are on every army row
 * whether or not a list was named, and the question this answers is now "what
 * does this standing carry" rather than "which of them name a list". One row
 * per standing either way, so it is the same cardinality it always was.
 */
drop function if exists public.competition_standing_lists(bigint[]);
create or replace function public.competition_standing_lists(
  p_competitions bigint[]
)
returns table (
  competition_id bigint,
  standing_id bigint,
  detachments text[],
  list_id bigint,
  list_name text,
  list_version_number integer,
  snapshot jsonb
)
language sql stable security invoker set search_path = public as $$
  select s.competition_id, a.source_id, a.detachments, a.list_id, a.list_name,
         a.list_version_number, a.snapshot
    from public.game_result_armies a
    join public.club_competition_standings s on s.id = a.source_id
   where a.source_type = 'competition'
     and s.competition_id = any(coalesce(p_competitions, '{}'::bigint[]));
$$;

revoke all on function public.competition_standing_lists(bigint[]) from public;
grant execute on function public.competition_standing_lists(bigint[])
  to anon, authenticated;

/**
 * Every list the people on one club's results have built. 0163, widened.
 *
 * It read `detachment_selections -> 0` and answered with one detachment, so a
 * list built on two filled a result in with one of them. Naming a list is
 * supposed to save typing, not lose half the answer.
 */
drop function if exists public.club_member_lists(bigint, uuid[]);
create or replace function public.club_member_lists(
  p_club bigint, p_profiles uuid[] default null
)
returns table (
  id bigint, profile_id uuid, name text, list_type text,
  faction_id text, faction_label text,
  detachments text[], disposition text,
  total_points integer, points_limit text, version_number integer
)
language sql stable security definer set search_path = public as $$
  select l.id, l.profile_id, l.name, l.list_type,
         v.faction_id, v.faction_label,
         (select coalesce(array_agg(btrim(d ->> 'detachment'))
                   filter (where btrim(coalesce(d ->> 'detachment', '')) <> ''), '{}')
            from jsonb_array_elements(coalesce(v.detachment_selections, '[]'::jsonb)) d),
         btrim(coalesce(v.detachment_selections -> 0 ->> 'disposition', '')),
         v.total_points, v.points_limit, v.version_number
    from public.army_lists l
    join public.army_list_versions v on v.id = l.current_version_id
   where l.club_id = p_club
     and l.deleted_at is null
     and (p_profiles is null or l.profile_id = any (p_profiles))
     and (public.club_can(p_club, 'events.manage') or public.is_admin())
   order by l.updated_at desc
   limit 500;
$$;

revoke all on function public.club_member_lists(bigint, uuid[]) from public, anon;
grant execute on function public.club_member_lists(bigint, uuid[]) to authenticated;

commit;
