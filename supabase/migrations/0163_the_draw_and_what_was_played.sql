-- The draw's audience, and the club naming which list somebody brought.
--
-- Three revision items, and two of them needed no migration at all:
--
--   11a, editing a notice: 0090 already grants `update (message)` on
--        `club_event_notices` and its policy is `for all`. The capability has
--        been there since the editor shipped; nothing on the screen reached it.
--   14a, the faction missing from event analytics: `meta_event` has always
--        returned `faction_label`. The card threw it away.
--
-- What is here is the rest:
--
--   8a  `draw_public`, so a club running an open event can put the draw on the
--       page for everybody rather than only for the people holding a ticket.
--   9a  the outcome on a table of a draw. 0136 could already record the armies
--       and 0141 only ever wired an outcome for a booking, so a tournament's
--       armies would have filed with nothing to count them: every one of them
--       would have read "no rate yet" however many rounds were scored.
--   10a `club_set_result_list`, so the club recording a tournament can say
--       which of a player's own lists they brought.
--
-- Checked on a throwaway Postgres built from every migration: a stranger
-- cannot flip the switch or name a list, the club can, a list belonging to
-- somebody else is refused, a list from another club is refused, clearing one
-- empties both the row and the podium's jsonb, the podium's snapshot comes
-- back in the shape the event page has always read, and a table scored 80 to
-- 60 reads as a win for one side and a loss for the other whichever order the
-- scores and the armies were typed in.

-- ------------------------------------------------------- 8a · who sees a draw

/**
 * Who a published round is for.
 *
 * The gate has never been membership: `canSeePrivate` is a ticket or the
 * club's own team, so somebody who booked a place without joining has always
 * seen the draw. What the client asked for is the case underneath that
 * sentence, an event sold to the open street where the draw belongs on the
 * page beside the standings.
 *
 * False by default, which is the behaviour every event has today. A round
 * still has to be published first: this says who a published round reaches,
 * never that an unfinished one leaks.
 */
alter table public.club_events
  add column if not exists draw_public boolean not null default false;

comment on column public.club_events.draw_public is
  'A published round is readable by anybody, not only by ticket holders.';

grant insert (draw_public), update (draw_public)
  on public.club_events to authenticated;

/**
 * The flag on its own, for the public page.
 *
 * `src/types/database.ts` has not been regenerated since 0151, and
 * `npm run check:columns` is right to refuse a select naming a column the
 * schema it knows about does not have. Reading one boolean through a function
 * is the standing answer to that; delete this and select the column once the
 * types catch up.
 *
 * Granted to `anon` because it answers "may I see this", not "here it is".
 * The rows themselves are still governed by 0091's policies, and so is the
 * event: this carries no clause about a draft, because the club's own console
 * has to read its own setting back and 0090 already decides who may open a
 * draft event at all.
 */
create or replace function public.event_draw_public(p_event bigint)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(e.draw_public, false)
    from public.club_events e
   where e.id = p_event;
$$;

revoke all on function public.event_draw_public(bigint) from public;
grant execute on function public.event_draw_public(bigint) to anon, authenticated;

/**
 * Whether a round has been published at all, without reading one.
 *
 * So the event page can say "the draw is for people who are coming" rather
 * than rendering nothing, which is what a visitor without a ticket got: a
 * section that simply was not there, and no way to learn that booking opens
 * it. Same call the noticeboard already makes.
 */
create or replace function public.event_has_draw(p_event bigint)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.club_event_pairings p
                  where p.event_id = p_event and p.published);
$$;

revoke all on function public.event_has_draw(bigint) from public;
grant execute on function public.event_has_draw(bigint) to anon, authenticated;

-- ------------------------------------------------- 10a · the list they brought

/**
 * The club naming which of a player's own lists they played.
 *
 * `link_result_army_list` (0145) is the member's own door and stays exactly as
 * it is: "a club recording a night should not be able to say which list
 * somebody else brought" is the right rule for a club night, where the only
 * person who knows is the person who built it.
 *
 * A tournament is the case that rule was not written for. The organiser is
 * handed every list before round one, types the podium up off a printed sheet
 * afterwards, and the player is usually long gone. So this is the same job
 * with a different answer to "who may", which is why it is its own function
 * rather than another argument on that one: 0136 makes the same split four
 * ways for the same reason.
 *
 * Two things it will not do. Event sources only, so a club night is untouched.
 * And only a list belonging to the person the row is already filed under: the
 * club says which list, never whose.
 */
create or replace function public.club_set_result_list(
  p_source text, p_source_id bigint, p_side text, p_list bigint
) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  v_row public.game_result_armies%rowtype;
  v_list public.army_lists%rowtype;
  v_version public.army_list_versions%rowtype;
  v_army jsonb;
begin
  if p_source not in ('event_podium', 'event_pairing') then
    raise exception 'RESULT_NOT_FOUND';
  end if;

  select * into v_row from public.game_result_armies
   where source_type = p_source and source_id = p_source_id and side = p_side;
  -- The army row is what a list hangs off, so a result nobody has named a
  -- faction on has nothing to attach one to yet.
  if v_row.id is null then raise exception 'RESULT_NOT_FOUND'; end if;

  -- `club_can` is false for a site admin with no team row, which is the clause
  -- every function guarded by it has needed since 0128.
  if not (public.club_can(v_row.club_id, 'events.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if p_list is null then
    update public.game_result_armies
       set list_id = null, list_version_id = null, list_name = '',
           list_version_number = null, snapshot = '{}'::jsonb
     where id = v_row.id;

    if p_source = 'event_podium' then
      update public.club_event_results
         set army = coalesce(army, '{}'::jsonb)
                      - 'armyListId' - 'armyListName' - 'armyListVersionSnapshot'
       where id = p_source_id;
    end if;
    return;
  end if;

  select * into v_list from public.army_lists
   where id = p_list and deleted_at is null;
  if v_list.id is null then raise exception 'ARMY_LIST_NOT_FOUND'; end if;
  if v_list.club_id <> v_row.club_id then raise exception 'ARMY_WRONG_CLUB'; end if;
  -- Whose list it is, not whose it might have been. A free-text name on a
  -- placing has no account behind it and therefore no list to pick from.
  if v_row.profile_id is null or v_list.profile_id <> v_row.profile_id then
    raise exception 'ARMY_NOT_THEIRS';
  end if;

  select * into v_version from public.army_list_versions
   where id = v_list.current_version_id;
  if v_version.id is null then raise exception 'ARMY_LIST_NOT_FOUND'; end if;

  update public.game_result_armies
     set list_id = v_list.id,
         list_version_id = v_version.id,
         list_name = left(v_list.name, 200),
         list_version_number = v_version.version_number,
         -- Frozen, so a later edit to the list does not rewrite history. Same
         -- shape 0145 writes, because the tracker reads both the same way.
         snapshot = jsonb_build_object(
           'units', v_version.units,
           'detachments', v_version.detachment_selections,
           'totalPoints', v_version.total_points,
           'catalogueVersion', v_version.catalogue_version)
   where id = v_row.id;

  -- And into the placing's own jsonb, in legacy's key names. The event page
  -- has read `armyListVersionSnapshot` since Milestone 2 and nothing has ever
  -- written it: the unit-by-unit list on a podium card is a reader that has
  -- been waiting for a writer.
  if p_source = 'event_podium' then
    select coalesce(r.army, '{}'::jsonb) into v_army
      from public.club_event_results r where r.id = p_source_id;
    if v_army is null then raise exception 'PLACING_NOT_FOUND'; end if;

    update public.club_event_results
       set army = v_army || jsonb_build_object(
             -- The id as well as the name, so the editor can open with the
             -- right one chosen rather than matching on a string somebody is
             -- free to reuse.
             'armyListId', v_list.id,
             'armyListName', v_list.name,
             'armyListVersionSnapshot', jsonb_build_object(
               'pointsLimit', v_version.points_limit,
               'totalPoints', v_version.total_points,
               'versionNumber', v_version.version_number,
               'catalogueVersion', v_version.catalogue_version,
               'units', v_version.units))
     where id = p_source_id;
  end if;
end $$;

revoke all on function public.club_set_result_list(text, bigint, text, bigint)
  from public, anon;
grant execute on function public.club_set_result_list(text, bigint, text, bigint)
  to authenticated;

/**
 * The lists built at one club, for the picker on an event's results.
 *
 * `army_lists_select` already admits the club's team, so this could have been
 * a select. It is a function for the reason above: `check:columns` cannot know
 * about a column until the types are regenerated, and this read wants the
 * current version's faction and detachment so that naming a list can fill the
 * rest of the form in.
 *
 * Every list at the club rather than the ones belonging to the names already
 * on the sheet, because a club typing the podium up picks the member and the
 * list in the same dialog and the picker has to have them in hand. Capped at
 * 500 the same way `findClubLists` is, which is the club's own lists and not a
 * number a tournament can push.
 */
create or replace function public.club_member_lists(
  p_club bigint, p_profiles uuid[] default null
)
returns table (
  id bigint, profile_id uuid, name text, list_type text,
  faction_id text, faction_label text, detachment text, disposition text,
  total_points integer, points_limit text, version_number integer
)
language sql stable security definer set search_path = public as $$
  select l.id, l.profile_id, l.name, l.list_type,
         v.faction_id, v.faction_label,
         btrim(coalesce(v.detachment_selections -> 0 ->> 'detachment', '')),
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

-- ------------------------------- 9a · a table of the draw carries its outcome

/**
 * How each side of a table went, from the scores the club typed.
 *
 * 0141 wired this for a booking and stopped there, which was right at the
 * time: nothing could record an army against a table of a draw, so there was
 * no row to put an outcome on. 9a is the screen that changes it, and without
 * this every army recorded at a tournament would read "no rate yet" however
 * many rounds were scored. The client's own words were "this will be required
 * for full analytics", so a screen that files armies nothing can count would
 * have answered half the request.
 *
 * `booking_outcome` already turns a side and a pair of scores into won, lost
 * or drew, and a table stores its two in the same order, so there is one
 * implementation rather than two that agree on the day they are written.
 *
 * A trigger for the reason 0141 gives: the scores move from the round's own
 * dialog today and the armies are typed afterwards, so a service hook would
 * have to be remembered in both places.
 */
create or replace function public.pairing_result_meta()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.game_result_armies a
     set outcome = public.booking_outcome(a.side, new.score_one, new.score_two)
   where a.source_type = 'event_pairing' and a.source_id = new.id;
  return new;
end $$;

drop trigger if exists pairing_result_meta on public.club_event_pairing_matches;
create trigger pairing_result_meta
  after insert or update of score_one, score_two
  on public.club_event_pairing_matches
  for each row execute function public.pairing_result_meta();

revoke all on function public.pairing_result_meta() from public, anon;

/**
 * And the other order: armies typed after the scores.
 *
 * `save_pairing_armies` writes the row through `put_result_army`, which knows
 * nothing about the table it came from, so the outcome is stamped on here
 * rather than inside the shared writer. Same split 0136 already makes about
 * permission.
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

  -- The table may already have been played. Without this an army typed after
  -- the scores never gains an outcome and the event's win rates stay empty.
  update public.game_result_armies a
     set outcome = public.booking_outcome(a.side, v_match.score_one, v_match.score_two)
   where a.source_type = 'event_pairing' and a.source_id = p_match;

  return true;
end $$;

revoke all on function public.save_pairing_armies(bigint, jsonb) from public, anon;
grant execute on function public.save_pairing_armies(bigint, jsonb) to authenticated;

-- Tables already scored, brought up to date in one pass. There are none in the
-- dev data: nothing has ever been able to record an army against a draw.
update public.game_result_armies a
   set outcome = public.booking_outcome(a.side, m.score_one, m.score_two)
  from public.club_event_pairing_matches m
 where a.source_type = 'event_pairing' and a.source_id = m.id;
