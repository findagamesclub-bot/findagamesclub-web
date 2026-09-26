import type { Badge } from "./competition-badges";

/**
 * How long somebody has been a member, as a badge.
 *
 * The client's own example of an automatic badge: "member for 1 year, 2 years
 * etc". Legacy has it (`_build_membership_tenure_badge`, club_store.py:22992)
 * and Stage 2 did not port it, so this closes that gap rather than inventing
 * anything. Legacy's bands, unchanged: 1, 2, 3, 5 and 10+ years.
 *
 * Counted by anniversary, not by dividing days. 365 days is wrong across a leap
 * year, and somebody who joined on 29 February is not a year older on
 * 28 February. Legacy compares (month, day) for exactly that reason and so does
 * this.
 *
 * Derived, never stored. A badge that depends only on a date already in the
 * database is a badge a row would only let drift.
 */

const BANDS: { years: number; label: string; tone: Badge["tone"] }[] = [
  { years: 10, label: "10+ years", tone: "champion" },
  { years: 5, label: "5 years", tone: "leader" },
  { years: 3, label: "3 years", tone: "podium" },
  { years: 2, label: "2 years", tone: "streak" },
  { years: 1, label: "1 year", tone: "streak" },
];

/**
 * Whole years between two calendar dates, by anniversary.
 *
 * Both are read with UTC getters, because a join date is a calendar date and
 * reading it in the viewer's zone makes somebody a year older a day early for
 * anybody east of Greenwich.
 */
export function yearsSince(joined: string | null | undefined, today: string): number {
  if (!joined) return 0;
  const from = new Date(joined);
  const to = new Date(today);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;

  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const beforeAnniversary =
    to.getUTCMonth() < from.getUTCMonth()
    || (to.getUTCMonth() === from.getUTCMonth() && to.getUTCDate() < from.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(years, 0);
}

/** The one band somebody is in, or nothing under a year. */
export function tenureBadge(
  joined: string | null | undefined, today: string,
): Badge | null {
  const years = yearsSince(joined, today);
  const band = BANDS.find((one) => years >= one.years);
  if (!band) return null;

  return {
    key: `tenure::${band.years}`,
    label: band.label,
    context: "Member since " + String(joined).slice(0, 4),
    tone: band.tone,
  };
}
