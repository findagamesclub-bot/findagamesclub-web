/**
 * What makes one version of a list different from the last.
 *
 * Legacy hashes a canonical payload and compares the hex
 * (`_build_army_list_version_signature`, club_store.py:17225). Only the
 * canonical string is built here, never the hash: `node:crypto` in a util
 * would stop this file being importable from the wizard, and comparing two
 * canonical strings answers "did anything change" just as well. The database
 * hashes the same string, which is what lets a harness test assert the two
 * readings agree rather than hoping.
 *
 * What is deliberately NOT in it: the list's name, and every points figure.
 * Renaming a list is not a new version of the army, and a re-price against the
 * same catalogue cannot be one either. That is the rule behind "Saved. Nothing
 * changed, so no new version."
 */

export type SignatureInput = {
  editionId: string;
  catalogueVersion: string;
  listType: string;
  systemId: string;
  pointsLimit: string;
  factionId: string;
  detachments: { detachment: string; disposition: string }[];
  units: { unitName: string; optionLabel: string; quantity: number }[];
};

const fold = (value: unknown) => String(value ?? "").trim().toLowerCase();
const flat = (value: unknown) => String(value ?? "").trim();

/**
 * JSON with every object's keys in name order, at every depth, and no spaces.
 * `JSON.stringify` keeps insertion order, so building the object "in the right
 * order" would work until somebody reordered a field, which is exactly the
 * kind of change nobody would think could matter.
 */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function canonicalPayload(input: SignatureInput): string {
  return stable({
    editionId: flat(input.editionId),
    catalogueVersion: flat(input.catalogueVersion),
    listType: flat(input.listType) === "collection" ? "collection" : "army-list",
    systemId: fold(input.systemId),
    pointsLimit: flat(input.pointsLimit),
    factionId: fold(input.factionId),
    detachmentSelections: input.detachments.map((one) => ({
      detachment: fold(one.detachment),
      disposition: fold(one.disposition),
    })),
    units: input.units.map((one) => ({
      unitName: fold(one.unitName),
      optionLabel: fold(one.optionLabel),
      quantity: Math.floor(Number(one.quantity) || 0),
    })),
  });
}

/** Whether saving this draft would make a new version of that list. */
export function wouldMakeVersion(next: SignatureInput, current: SignatureInput): boolean {
  return canonicalPayload(next) !== canonicalPayload(current);
}
