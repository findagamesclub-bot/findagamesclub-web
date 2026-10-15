-- 0194 · The army list on a league table row
--
-- The client: "Army faction, list and disposition shown against club
-- competitions and leagues, so you can see what each member is playing in that
-- competition."
--
-- **Two of the three were already there and the third says so in a comment.**
-- `CompetitionStandings` has drawn the faction with the detachment and
-- disposition under it since 0136, and `CompetitionStanding` in
-- `src/types/competition.ts` carries the line that explains the gap: "The link
-- to a stored army list is stage 10." Stage 10 came and went (0143 to 0145)
-- and the link was built for everything except this. The scoreboard after it:
--
--   | where                   | faction | detachment | disposition | list |
--   | league round game  0181 |    y    |     y      |      y      |   y  |
--   | event placing      0163 |    y    |     y      |      y      |   y  |
--   | event draw table   0163 |    y    |     y      |      y      |   y  |
--   | LEAGUE STANDING         |    y    |     y      |      y      |   n  |
--
-- Twelfth time a reader has been waiting for a writer.
--
-- **The list goes on the standing, not through `club_set_result_list`.** That
-- function takes a source and a row id, which a standing does not reliably
-- have: `replaceStandings` deletes the competition's rows and inserts them
-- again on every save, which is the whole reason 0136 made this a trigger
-- rather than a function the app calls. 0136's own comment says so. Carrying
-- the list as a column on the row the club is already saving sidesteps the id
-- question completely: the id can change on every save and the list still
-- lands, because it travels with the row rather than being written against it
-- afterwards.
--
-- Checked on a throwaway Postgres built from every migration: the list reaches
-- the Meta Tracker's own row, a list belonging to somebody else is refused by
-- name, a list from another club is refused, naming a list with no faction
-- typed fills the faction in from the list, clearing the list empties the four
-- columns without touching the faction, and deleting the list leaves the
-- standing and the recorded game alone.

alter table public.club_competition_standings
  add column if not exists army_list_id bigint
    references public.army_lists (id) on delete set null;

comment on column public.club_competition_standings.army_list_id is
  'Which of the member''s own lists this row was played with. The mirror into '
  'game_result_armies is what every reader actually uses.';

-- `on delete set null` rather than cascade or restrict. A list is soft-deleted
-- (0144) so this almost never fires, and if a row ever is removed for real the
-- standing is still a true record of a season: it loses the link and keeps the
-- faction, which is exactly what the frozen snapshot on the army row is for.

grant insert (army_list_id), update (army_list_id)
  on public.club_competition_standings to authenticated;

/**
 * A standing mirrors itself into the one table stage 9 reads, now with its
 * list.
 *
 * 0136's function with two things added, and the order of them matters.
 *
 * **The list is resolved before `put_result_army`, not after.** That function
 * deletes the army row outright when the army is empty, which is right and is
 * why a club that types nothing leaves nothing for the rollups to count. So a
 * row naming a list and no faction would have had its row deleted and then
 * had a list written onto nothing. Reading the faction out of the list first
 * means naming a list is enough on its own, which is also what 0163 decided
 * for a placing: a list already says all three, and typing them again is two
 * chances to disagree with it.
 *
 * **The guards raise.** A bad list takes the whole table save down with it,
 * which is what 0137 already settled for a faction the catalogue does not
 * hold: the club is told which row, and a table that half saved is worse than
 * one that did not. The service turns the code into a sentence.
 */
create or replace function public.competition_standing_army()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_club bigint;
  v_cat record;
  v_list public.army_lists%rowtype;
  v_version public.army_list_versions%rowtype;
  v_faction text;
  v_detachment text;
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
  v_detachment  := btrim(coalesce(new.detachment, ''));
  v_disposition := btrim(coalesce(new.disposition, ''));

  -- 0140's wrapper, kept. The table is saved whole, so one bad row refuses
  -- twenty, and the code alone ("RESULT_BAD_FACTION") gave a club no way to
  -- tell WHICH row. Everything that can refuse goes inside it, including the
  -- list guards added here: a league table with a mis-named list has exactly
  -- the same problem as one with a mis-typed faction.
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
      if v_detachment = '' then
        v_detachment := btrim(coalesce(
          v_version.detachment_selections -> 0 ->> 'detachment', ''));
        -- The disposition rides with the detachment it came from. Taking one
        -- from the list and leaving the other typed would pair a disposition
        -- with a detachment it does not belong to, which is the one rule the
        -- whole catalogue is shaped around.
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
        -- The typed spelling, NOT lowercased, and that is a fix rather than a
        -- tidy. `put_result_army` hands this to `resolve_result_army`, which
        -- with a catalogue pinned matches case-insensitively and answers in
        -- the catalogue's own spelling, and with none answers with the string
        -- it was given. 0136 lowercased it here, so every club running a
        -- league with the army builder OFF has been filing "adeptus custodes"
        -- into the table the Meta Tracker reads: the `faction_label` it
        -- returns wins the coalesce over the properly-cased one passed beside
        -- it. The standings table itself kept the right case, so the league
        -- table on screen looked fine and only the tracker was shouting.
        'factionId', v_faction,
        'factionLabel', v_faction,
        'detachment', v_detachment,
        'disposition', v_disposition),
      v_cat.edition_id, v_cat.catalogue_version);

    -- The list columns, onto the row that now exists. Frozen, so a later edit
    -- to the list does not rewrite what a season was played with: the same
    -- shape 0145 and 0163 both write, because the tracker reads all three the
    -- same way.
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
      -- inside `put_result_army` does not: it names the faction columns and
      -- 0145's list columns are not among them, so a cleared link would have
      -- gone on naming a list the club had just removed. The faction is
      -- deliberately left where it is, because the club typed that and nobody
      -- asked for it to go.
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

/**
 * The lists named on one competition's table, for the screen that draws it.
 *
 * A read rather than four more columns on the standings select, because
 * `src/types/database.ts` has not been regenerated and `check:columns` is
 * right to refuse a select naming a column its schema has never heard of. The
 * same answer `club_tier_requests` and `my_coaching_bookings` already give.
 *
 * It takes an ARRAY of competitions rather than one, because the club page
 * draws three league tables and the results page draws six: one read per
 * competition would be three round trips for a page whose whole budget is
 * counted in waves. One row per standing that names a list, so a club where
 * nobody has is one trip returning nothing rather than a join every reader
 * pays for.
 *
 * `security invoker`: `game_result_armies` already says who may read a
 * competition's armies (0135 lists `competition` as public), and a definer
 * here would be a second copy of that rule to get wrong.
 */
create or replace function public.competition_standing_lists(
  p_competitions bigint[]
)
returns table (
  competition_id bigint,
  standing_id bigint,
  list_id bigint,
  list_name text,
  list_version_number integer,
  snapshot jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select s.competition_id, a.source_id, a.list_id, a.list_name,
         a.list_version_number, a.snapshot
    from public.game_result_armies a
    join public.club_competition_standings s on s.id = a.source_id
   where a.source_type = 'competition'
     and a.list_id is not null
     and s.competition_id = any(coalesce(p_competitions, '{}'::bigint[]));
$$;

revoke all on function public.competition_standing_lists(bigint[]) from public;
grant execute on function public.competition_standing_lists(bigint[])
  to anon, authenticated;
