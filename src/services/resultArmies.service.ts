import "server-only";

import {
  findBuildersFor, findMemberLists, findResultArmies, setResultList as writeList,
} from "@/repositories/resultArmies.repository";
import { armyRefusalFrom } from "./armyRefusals";
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

/**
 * One of a member's lists, small enough to put in a picker.
 *
 * The faction and detachment ride along so that choosing a list fills the rest
 * of the form in: a club typing up a podium should not have to pick Adeptus
 * Custodes a second time after saying which Custodes list it was.
 */
export type MemberList = {
  id: number;
  profileId: string;
  name: string;
  factionId: string;
  faction: string;
  detachment: string;
  disposition: string;
  points: number | null;
  version: number | null;
};

/**
 * Every list built at one club, for the pickers on its event results.
 *
 * One read for the whole screen rather than one per player: a fifty-player
 * tournament is fifty podium rows and fifty round trips would be a page that
 * never finishes. The screen narrows each picker to the person that side of
 * the result is filed under, and the database refuses anything else anyway.
 *
 * Empty rather than refused for somebody who cannot manage the club, which is
 * what keeps this safe to call from a page the whole internet can open.
 */
export async function getMemberLists(clubId: number): Promise<MemberList[]> {
  const rows = await findMemberLists(clubId).catch(() => []);
  return rows.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    factionId: row.faction_id,
    faction: row.faction_label || row.faction_id,
    detachment: row.detachment,
    disposition: row.disposition,
    points: row.total_points,
    version: row.version_number,
  }));
}

/** The club naming which list was brought, or taking the naming back. */
export async function setResultList(
  source: "event_podium" | "event_pairing" | "competition_match",
  sourceId: number, side: "one" | "two", listId: number | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await writeList(source, sourceId, side, listId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: armyRefusalFrom(error) };
  }
}
