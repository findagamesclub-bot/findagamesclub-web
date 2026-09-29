import "server-only";

import * as repo from "@/repositories/armyCatalogue.repository";
import type { EditionRow } from "@/repositories/armyCatalogue.repository";
import { siftDetachments, siftFactions } from "@/utils/catalogue-filters";
import type { Catalogue } from "@/utils/army-catalogue";

export type { EditionRow, FactionRow, DetachmentRow, UnitRow }
  from "@/repositories/armyCatalogue.repository";

/** An edition, plus whether the version it is on has been frozen. */
export type PublishedEdition = EditionRow & { published: boolean };

export type Result = { ok: true; notice: string } | { ok: false; error: string };

/**
 * The refusals a screen shows, in its own words.
 *
 * The database raises these by name so nothing has to guess from a Postgres
 * error string, and an unmapped one would otherwise reach a toast as
 * "duplicate key value violates unique constraint".
 */
const REFUSALS: Record<string, string> = {
  NOT_PERMITTED: "Only a site admin can change the catalogue.",
  CATALOGUE_PUBLISHED:
    "That version is published, so it cannot be edited. Start a new draft first.",
  ALREADY_PUBLISHED: "That version has already been published.",
  EDITION_NOT_FOUND: "That edition is not here.",
  FACTION_NEEDS_LABEL: "Give the faction a name.",
  DETACHMENT_NEEDS_LABEL: "Give the detachment a name.",
  UNIT_NEEDS_NAME: "Give the unit a name.",
  UNIT_NEEDS_POINTS: "A unit costs more than nothing. Check the points.",
  VERSION_NEEDS_NAME: "Give the new draft a version.",
  army_units_one_name: "This faction already has a unit with that name.",
};

function explain(error: unknown, fallback: string): string {
  const said = error instanceof Error ? error.message : String(error);
  for (const [key, line] of Object.entries(REFUSALS)) {
    if (said.includes(key)) return line;
  }
  return fallback;
}

export const UNITS_PER_PAGE = 24;

/**
 * The editions, each saying whether the version it is on is frozen.
 *
 * `status === "active"` is not that question and the screens were asking it:
 * an edition stays active while a draft is open, so pressing "Start a new
 * draft" left the catalogue reading Published and frozen, with the New unit
 * and New detachment buttons hidden. The draft could not be edited from the
 * one screen that exists to edit it.
 */
export async function getEditions(): Promise<PublishedEdition[]> {
  const [editions, published] = await Promise.all([
    repo.findEditions().catch(() => []),
    repo.findPublishedVersions().catch(() => []),
  ]);

  const frozen = new Set(published.map(
    (one) => `${one.edition_id}:${one.catalogue_version}`));

  return editions.map((edition) => ({
    ...edition,
    published: frozen.has(`${edition.id}:${edition.catalogue_version}`),
  }));
}

export async function getActiveEdition() {
  return repo.findActiveEdition().catch(() => null);
}

/**
 * The 30 factions with their counts.
 *
 * One read. Thirty rows is not a thousand, and the counts ride along as
 * aggregates rather than as sixty round trips.
 */
export async function getFactions(edition: string, query = "") {
  const rows = await repo.findFactionsWithCounts(edition).catch(() => null);
  const all = (rows ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    position: row.position,
    detachments: row.army_detachments?.[0]?.count ?? 0,
    units: row.army_units?.[0]?.count ?? 0,
  }));

  return {
    rows: siftFactions(all, query),
    held: all.length,
    // A read that failed is not a catalogue with nothing in it.
    failed: rows === null,
  };
}

export async function getFactionDetail(
  edition: string, faction: string,
  filters: { query: string; page: number; view: "detachments" | "units" },
) {
  // Only the tab being looked at is read. Both used to load on every visit, so
  // opening the detachments of a faction with 88 units paged 88 rows out of
  // the database to draw nothing. The counts on the tabs come from
  // `getFactions`, which the page already has.
  const wantUnits = filters.view === "units";

  const [all, units] = await Promise.all([
    wantUnits ? Promise.resolve([]) : repo.findDetachments(edition, faction).catch(() => []),
    wantUnits
      ? repo.findUnitsPage({
          edition, faction, query: filters.query,
          limit: UNITS_PER_PAGE, offset: (filters.page - 1) * UNITS_PER_PAGE,
        }).catch(() => null)
      : Promise.resolve({ rows: [], total: 0 }),
  ]);

  // A handful of rows the page already has, so this sifts rather than asking
  // again. The units are the thousand-row case and narrow in SQL.
  const detachments = siftDetachments(all, filters.query);

  return {
    detachments,
    detachmentsHeld: all.length,
    units: units?.rows ?? [],
    total: units?.total ?? 0,
    page: filters.page,
    perPage: UNITS_PER_PAGE,
    failed: units === null,
  };
}

/** A published snapshot, in legacy's own shape. */
export async function getSnapshot(
  edition: string, version: string,
): Promise<Catalogue | null> {
  return repo.findSnapshot(edition, version)
    .then((one) => (one as Catalogue | null))
    .catch(() => null);
}

export async function saveFaction(params: {
  edition: string; id: string; label: string; position: number;
}): Promise<Result> {
  try {
    await repo.saveFaction(params);
    return { ok: true, notice: "Faction saved." };
  } catch (error) {
    return { ok: false, error: explain(error, "That faction did not save.") };
  }
}

export async function saveDetachment(params: {
  edition: string; faction: string; slug: string; label: string;
  dispositions: string[]; position: number;
}): Promise<Result> {
  try {
    await repo.saveDetachment(params);
    return { ok: true, notice: "Detachment saved." };
  } catch (error) {
    return { ok: false, error: explain(error, "That detachment did not save.") };
  }
}

export async function saveUnit(params: {
  edition: string; faction: string; name: string; points: number;
  options: unknown[]; rules: unknown[]; position: number;
}): Promise<Result> {
  // Checked here as well as in SQL, so the refusal names the field rather than
  // arriving as a constraint violation. `Number("")` is 0, which is how a
  // listing price shipped as free in stage 5.
  if (!Number.isInteger(params.points) || params.points <= 0) {
    return { ok: false, error: REFUSALS.UNIT_NEEDS_POINTS! };
  }
  try {
    await repo.saveUnit(params);
    return { ok: true, notice: "Unit saved." };
  } catch (error) {
    return { ok: false, error: explain(error, "That unit did not save.") };
  }
}

export async function removeUnit(edition: string, unit: number): Promise<Result> {
  try {
    await repo.deleteUnit(edition, unit);
    return { ok: true, notice: "Unit removed." };
  } catch (error) {
    return { ok: false, error: explain(error, "That unit could not be removed.") };
  }
}

export async function publish(edition: string, note: string): Promise<Result> {
  try {
    const version = await repo.publishCatalogue(edition, note);
    return { ok: true, notice: `Published ${version}. It is frozen now.` };
  } catch (error) {
    return { ok: false, error: explain(error, "That version did not publish.") };
  }
}

export async function newDraft(edition: string, version: string): Promise<Result> {
  try {
    await repo.startDraft(edition, version.trim());
    return { ok: true, notice: `Editing ${version.trim()}.` };
  } catch (error) {
    return { ok: false, error: explain(error, "That draft could not be started.") };
  }
}
