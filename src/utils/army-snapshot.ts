/**
 * An army list snapshot, read the same way wherever it came from.
 *
 * A placing keeps its copy inside `club_event_results.army` as
 * `armyListVersionSnapshot`; a table of the draw keeps its own in
 * `game_result_armies.snapshot` (0145). Two sources, one shape, and two
 * readings of it would drift the first time either was touched: the placing
 * card and the round result would then disagree about the same list, on the
 * same page.
 *
 * Separate from `result-army.ts`, which is the EDITOR's shape: that one holds
 * what a form posts, down to the painted bonus and whose turn it was. This is
 * what a reader is shown.
 *
 * Pure. No I/O, no React.
 */

export type ArmyUnit = { name: string; quantity: number; points: number };

export type ArmyList = {
  /** Null on an imported result: legacy stored the name and not the row. */
  id: number | null;
  name: string | null;
  pointsLimit: string | null;
  totalPoints: number | null;
  units: ArmyUnit[];
};

/**
 * The units inside a snapshot.
 *
 * `linePoints` is what the line cost with its copies counted, which is the
 * figure a reader checks against the limit; `unitPoints` is the fallback for a
 * snapshot written before the line total was stored.
 */
export function unitsFromSnapshot(snapshot: unknown): ArmyUnit[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const raw = (snapshot as Record<string, unknown>).units;
  if (!Array.isArray(raw)) return [];

  return (raw as Record<string, unknown>[])
    .map((u) => ({
      name: String(u.unitName ?? ""),
      quantity: Number(u.quantity ?? 1),
      points: Number(u.linePoints ?? u.unitPoints ?? 0),
    }))
    .filter((u) => u.name);
}

/**
 * A whole list from a snapshot, or null when there is nothing to show.
 *
 * An empty snapshot is not a list. `{}` is what 0145 writes when a link is
 * cleared, and a list heading over no units reads as a list that failed to
 * load rather than one nobody named.
 */
export function listFromSnapshot(
  snapshot: unknown,
  about: { id: number | null; name: string | null },
): ArmyList | null {
  const units = unitsFromSnapshot(snapshot);
  if (!units.length) return null;

  const s = (snapshot ?? {}) as Record<string, unknown>;
  return {
    id: about.id,
    name: about.name || null,
    pointsLimit: typeof s.pointsLimit === "string" ? s.pointsLimit : null,
    totalPoints: typeof s.totalPoints === "number" ? s.totalPoints : null,
    units,
  };
}

/**
 * What an army reads as on one line.
 *
 * Three facts in the order a player says them: the army, the detachment it was
 * built around, and the disposition that detachment was given. The placing
 * card, the placing row and a table of the draw all print this, and all three
 * had their own copy of the join before it was one function.
 */
export function armySummary(army: {
  factionLabel?: string | null;
  detachment?: string | null;
  disposition?: string | null;
} | null | undefined): string {
  if (!army) return "";
  return [army.factionLabel, army.detachment, army.disposition]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}
