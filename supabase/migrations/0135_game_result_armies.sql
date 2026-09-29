-- 0135 · What somebody actually played
--
-- The client's words, three times over: "Army faction, list and disposition
-- shown against an event placing", "against club competitions and leagues",
-- and "show overview of what armies are being/were taken to the event and win
-- rate percentage per army faction and disposition taken".
--
-- One row per player per game, whatever kind of game it was. Four sources
-- write into it and stage 9 reads one table rather than four.
--
-- **A result carries one detachment and one disposition, not a list.**
-- `M3-PLAN.md` describes `detachment_selections jsonb`, which is the shape of
-- an army list; a game is played with one detachment and legacy reads exactly
-- one (`club_store.py:6412`). The jsonb belongs in stage 10 where lists live.
-- Written down rather than corrected silently, because the plan is our reading
-- of the requirement and the requirement is the source.
--
-- Legacy's rules, copied: primary at most 50 (6433), secondary at most 40
-- (6435), and `total_vp = primary + secondary + (painted ? 10 : 0)` (6437).
-- Total VP is generated, never typed: a figure the browser can name is a
-- figure the browser can choose, which is the rule the ticket prices already
-- follow.
--
-- Checked on a throwaway Postgres built from every migration: nobody may write
-- it directly, one row per side per source, a score over the cap is refused,
-- the total is computed and cannot be set, and a row pins the version it was
-- recorded against.

create table public.game_result_armies (
  id          bigint generated always as identity primary key,
  source_type text   not null,
  source_id   bigint not null,
  side        text   not null,

  club_id     bigint references public.clubs (id) on delete cascade,
  played_on   date,
  profile_id  uuid references public.profiles (id) on delete set null,
  -- A game played at the door carries a name and no account, the same way a
  -- booking does.
  player_name text not null default '',

  faction_id    text not null default '',
  faction_label text not null default '',
  -- One each. See the note above.
  detachment  text not null default '',
  disposition text not null default '',

  mvp_units           text[] not null default '{}',
  underwhelming_units text[] not null default '{}',

  primary_score   integer,
  secondary_score integer,
  painted         boolean not null default false,
  total_vp integer generated always as (
    case when primary_score is null or secondary_score is null then null
         else primary_score + secondary_score + case when painted then 10 else 0 end
    end) stored,

  first_turn  text not null default '',
  battle_role text not null default '',

  -- What it was recorded against, so republishing the catalogue cannot rewrite
  -- what somebody played last April.
  edition_id        text,
  catalogue_version text,
  -- The unit and detachment names as they read on the day, for the one case
  -- the pinned version cannot answer: an edition deleted outright.
  snapshot jsonb not null default '{}',

  created_at timestamptz not null default now(),

  constraint game_result_armies_source check (source_type in
    ('booking', 'competition', 'event_pairing', 'event_podium')),
  constraint game_result_armies_side check (side in ('one', 'two')),
  constraint game_result_armies_primary check
    (primary_score is null or primary_score between 0 and 50),
  constraint game_result_armies_secondary check
    (secondary_score is null or secondary_score between 0 and 40),
  constraint game_result_armies_turn check
    (first_turn in ('', 'first', 'second')),
  constraint game_result_armies_role check
    (battle_role in ('', 'attacker', 'defender'))
);

-- One army per side per game. Recording a result twice replaces it rather than
-- filing a second, which is what `on conflict` in the writers depends on.
create unique index game_result_armies_one_side
  on public.game_result_armies (source_type, source_id, side);

-- What stage 9 reads: a club's games over a window, and one person's history.
create index game_result_armies_club_idx
  on public.game_result_armies (club_id, played_on desc);
create index game_result_armies_profile_idx
  on public.game_result_armies (profile_id, played_on desc)
  where profile_id is not null;
create index game_result_armies_faction_idx
  on public.game_result_armies (faction_id, played_on desc)
  where faction_id <> '';

revoke insert, update, delete on public.game_result_armies from authenticated, anon;
grant select on public.game_result_armies to authenticated;

alter table public.game_result_armies enable row level security;

/**
 * Who may read a recorded army.
 *
 * The same people who may read the result it belongs to. A booking's result is
 * the club's business, so this is club membership; an event podium and a
 * competition standing are already public once played, and the rollups in
 * stage 9 read through a definer function rather than through this policy.
 */
create policy game_result_armies_select on public.game_result_armies
  for select to authenticated
  using (
    source_type in ('event_podium', 'competition')
    or profile_id = (select auth.uid())
    or (club_id is not null
        and (public.is_club_member(club_id) or public.can_manage_club(club_id)))
  );

do $$
declare v_bad boolean;
begin
  select bool_or(column_name is null) into v_bad from (
    select null::text as column_name from information_schema.role_table_grants
     where table_name = 'game_result_armies' and grantee = 'authenticated'
       and privilege_type = 'INSERT'
    union all
    select column_name from information_schema.role_column_grants
     where table_name = 'game_result_armies' and grantee = 'authenticated'
       and privilege_type = 'INSERT') g;
  if coalesce(v_bad, false) then
    raise exception 'game_result_armies still carries a whole-table insert grant';
  end if;
end $$;

-- --------------------------------------------------------------- validation

/**
 * Does this army exist in the pinned version, and what is it called there?
 *
 * Reads the snapshot rather than the live tables, because the point of pinning
 * is that a republish cannot change the answer. Raises by name so a screen
 * never has to guess from a Postgres error string.
 *
 * It answers with the catalogue's own spelling as well as refusing, and that
 * is what makes the rollups in stage 9 group anything. **A faction reaches
 * this as an id from a picker and as a label from a league table**, because
 * `club_competition_standings.faction` has been a typed string since 0024 and
 * so has a placing's. Storing what each caller happened to send would leave
 * "Adepta Sororitas" and "adepta-sororitas" as two factions that never add up.
 * A detachment arrives both ways for the same reason.
 *
 * Every field is optional, as in legacy. What is refused is a value that is
 * there and wrong, never a value that is absent.
 */
create or replace function public.resolve_result_army(
  p_edition text, p_version text,
  p_faction text, p_detachment text, p_disposition text
) returns table (faction_id text, faction_label text, detachment text)
language plpgsql stable security definer set search_path = public as $$
declare v_faction jsonb; v_det jsonb; v_asked text := btrim(coalesce(p_faction, ''));
begin
  if v_asked = '' then
    return query select ''::text, ''::text, ''::text;
    return;
  end if;

  -- Nothing pinned, so nothing to validate against and nothing to canonicalise
  -- either: a club with the builder off still records what was typed, and the
  -- tracker can say the row was unpinned.
  if p_edition is null or p_version is null then
    return query select lower(v_asked), v_asked, btrim(coalesce(p_detachment, ''));
    return;
  end if;

  select f into v_faction
    from public.army_catalogue_snapshots s,
         lateral jsonb_array_elements(s.catalogue -> 'systems' -> 0 -> 'factions') f
   where s.edition_id = p_edition and s.catalogue_version = p_version
     and (lower(f ->> 'id') = lower(v_asked)
          or lower(f ->> 'label') = lower(v_asked));

  if v_faction is null then raise exception 'RESULT_BAD_FACTION'; end if;

  if coalesce(btrim(p_detachment), '') = '' then
    return query select lower(v_faction ->> 'id'), v_faction ->> 'label', ''::text;
    return;
  end if;

  select d into v_det
    from jsonb_array_elements(v_faction -> 'detachmentOptions') d
   where lower(d ->> 'label') = lower(btrim(p_detachment))
      or lower(d ->> 'id') = lower(btrim(p_detachment));

  if v_det is null then raise exception 'RESULT_BAD_DETACHMENT'; end if;

  -- The detachment's own list, never the faction's. A disposition that belongs
  -- to another detachment is the one thing the pickers make unofferable, and
  -- this is what stops a hand-rolled PostgREST call doing it anyway.
  if coalesce(btrim(p_disposition), '') <> '' and not exists (
    select 1 from jsonb_array_elements_text(v_det -> 'dispositions') x
     where lower(x) = lower(btrim(p_disposition))) then
    raise exception 'RESULT_BAD_DISPOSITION';
  end if;

  return query select lower(v_faction ->> 'id'), v_faction ->> 'label',
                      v_det ->> 'label';
end $$;

/**
 * Write one side's army.
 *
 * Definer, and it does not decide who may call it: the four writers in 0136
 * each check their own permission first, because "may this person record this
 * result" is a different question per source and answering it here would be
 * answering it four times badly.
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
  v_detachment text := btrim(coalesce(p_army ->> 'detachment', ''));
  v_disposition text := btrim(coalesce(p_army ->> 'disposition', ''));
  v_primary integer := nullif(p_army ->> 'primaryScore', '')::integer;
  v_secondary integer := nullif(p_army ->> 'secondaryScore', '')::integer;
  v_units text[];
  v_under text[];
  v_named record;
begin
  -- Nothing said, nothing stored. A result with no army fields leaves no row
  -- rather than an empty one, so the meta rollups never count a blank.
  if v_faction = '' and v_primary is null and v_secondary is null then
    delete from public.game_result_armies
     where source_type = p_source and source_id = p_source_id and side = p_side;
    return null;
  end if;

  -- Refuses what is wrong and hands back the catalogue's own spelling of what
  -- is right, which is what the row stores.
  select * into v_named from public.resolve_result_army(
    p_edition, p_version, v_faction, v_detachment, v_disposition);

  if v_primary is not null and (v_primary < 0 or v_primary > 50) then
    raise exception 'RESULT_VP_RANGE';
  end if;
  if v_secondary is not null and (v_secondary < 0 or v_secondary > 40) then
    raise exception 'RESULT_VP_RANGE';
  end if;

  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}')
    into v_units
    from jsonb_array_elements_text(coalesce(p_army -> 'mvpUnits', '[]')) x;
  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}')
    into v_under
    from jsonb_array_elements_text(coalesce(p_army -> 'underwhelmingUnits', '[]')) x;

  insert into public.game_result_armies (
    source_type, source_id, side, club_id, played_on, profile_id, player_name,
    faction_id, faction_label, detachment, disposition,
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
    coalesce(nullif(v_named.detachment, ''), v_detachment),
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
        detachment = excluded.detachment, disposition = excluded.disposition,
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

/** What an army reads as on a result row, so a reader shows one string. */
create or replace function public.result_army_label(p_army jsonb)
returns text
language sql immutable as $$
  select nullif(btrim(concat_ws(' · ',
    nullif(btrim(coalesce(p_army ->> 'factionLabel', '')), ''),
    nullif(btrim(coalesce(p_army ->> 'detachment', '')), ''))), '');
$$;

revoke all on function public.resolve_result_army(text, text, text, text, text)
  from public, anon;
revoke all on function public.put_result_army(
  text, bigint, text, bigint, date, uuid, text, jsonb, text, text) from public, anon;
revoke all on function public.result_army_label(jsonb) from public, anon;
-- Neither of the first two is granted: they are what 0136's writers call after
-- they have checked who is asking, not doors of their own.
grant execute on function public.result_army_label(jsonb) to authenticated;
