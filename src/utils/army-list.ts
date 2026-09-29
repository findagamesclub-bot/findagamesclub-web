import { copyRun, effectiveOption, type PricedUnit } from "./army-pricing";

/**
 * Turning what somebody typed into the list that gets stored.
 *
 * This is `_normalise_army_list_payload`'s unit half (club_store.py:17548) and
 * it does four things in one pass, in this order, because the order is what
 * makes the answer stable: price each line from the copy it actually is, merge
 * lines that name the same unit and option, drop what the catalogue does not
 * have, and sort what is left.
 *
 * Pure, so the wizard can run it on every keystroke and the save can run it
 * again on the server without either of them being the authority on its own.
 */

export type DraftLine = {
  unitName: string;
  optionLabel?: string;
  quantity: number;
};

export type ListLine = {
  unitName: string;
  optionLabel: string;
  optionModelCount: number | null;
  quantity: number;
  /**
   * What one of them costs, or 0 when the copies in this line no longer agree.
   * Legacy's own answer: there is no single price for "a Castigator" once the
   * third costs more than the first, so it says nothing rather than something
   * misleading.
   */
  unitPoints: number;
  linePoints: number;
};

export type NormalisedList = {
  lines: ListLine[];
  total: number;
  /** Unit names the catalogue does not have, so a screen can say what went. */
  dropped: string[];
};

const fold = (value: string) => value.trim().toLowerCase();

export function normaliseLines(units: PricedUnit[], draft: DraftLine[]): NormalisedList {
  const byName = new Map(units.map((unit) => [fold(unit.name), unit]));
  // How many of each unit have been fielded so far, by name. Not by line: the
  // third Castigator is the third whichever line it was typed on.
  const used = new Map<string, number>();
  const merged = new Map<string, ListLine>();
  const dropped: string[] = [];

  for (const line of draft) {
    const name = String(line.unitName ?? "").trim();
    const unit = byName.get(fold(name));
    const quantity = Math.floor(Number(line.quantity) || 0);
    if (!unit || quantity <= 0) {
      if (name && !unit) dropped.push(name);
      continue;
    }

    const copyKey = fold(unit.name);
    const from = (used.get(copyKey) ?? 0) + 1;
    const run = copyRun(unit, from, quantity, line.optionLabel);
    used.set(copyKey, from + quantity - 1);

    const option = effectiveOption(unit, from, line.optionLabel);
    const label = String(option?.label ?? line.optionLabel ?? "Default").trim() || "Default";
    const modelCount = option?.modelCount ?? null;
    const same = run.every((points) => points === run[0]);
    const linePoints = run.reduce((sum, points) => sum + points, 0);

    const key = `${copyKey}::${fold(label)}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        unitName: unit.name,
        optionLabel: label,
        optionModelCount: modelCount,
        quantity,
        unitPoints: same ? run[0] : 0,
        linePoints,
      });
      continue;
    }
    current.quantity += quantity;
    current.linePoints += linePoints;
    // Two halves of one line that no longer cost the same is the same problem
    // as one line whose copies differ, and gets the same answer.
    if (!same || current.unitPoints !== run[0]) current.unitPoints = 0;
  }

  const lines = [...merged.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, line]) => line);

  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.linePoints, 0),
    dropped: [...new Set(dropped)],
  };
}

/**
 * Legacy's refusals, in legacy's own words and legacy's own order.
 *
 * The wording is copied rather than improved on purpose: it is what the
 * client's members have been reading for two years, and a builder that refuses
 * a list in different words from the one they know is a builder that looks
 * broken. `Choose a valid army system.` is the one message not here, because
 * there is one system and nothing can fail that check.
 */
export type DraftShape = {
  name: string;
  listType: "army-list" | "collection";
  pointsLimit: string;
  factionId: string;
  detachments: { detachment: string; disposition: string }[];
};

export function refusalFor(
  draft: DraftShape,
  known: { factionIds: string[]; pointsOptions: string[] },
  list: NormalisedList,
): string | null {
  if (!draft.name.trim()) return "Army list name is required.";

  const collection = draft.listType === "collection";
  if (!collection && !known.pointsOptions.includes(draft.pointsLimit.trim())) {
    return "Choose a valid points value.";
  }
  if (!known.factionIds.some((id) => fold(id) === fold(draft.factionId))) {
    return "Choose a valid army faction.";
  }
  if (!collection && draft.detachments.length === 0) {
    return "Choose at least one detachment.";
  }
  if (list.lines.length === 0) return "Add at least one unit to the army list.";

  const limit = Number(draft.pointsLimit) || 0;
  if (!collection && limit > 0 && list.total > limit) {
    return "Selected units exceed the chosen points limit.";
  }
  return null;
}
