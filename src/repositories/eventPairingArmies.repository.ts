import "server-only";

import { callRpc, table } from "@/lib/supabase/table";

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
};

export async function findPairingArmies(matchIds: number[]) {
  if (!matchIds.length) return [];
  const rows = await table<PairingArmyRow>("game_result_armies");
  const { data, error } = await rows
    .select(`source_id, side, faction_id, faction_label, detachment, disposition,
             list_id, list_name`)
    .eq("source_type", "event_pairing")
    .in("source_id", matchIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Both armies on one table, through the writer 0136 built and 0163 finished. */
export const savePairingArmies = (matchId: number, armies: unknown) =>
  callRpc<boolean>("save_pairing_armies", { p_match: matchId, p_armies: armies });
