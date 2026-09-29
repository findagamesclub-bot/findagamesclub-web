import "server-only";

import { findBuildersFor, findResultArmies }
  from "@/repositories/resultArmies.repository";
import { armyFromRow, EMPTY_ARMY, type ResultArmy } from "@/utils/result-army";

/** What a club records against, small enough to send to a browser. */
export type Builder = { editionId: string; catalogueVersion: string };

export type ResultArmies = { one: ResultArmy; two: ResultArmy };

export type ArmyContext = {
  /** The two sides of one game, in the source's own order. */
  sides(sourceId: number): ResultArmies;
  /** Null when that club does not run the army builder. */
  builder(clubId: number): Builder | null;
};

const NOTHING: ResultArmies = { one: EMPTY_ARMY, two: EMPTY_ARMY };

/**
 * For a list that cannot have an army yet.
 *
 * A table booked for next Thursday has no result, so there is nothing to read
 * and no reason to spend a round trip finding that out.
 */
export const NO_ARMIES: ArmyContext = {
  sides: () => NOTHING,
  builder: () => null,
};

/**
 * The armies behind a page of results, and which of their clubs record them.
 *
 * Two reads for a page however many games are on it, and one place that knows
 * how a row becomes a form. Three services want this — a member's own games,
 * one club's score list and the queue across every club somebody owns — and
 * three copies of the same two maps would have drifted.
 *
 * Neither read failing is a reason to show no games: an army that will not
 * load reads as a result nobody filled the army in on, and a club whose
 * settings will not load reads as one that does not run the builder.
 */
export async function getArmyContext(
  source: string, sourceIds: number[], clubIds: number[],
): Promise<ArmyContext> {
  const [armyRows, builderRows] = await Promise.all([
    findResultArmies(source, [...new Set(sourceIds)]).catch(() => []),
    findBuildersFor([...new Set(clubIds)]).catch(() => []),
  ]);

  const armies = new Map(armyRows.map((row) => [`${row.source_id}:${row.side}`, row]));
  const builders = new Map(builderRows
    .filter((row) => row.enabled && row.edition_id && row.catalogue_version)
    .map((row) => [row.club_id, {
      editionId: row.edition_id!, catalogueVersion: row.catalogue_version!,
    }]));

  return {
    sides: (sourceId) => armies.size === 0 ? NOTHING : {
      one: armyFromRow(armies.get(`${sourceId}:one`)),
      two: armyFromRow(armies.get(`${sourceId}:two`)),
    },
    builder: (clubId) => builders.get(clubId) ?? null,
  };
}
