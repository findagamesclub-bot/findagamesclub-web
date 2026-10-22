import type { PricedUnit } from "./army-pricing";

/**
 * Reading a published catalogue snapshot.
 *
 * The snapshot is legacy's own shape, so this is the one place that knows it
 * and every screen asks these functions rather than reaching into jsonb.
 *
 * The rule that matters: **a disposition belongs to a detachment, not to a
 * faction.** The legacy manifest says so in its own words, and it is what
 * makes a disposition from another detachment unofferable rather than merely
 * refused.
 */

export type CatalogueDetachment = {
  id: string;
  label: string;
  dispositions: string[];
};

export type CatalogueFaction = {
  id: string;
  label: string;
  detachmentOptions: CatalogueDetachment[];
  units: { name: string; points: string; options?: unknown[]; copyCostRules?: unknown[] }[];
};

export type Catalogue = {
  editionId: string;
  catalogueVersion: string;
  systems: {
    id: string;
    label: string;
    pointsOptions: string[];
    factions: CatalogueFaction[];
  }[];
};

const fold = (value: string) => value.trim().toLowerCase();

export function factionsIn(catalogue: Catalogue | null): CatalogueFaction[] {
  return catalogue?.systems?.[0]?.factions ?? [];
}

export function pointsOptionsIn(catalogue: Catalogue | null): number[] {
  return (catalogue?.systems?.[0]?.pointsOptions ?? [])
    .map((one) => Number(String(one).trim()))
    .filter((one) => Number.isFinite(one) && one > 0);
}

/**
 * A faction by its id or by its label.
 *
 * Both, because a picker holds the id and a league table has held a typed
 * label since 0024. `resolve_result_army` matches the same two ways, and a
 * reader that only knew ids would draw an empty detachment list for a row the
 * database is perfectly happy with.
 */
export function findFaction(
  catalogue: Catalogue | null, faction: string,
): CatalogueFaction | null {
  if (!faction.trim()) return null;
  return factionsIn(catalogue).find(
    (one) => fold(one.id) === fold(faction) || fold(one.label) === fold(faction)) ?? null;
}

/** A faction's detachments. Empty for a faction nobody chose. */
export function detachmentsFor(
  catalogue: Catalogue | null, factionId: string,
): CatalogueDetachment[] {
  return findFaction(catalogue, factionId)?.detachmentOptions ?? [];
}

/**
 * The dispositions a detachment offers, and only that detachment's.
 *
 * Matched on the label or the id, because a result stores the label and a
 * picker works in ids.
 */
export function dispositionsFor(
  catalogue: Catalogue | null, factionId: string, detachment: string,
): string[] {
  if (!detachment.trim()) return [];
  const found = detachmentsFor(catalogue, factionId).find(
    (one) => fold(one.label) === fold(detachment) || fold(one.id) === fold(detachment));
  return found?.dispositions ?? [];
}

/**
 * The dispositions several detachments have between them.
 *
 * The client's words: *"Only one disposition should be selected overall, but
 * multiple detachments can be selected ... the options are based on what
 * dispositions are associated to the selected detachments."*
 *
 * A union, not an intersection. A disposition one of the chosen detachments
 * can play is a disposition the army can play, and narrowing to what they ALL
 * share would hide a legal choice the moment somebody added a second
 * detachment. Since 0193 every detachment in the live catalogue carries the
 * same five, so the two only differ on a catalogue somebody has edited by
 * hand; the union is the one that is right either way.
 *
 * In the order the catalogue gives them, deduplicated on the fold, because
 * the same disposition under two detachments is one option.
 */
export function dispositionsForAll(
  catalogue: Catalogue | null, factionId: string, detachments: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const detachment of detachments) {
    for (const one of dispositionsFor(catalogue, factionId, detachment)) {
      const key = fold(one);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(one);
    }
  }
  return out;
}

/** A faction's units, priced, for the MVP pickers and the builder. */
export function unitsFor(
  catalogue: Catalogue | null, factionId: string,
): PricedUnit[] {
  return (findFaction(catalogue, factionId)?.units ?? []).map((unit) => ({
    name: unit.name,
    basePoints: Number(String(unit.points ?? "").trim()) || 0,
    options: (unit.options ?? []) as PricedUnit["options"],
    copyCostRules: (unit.copyCostRules ?? []) as PricedUnit["copyCostRules"],
  }));
}

/**
 * A unit the game has retired but still prints rules for.
 *
 * Legacy marks them in the name and offers a checkbox to hide them
 * (`army-builder.js:1334`), which matters because a faction can carry thirty
 * of them and most players never field one. The match is on the name because
 * that is where the catalogue puts it; there is no flag to read.
 */
export function isLegends(unitName: string): boolean {
  return /\(legends\)/i.test(unitName ?? "");
}

/** Is this combination one the catalogue actually offers? Mirrors `resolve_result_army`. */
export function isOfferable(
  catalogue: Catalogue | null,
  army: { factionId: string; detachment: string; disposition: string },
): boolean {
  if (!army.factionId.trim()) return true;
  if (!findFaction(catalogue, army.factionId)) return false;
  if (!army.detachment.trim()) return true;
  const dispositions = dispositionsFor(catalogue, army.factionId, army.detachment);
  const known = detachmentsFor(catalogue, army.factionId).some(
    (one) => fold(one.label) === fold(army.detachment) || fold(one.id) === fold(army.detachment));
  if (!known) return false;
  if (!army.disposition.trim()) return true;
  return dispositions.some((one) => fold(one) === fold(army.disposition));
}
