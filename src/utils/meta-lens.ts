/**
 * The window the tracker is looking through.
 *
 * Legacy's five (club_store.py:25684 onwards) and no more: a picker offering
 * arbitrary dates is a different feature, and the whole point of these is that
 * two people comparing notes are looking at the same slice.
 *
 * Pure, so the dates are arithmetic on a London day rather than on whatever
 * the reader's machine thinks today is. `dates.ts` learned that the hard way:
 * `new Date("2026-09-03")` is UTC midnight, so anybody behind UTC reads it as
 * the 2nd.
 */

export type LensKey = "30d" | "3m" | "6m" | "12m" | "all";

export const LENSES: { value: LensKey; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
];

/** What a plain URL means. Legacy opens on 90 days, which is this one. */
export const DEFAULT_LENS: LensKey = "3m";

export function readLens(raw: unknown): LensKey {
  const value = typeof raw === "string" ? raw : "";
  return LENSES.some((one) => one.value === value) ? (value as LensKey) : DEFAULT_LENS;
}

export function lensLabel(key: LensKey): string {
  return LENSES.find((one) => one.value === key)?.label ?? "";
}

/**
 * The same day of the month, N months back, clamped to a day that exists.
 *
 * `setUTCMonth` rolls 29 February back a year into 1 March, which makes "last
 * 12 months" eleven months and thirty days. A window that is short by a day
 * drops games out of it, so the last day of the shorter month is the answer:
 * the window is never less than it says it is.
 */
function monthsBefore(
  year: number, month: number, day: number, back: number,
): string {
  const whole = year * 12 + (month - 1) - back;
  const targetYear = Math.floor(whole / 12);
  const targetMonth = whole % 12;
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const safe = new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
  return safe.toISOString().slice(0, 10);
}

/**
 * The window as two dates, or nothing for all time.
 *
 * `today` is handed in rather than read, so a test can pin it and so a server
 * render and the database agree about which day it is.
 */
export function lensWindow(
  key: LensKey, today: string,
): { from: string | null; to: string | null } {
  if (key === "all") return { from: null, to: null };

  const [year, month, day] = today.split("-").map(Number) as [number, number, number];

  if (key === "30d") {
    // UTC arithmetic on a date that is already a London day: the calendar
    // maths is the same, and UTC is the only zone that cannot shift under it.
    const start = new Date(Date.UTC(year, month - 1, day - 30));
    return { from: start.toISOString().slice(0, 10), to: today };
  }

  const back = key === "3m" ? 3 : key === "6m" ? 6 : 12;
  return { from: monthsBefore(year, month, day, back), to: today };
}

/**
 * The window before this one, the same length, for "rising and falling".
 *
 * All time has nothing before it, which is a fact and not a zero.
 */
export function previousWindow(
  key: LensKey, today: string,
): { from: string | null; to: string | null } {
  if (key === "all") return { from: null, to: null };

  const now = lensWindow(key, today);
  if (!now.from) return { from: null, to: null };

  const start = new Date(`${now.from}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() - 1);

  const earlier = lensWindow(key, end.toISOString().slice(0, 10));
  return { from: earlier.from, to: end.toISOString().slice(0, 10) };
}
