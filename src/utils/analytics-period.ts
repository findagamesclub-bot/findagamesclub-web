/**
 * The windows the analytics page offers, and the dates behind them.
 *
 * Legacy carries three separate range pickers (`ownerDashboardSignupRange`,
 * `ownerDashboardRevenueTrendRange`, `ownerDashboardRevenueMixRange`), so a
 * club can read revenue over a year while reading signups over three months.
 * That is kept rather than collapsed into one global picker, because taking it
 * away would take away a real thing somebody does.
 *
 * Pure, and every date is a London day, because a club night is a London day
 * and a month boundary read in the viewer's timezone puts a Tuesday in the
 * wrong month for anybody behind UTC.
 */

export const PERIODS = [
  { key: "month", label: "This month", days: 0, months: 1 },
  { key: "3m", label: "3 months", days: 90, months: 3 },
  { key: "6m", label: "6 months", days: 182, months: 6 },
  { key: "12m", label: "12 months", days: 365, months: 12 },
  { key: "all", label: "All time", days: 3650, months: 24 },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

export const DEFAULT_PERIOD: PeriodKey = "3m";

export function isPeriod(value: string): value is PeriodKey {
  return PERIODS.some((p) => p.key === value);
}

export function readPeriod(value: string | string[] | undefined): PeriodKey {
  const one = Array.isArray(value) ? value[0] : value;
  return one && isPeriod(one) ? one : DEFAULT_PERIOD;
}

export function periodLabel(key: PeriodKey): string {
  return PERIODS.find((p) => p.key === key)?.label ?? key;
}

/** How many months of buckets a timeline asks for. */
export function periodMonths(key: PeriodKey): number {
  return PERIODS.find((p) => p.key === key)?.months ?? 3;
}

/**
 * The window, as two London days.
 *
 * "This month" is the first of the month to today, which is what somebody means
 * by it. Everything else counts back a fixed number of days, matching legacy's
 * own arithmetic rather than doing calendar months, because a club comparing
 * "3 months" to "6 months" wants twice the window, not a different number of
 * weekends.
 */
export function periodRange(key: PeriodKey, today: string): { from: string; to: string } {
  if (key === "month") return { from: `${today.slice(0, 7)}-01`, to: today };

  const days = PERIODS.find((p) => p.key === key)?.days ?? 90;
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return { from: start.toISOString().slice(0, 10), to: today };
}
