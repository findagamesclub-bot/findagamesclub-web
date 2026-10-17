import "server-only";

import { callRpc } from "@/lib/supabase/table";

/**
 * The armies recorded against a draw.
 *
 * Its own file rather than more of `eventPairings.repository`, which was at
 * the size rule and is about who plays whom. Same split as the services above
 * it: one answers the draw, one answers what was played on it.
 */

/**
 * What was played on each table of a draw.
 *
 * `game_result_armies` is polymorphic (`source_type`, `source_id`), so there
 * is no foreign key for PostgREST to embed it through and the match ids have
 * to be in hand. One query for every table on the event, not one per round.
 */
export type PairingArmyRow = {
  source_id: number;
  side: string;
  faction_id: string;
  faction_label: string;
  detachment: string;
  disposition: string;
  list_id: number | null;
  list_name: string;
  list_version_number: number | null;
  /** The units as they were on the day, frozen by 0145. */
  snapshot: unknown;
  mvp_units: string[] | null;
  underwhelming_units: string[] | null;
  primary_score: number | null;
  secondary_score: number | null;
  painted: boolean;
  first_turn: string;
  battle_role: string;
  outcome: string;
  /** How the game was set up. On the match row since 0181, copied here. */
  mission: string;
  deployment: string;
  terrain: string;
};

/**
 * Every army on one event's draw, by the event rather than by a list of ids.
 *
 * It was a select over `game_result_armies` and needed six more columns, every
 * one of them added after `database.ts` was last generated, so `check:columns`
 * would have refused it and been right to. `event_pairing_armies` is the same
 * query with the match's setup joined on, which the select could not have
 * reached anyway: the setup lives on the game's own row.
 */
export const findPairingArmies = (eventId: number) =>
  callRpc<PairingArmyRow[]>("event_pairing_armies", { p_event: eventId });

/**
 * How every table of a draw was set up, read from the match rows (0200).
 *
 * `event_pairing_armies` carries the same three columns, but it selects FROM
 * `game_result_armies`, so a table with a mission typed and no army recorded
 * came back with nothing: `put_result_army` deletes a side that names no
 * faction, and the setup went with it on the way out.
 */
export type PairingSetupRow = {
  match_id: number; mission: string; deployment: string; terrain: string;
};

export const findPairingSetup = (eventId: number) =>
  callRpc<PairingSetupRow[]>("event_pairing_setup", { p_event: eventId });

/** Both armies on one table, and how the game was set up. */
export const savePairingArmies = (params: {
  matchId: number; armies: unknown;
  mission: string; deployment: string; terrain: string;
}) => callRpc<boolean>("save_pairing_armies", {
  p_match: params.matchId,
  p_armies: params.armies,
  p_mission: params.mission,
  p_deployment: params.deployment,
  p_terrain: params.terrain,
});
