/**
 * Whether what somebody pasted into the unit dialog is the thing that box wants.
 *
 * Both boxes took any valid JSON. Pasting the copy costs into Options saved
 * without a word, and then priced three copies at three times the base, because
 * nothing in a copy-cost rule is a price the option reader can find. The client
 * did exactly that, and the only hint was a preview figure that looked
 * plausible.
 *
 * Same lesson as the standings form: anything parsed out of a form field is a
 * claim, not a fact. Checked here so the dialog can say it while somebody is
 * typing and the server action can refuse it whatever sent the request.
 */

type Thing = Record<string, unknown>;

const isObject = (value: unknown): value is Thing =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A points value is a string in the legacy file and a number by hand. */
const looksLikePoints = (value: unknown) =>
  typeof value === "number"
  || (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)));

/** "" when the options are usable, otherwise what is wrong with them. */
export function optionsProblem(value: unknown): string {
  if (!Array.isArray(value)) return "Options must be a list, even if it is empty.";

  for (const [i, raw] of value.entries()) {
    const at = `Option ${i + 1}`;
    if (!isObject(raw)) return `${at} is not an option. Each one is an object.`;

    // The mistake worth naming, because it is the one that saves quietly and
    // then prices wrongly.
    if ("fromCopy" in raw || "toCopy" in raw) {
      return "These look like copy costs. They belong in the Copy costs box below.";
    }

    if (!("points" in raw) && !("label" in raw)) {
      return `${at} has neither a label nor points, so nothing can use it.`;
    }
    if ("label" in raw && typeof raw.label !== "string") {
      return `${at} has a label that is not text.`;
    }
    if ("points" in raw && !looksLikePoints(raw.points)) {
      return `${at} has points that are not a number.`;
    }
    if ("modelCount" in raw
        && (typeof raw.modelCount !== "number" || raw.modelCount < 1)) {
      return `${at} has a model count that is not a whole number of models.`;
    }
  }
  return "";
}

/** "" when the copy costs are usable, otherwise what is wrong with them. */
export function copyRulesProblem(value: unknown): string {
  if (!Array.isArray(value)) return "Copy costs must be a list, even if it is empty.";

  let previousEnd = 0;

  for (const [i, raw] of value.entries()) {
    const at = `Rule ${i + 1}`;
    if (!isObject(raw)) return `${at} is not a rule. Each one is an object.`;

    // The same mistake the other way round.
    if ("label" in raw && !("fromCopy" in raw)) {
      return "These look like options. They belong in the Options box above.";
    }

    const from = raw.fromCopy;
    if (typeof from !== "number" || !Number.isInteger(from) || from < 1) {
      return `${at} needs a fromCopy of 1 or more.`;
    }

    const to = raw.toCopy;
    const open = to === null || to === undefined;
    if (!open && (typeof to !== "number" || !Number.isInteger(to) || to < from)) {
      return `${at} has a toCopy before its fromCopy.`;
    }

    // Contiguous and in order, so every copy is priced by exactly one rule. A
    // gap would fall back to the base points without saying so, which is how
    // the third copy ends up costing the same as the first.
    if (from !== previousEnd + 1) {
      return previousEnd === 0
        ? `${at} starts at copy ${from}. The first rule has to start at 1.`
        : `${at} starts at copy ${from}, but the rule before it ends at ${previousEnd}.`;
    }

    if ("options" in raw) {
      const inner = optionsProblem(raw.options);
      if (inner) return `${at}: ${inner}`;
    }

    if (open) {
      if (i !== value.length - 1) {
        return `${at} covers every copy after it, so nothing can follow it.`;
      }
      return "";
    }
    previousEnd = to as number;
  }
  return "";
}

/** Both boxes at once, for a caller that only wants to know if it is safe. */
export function unitShapeProblem(options: unknown, rules: unknown): string {
  return optionsProblem(options) || copyRulesProblem(rules);
}
