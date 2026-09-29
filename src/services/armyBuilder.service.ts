import "server-only";

import * as repo from "@/repositories/armyCatalogue.repository";
import { getSnapshot } from "./armyCatalogue.service";
import type { Catalogue } from "@/utils/army-catalogue";

export type Result = { ok: true; notice: string } | { ok: false; error: string };

const NOT_PERMITTED =
  "Only the club's owner or a manager can turn the army builder on.";

/**
 * Whether a club runs the army builder, and what it records against.
 *
 * Its own file rather than more of `armyCatalogue.service`, because they are
 * two subjects: that one is a site admin maintaining a catalogue, this is one
 * club deciding whether its members see army fields at all. It also took that
 * file past the 200-line rule.
 */

/** What a club records against, with the defaults filled in. */
export async function getBuilderFor(club: number) {
  const rows = await repo.findBuilderFor(club).catch(() => []);
  const row = rows?.[0];
  return {
    enabled: Boolean(row?.enabled),
    editionId: row?.edition_id ?? null,
    catalogueVersion: row?.catalogue_version ?? null,
  };
}

/**
 * The catalogue a club records against, ready to read.
 *
 * Null when the club does not run the builder, which is what every screen
 * checks before drawing an army field. A club that plays board games sees
 * exactly the dialog it saw before any of this existed.
 */
export async function getClubCatalogue(club: number): Promise<Catalogue | null> {
  const builder = await getBuilderFor(club);
  if (!builder.enabled || !builder.editionId || !builder.catalogueVersion) return null;
  return getSnapshot(builder.editionId, builder.catalogueVersion);
}

export async function setBuilder(
  club: number, enabled: boolean, edition: string | null,
): Promise<Result> {
  try {
    await repo.saveBuilderSettings(club, enabled, edition);
    return {
      ok: true,
      notice: enabled
        ? "The army builder is on. Results at this club can carry an army now."
        : "The army builder is off.",
    };
  } catch (error) {
    const said = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: said.includes("NOT_PERMITTED") ? NOT_PERMITTED : "That did not save.",
    };
  }
}
