/**
 * What a unit costs once you take more than one of it.
 *
 * Legacy's `copyCostRules` (`_normalise_army_list_payload`, club_store.py:17506)
 * price a unit by which copy it is, not by a flat multiplier. Castigator is the
 * worked example: copies 1 and 2 cost 165, copy 3 and up cost 175, so three of
 * them is 505 and not 495.
 *
 * Pure, and here rather than in stage 10, because the catalogue is what it
 * reads and the importer has to preserve the shape it depends on. A second
 * reading of this rule in the Army Builder would be a second thing to get
 * wrong.
 */

export type UnitOption = {
  label?: string;
  modelCount?: number;
  /** A string in the legacy file, and stays one so nothing rounds twice. */
  points?: string | number;
};

export type CopyCostRule = {
  fromCopy: number;
  /** Null means "and every copy after this one". */
  toCopy: number | null;
  options?: UnitOption[];
};

export type PricedUnit = {
  name: string;
  basePoints: number;
  options?: UnitOption[];
  copyCostRules?: CopyCostRule[];
};

const asPoints = (value: string | number | undefined, fallback: number): number => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(String(value).trim());
  // Never `Number("") === 0`. A points value that will not parse falls back to
  // what the unit already costs rather than quietly becoming free, which is
  // the mistake a listing price made in stage 5.
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
};

/** What the nth copy of a unit costs, counting from one. */
export function copyPoints(unit: PricedUnit, copy: number, optionLabel?: string): number {
  const base = pickOption(unit.options, optionLabel, unit.basePoints);
  const rule = ruleFor(unit, copy);
  if (!rule) return base;
  return pickOption(rule.options, optionLabel, base);
}

const ruleFor = (unit: PricedUnit, copy: number) =>
  (unit.copyCostRules ?? []).find((one) =>
    copy >= one.fromCopy && (one.toCopy === null || one.toCopy === undefined
      ? true : copy <= one.toCopy));

/**
 * The option a given copy is priced from, which is also where its label and
 * model count come from.
 *
 * Legacy picks the copy rule's option set when it has one and the unit's own
 * otherwise, then the named option inside that set, then the first
 * (`_find_army_catalog_unit_option`, club_store.py:17163). A label that is not
 * in the effective set falls back to the first rather than being refused, so a
 * list survives a catalogue that renamed an option.
 */
export function effectiveOption(
  unit: PricedUnit, copy: number, optionLabel?: string,
): UnitOption | undefined {
  const rule = ruleFor(unit, copy);
  const set = rule?.options?.length ? rule.options : (unit.options ?? []);
  if (!set.length) return undefined;
  const label = optionLabel?.trim();
  return (label
    ? set.find((one) => (one.label ?? "").trim().toLowerCase() === label.toLowerCase())
    : undefined) ?? set[0];
}

function pickOption(
  options: UnitOption[] | undefined, label: string | undefined, fallback: number,
): number {
  const list = options ?? [];
  if (!list.length) return fallback;
  // The named option when there is one, otherwise the first: a rule that lists
  // one price for a unit with several options means that price for all of them.
  const found = label
    ? list.find((one) => (one.label ?? "").trim() === label.trim())
    : undefined;
  return asPoints((found ?? list[0])?.points, fallback);
}

/**
 * What copies `from` to `from + count - 1` each cost, in order.
 *
 * The array rather than the sum, because the caller needs both: the total is
 * its sum, and whether every entry is the same number is what decides if a
 * per-unit price can be shown at all.
 */
export function copyRun(
  unit: PricedUnit, from: number, count: number, optionLabel?: string,
): number[] {
  const run: number[] = [];
  const start = Math.max(1, Math.floor(from));
  for (let i = 0; i < Math.max(0, Math.floor(count)); i += 1) {
    run.push(copyPoints(unit, start + i, optionLabel));
  }
  return run;
}

/** What `count` copies cost together, starting from the first. */
export function linePoints(unit: PricedUnit, count: number, optionLabel?: string): number {
  return copyRun(unit, 1, count, optionLabel).reduce((sum, n) => sum + n, 0);
}

/**
 * A whole list, and what is left of its limit.
 *
 * Copies are counted per unit NAME across every line, not per line, which is
 * legacy's rule (`_normalise_army_list_payload`, club_store.py:17555) and was
 * the bug in the first version of this file. Two lines of Castigator, two on
 * one and one on the other, is 165 + 165 + 175 and not 165 + 165 + 165: the
 * escalation is a property of how many you are fielding, not of how you typed
 * them in. Splitting a line would otherwise have been a way to pay less.
 */
export function priceList(
  lines: { unit: PricedUnit; count: number; optionLabel?: string }[],
  limit = 0,
): { total: number; remaining: number; over: boolean } {
  const used = new Map<string, number>();
  let total = 0;
  for (const line of lines) {
    const key = line.unit.name.trim().toLowerCase();
    const from = (used.get(key) ?? 0) + 1;
    const run = copyRun(line.unit, from, line.count, line.optionLabel);
    used.set(key, from + run.length - 1);
    total += run.reduce((sum, n) => sum + n, 0);
  }
  return { total, remaining: limit - total, over: limit > 0 && total > limit };
}
