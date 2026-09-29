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
             painted, first_turn, battle_role`)
    .eq("source_type", source)
    .in("source_id", ids);

  if (error) throw new Error(`Failed to load the armies: ${error.message}`);
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
