/**
 * How a club is doing, worked out from dates.
 *
 * Pure, so the shapes on the console overview can be run and checked without a
 * database. Every one of these reads a calendar date with UTC getters, for the
 * reason utils/dates.ts spells out: "2026-09-03" parses as UTC midnight, so a
 * viewer behind UTC reading it locally sees the 2nd and lands in the wrong
 * month.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Monday first, the way a club night is talked about. */
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday",
                  "Friday", "Saturday", "Sunday"] as const;

export type MonthCount = { key: string; label: string; value: number };
export type NightCount = { label: string; short: string; value: number };
export type MixSlice = { key: string; label: string; value: number };

/**
 * A run of months ending with the one `today` falls in, each carrying how many
 * of `dates` landed in it.
 *
 * The empty months matter as much as the full ones: a club with forty tables
 * booked in March and nothing since is a different club from one booking three
 * a month, and a total of forty tells them apart not at all.
 */
export function countByMonth(
  dates: readonly (string | null | undefined)[],
  today: string,
  months = 12,
): MonthCount[] {
  const end = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return [];

  const buckets = new Map<string, MonthCount>();
  for (let back = months - 1; back >= 0; back -= 1) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - back, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const name = MONTHS[d.getUTCMonth()]!;
    buckets.set(key, {
      key,
      // The year only where the run turns over, so twelve labels do not become
      // twelve dates.
      label: d.getUTCMonth() === 0 ? `${name} ${String(d.getUTCFullYear()).slice(2)}` : name,
      value: 0,
    });
  }

  for (const date of dates) {
    const bucket = buckets.get((date ?? "").slice(0, 7));
    if (bucket) bucket.value += 1;
  }

  return [...buckets.values()];
}

/**
 * Which nights the club actually runs on.
 *
 * Nights nobody has booked are dropped rather than drawn as zero. A club that
 * meets on Thursdays should not be shown six empty columns to make the point.
 */
export function byWeekday(dates: readonly (string | null | undefined)[]): NightCount[] {
  const counts = new Array(7).fill(0) as number[];

  for (const date of dates) {
    const d = new Date(`${String(date ?? "").slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) continue;
    // getUTCDay is Sunday-first; shift so Monday leads.
    counts[(d.getUTCDay() + 6) % 7] += 1;
  }

  return WEEKDAYS
    .map((label, i) => ({ label, short: label.slice(0, 3), value: counts[i]! }))
    .filter((night) => night.value > 0)
    .sort((a, b) => b.value - a.value);
}

/**
 * How the roster splits across the tiers the club sells.
 *
 * Ordered by the club's own tier order rather than by size, so the ladder
 * reads bottom to top the way the club wrote it. A tier nobody holds is kept:
 * "nobody has taken Premium" is the useful half of that answer.
 */
export function tierMix(
  members: readonly { tierKey: string | null }[],
  tiers: readonly { tierKey: string; label: string }[],
): MixSlice[] {
  const counts = new Map<string, number>(tiers.map((t) => [t.tierKey, 0]));
  let unassigned = 0;

  for (const member of members) {
    const key = member.tierKey ?? "";
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
    else unassigned += 1;
  }

  const slices: MixSlice[] = tiers.map((t) => ({
    key: t.tierKey, label: t.label, value: counts.get(t.tierKey) ?? 0,
  }));

  // Somebody on a tier the club has since removed still counts as a member.
  if (unassigned > 0) slices.push({ key: "", label: "No tier", value: unassigned });
  return slices;
}

/** The most recent months first, for a "this month against last" line. */
export function changeOnLastMonth(months: readonly MonthCount[]): {
  now: number; before: number; delta: number;
} {
  const now = months.at(-1)?.value ?? 0;
  const before = months.at(-2)?.value ?? 0;
  return { now, before, delta: now - before };
}

/**
 * The same buckets, carried forward.
 *
 * A roster only ever goes up, and twelve separate columns of "who joined in
 * March" hide the shape of that. `before` is what the club already had at the
 * start of the run, so the line starts at the real number rather than at zero.
 */
export function runningTotal(months: readonly MonthCount[], before = 0): MonthCount[] {
  let total = before;
  return months.map((m) => {
    total += m.value;
    return { ...m, value: total };
  });
}
