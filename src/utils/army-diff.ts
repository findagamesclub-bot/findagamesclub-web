import type { ListLine } from "./army-list";

/**
 * What changed between two versions, in one line.
 *
 * Copied from `_describe_army_list_version_change` (club_store.py:17389)
 * including the cap: **at most two parts**, joined by a middle dot. A faction
 * change returns on its own and suppresses everything else, because changing
 * the army is not a detail to list alongside a unit swap.
 */

export type VersionShape = {
  factionLabel: string;
  detachment: string;
  disposition: string;
  pointsLimit: string;
  units: Pick<ListLine, "unitName" | "optionLabel" | "quantity">[];
};

const fold = (value: string) => value.trim().toLowerCase();
const keyOf = (unit: { unitName: string; optionLabel: string }) =>
  `${fold(unit.unitName)}::${fold(unit.optionLabel)}`;

export type UnitDiff = {
  added: VersionShape["units"];
  removed: VersionShape["units"];
  adjusted: { unit: VersionShape["units"][number]; from: number; to: number }[];
};

/** The unit-level difference, which the versions page draws in full. */
export function diffUnits(previous: VersionShape, next: VersionShape): UnitDiff {
  const before = new Map(previous.units.map((one) => [keyOf(one), one]));
  const after = new Map(next.units.map((one) => [keyOf(one), one]));
  return {
    added: [...after].filter(([key]) => !before.has(key)).map(([, one]) => one),
    removed: [...before].filter(([key]) => !after.has(key)).map(([, one]) => one),
    adjusted: [...after]
      .filter(([key, one]) => before.has(key) && before.get(key)!.quantity !== one.quantity)
      .map(([key, one]) => ({
        unit: one, from: before.get(key)!.quantity, to: one.quantity,
      })),
  };
}

export function describeChange(
  previous: VersionShape | null, next: VersionShape,
): string {
  if (!previous) return "Initial version";

  if (fold(previous.factionLabel) !== fold(next.factionLabel) && next.factionLabel.trim()) {
    return `Changed faction to ${next.factionLabel.trim()}`;
  }

  const bits: string[] = [];
  if (fold(previous.detachment) !== fold(next.detachment) && next.detachment.trim()) {
    bits.push(`Detachment to ${next.detachment.trim()}`);
  }
  if (fold(previous.disposition) !== fold(next.disposition) && next.disposition.trim()) {
    bits.push(`Disposition to ${next.disposition.trim()}`);
  }
  if (previous.pointsLimit.trim() !== next.pointsLimit.trim() && next.pointsLimit.trim()) {
    bits.push(`Points limit ${next.pointsLimit.trim()}`);
  }

  const { added, removed, adjusted } = diffUnits(previous, next);
  if (added.length === 1 && !removed.length && !adjusted.length) {
    bits.push(`Added ${added[0].unitName}`);
  } else if (removed.length === 1 && !added.length && !adjusted.length) {
    bits.push(`Removed ${removed[0].unitName}`);
  } else {
    const count = added.length + removed.length + adjusted.length;
    if (count === 1 && adjusted.length) {
      bits.push(`Adjusted ${adjusted[0].unit.unitName}`);
    } else if (count > 0) {
      bits.push(`Updated ${count} unit ${count === 1 ? "entry" : "entries"}`);
    }
  }

  if (!bits.length) return "Edited list details";
  return bits.slice(0, 2).join(" · ");
}
