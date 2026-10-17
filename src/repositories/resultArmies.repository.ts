import "server-only";

import { callRpc, table } from "@/lib/supabase/table";

/**
 * The armies behind a result, and which clubs record them.
 *
 * Its own file rather than more of `games.repository`: that one is already at
 * the size rule, and these two reads serve every source of a result, not only
 * a member's own table bookings.
 */

/**
 * One row per side per game, for the games already on the page.
 *
 * Read by the booking ids in hand rather than by member: `game_result_armies`
 * is polymorphic (`source_type`, `source_id`), so PostgREST has no foreign key
 * to embed it through, and RLS already decides which of them this reader may
 * see.
 */
export type ResultArmyRow = {
  source_id: number;
  side: string;
  list_id: number | null;
  list_name: string;
  faction_id: string;
  faction_label: string;
  detachment: string;
  disposition: string;
  mvp_units: string[] | null;
  underwhelming_units: string[] | null;
  primary_score: number | null;
  secondary_score: number | null;
  painted: boolean;
  first_turn: string;
  battle_role: string;
};

export async function findResultArmies(source: string, ids: number[]) {
  if (!ids.length) return [];
  const rows = await table<ResultArmyRow>("game_result_armies");
  const { data, error } = await rows
    .select(`source_id, side, faction_id, faction_label, detachment, disposition,
             mvp_units, underwhelming_units, primary_score, secondary_score,
             painted, first_turn, battle_role, list_id, list_name`)
    .eq("source_type", source)
    .in("source_id", ids);

  if (error) throw new Error(`Failed to load the armies: ${error.message}`);
  return data ?? [];
}

/**
 * Both sides of a set of games, whatever kind of game they were.
 *
 * `findResultArmies` answers one source type at a time, which is right for a
 * page about one kind of result. A member's record is not that: a club night
 * and a league round sit in the same list, so asking twice would be two round
 * trips to draw one page.
 *
 * `source_type` comes back and is part of the key, so the deliberately wide
 * `in` on the ids cannot cross a booking with a competition game that happens
 * to share a number. The setup rides along on the row: 0181 mirrors the
 * game's own mission, deployment and terrain onto both army rows, so a reader
 * needs no second read to say how a table was laid out.
 */
export type GameArmyRow = ResultArmyRow & {
  source_type: string;
  profile_id: string | null;
  player_name: string;
  mission: string;
  deployment: string;
  terrain: string;
  list_id: number | null;
  list_name: string;
  list_version_number: number | null;
  snapshot: unknown;
};

export async function findGameArmies(sources: string[], ids: number[]) {
  if (!sources.length || !ids.length) return [];
  const rows = await table<GameArmyRow>("game_result_armies");
  const { data, error } = await rows
    .select(`source_type, source_id, side, faction_id, faction_label, detachment,
             disposition, mvp_units, underwhelming_units, primary_score,
             secondary_score, painted, first_turn, battle_role,
             mission, deployment, terrain, profile_id, player_name,
             list_id, list_name, list_version_number, snapshot`)
    .in("source_type", [...new Set(sources)])
    .in("source_id", [...new Set(ids)]);

  if (error) throw new Error(`Failed to load the games: ${error.message}`);
  return data ?? [];
}

/** Which of these clubs run the army builder, and what against. */
export type BuilderRow = {
  club_id: number;
  enabled: boolean;
  edition_id: string | null;
  catalogue_version: string | null;
};

export const findBuildersFor = (clubs: number[]) =>
  clubs.length
    ? callRpc<BuilderRow[]>("army_builders_for", { p_clubs: clubs })
    : Promise.resolve([]);

/**
 * Every list the people on one event's results have built at this club.
 *
 * Through a function because the picker wants the current version's faction
 * and detachment so that choosing a list can fill the rest of the form in, and
 * `army_list_versions` is newer than the generated types. The function also
 * carries the guard: a club's own team, nobody else.
 */
export type MemberListRow = {
  id: number;
  profile_id: string;
  name: string;
  list_type: string;
  faction_id: string;
  faction_label: string;
  detachment: string;
  disposition: string;
  total_points: number | null;
  points_limit: string | null;
  version_number: number | null;
};

export const findMemberLists = (club: number, profiles?: string[]) =>
  callRpc<MemberListRow[]>("club_member_lists",
    { p_club: club, p_profiles: profiles ?? null });

/**
 * The club saying which of a player's own lists they brought.
 *
 * Event sources only, and `link_result_army_list` (0145) stays the member's
 * own door for a club night. Null takes the link off.
 */
export const setResultList = (
  source: string, sourceId: number, side: string, list: number | null,
) =>
  callRpc<void>("club_set_result_list",
    { p_source: source, p_source_id: sourceId, p_side: side, p_list: list });

/**
 * A member saying which of their own lists they brought.
 *
 * 0145's own door, and until now it had no caller at all: the function, its
 * grant and its guards all shipped with stage 10 and nothing above SQL ever
 * reached them. It refuses anybody but the owner of that side, which is why
 * the club's booking dialog does not get a picker and says so instead.
 */
export const linkMyResultList = (
  source: string, sourceId: number, side: string, list: number | null,
) =>
  callRpc<void>("link_result_army_list",
    { p_source: source, p_source_id: sourceId, p_side: side, p_list: list });
