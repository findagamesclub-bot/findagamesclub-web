/**
 * When somebody actually joined a club.
 *
 * A club listing itself after ten years approves forty people who have been
 * coming since 2015, and `approve` stamps today on every one of them. So the
 * roster reads "joined this morning" for the whole room and nobody has a year
 * badge. The club corrects the date; this is the rule for what it may be.
 *
 * Mirrors `set_membership_joined_at` (0171) rather than being trusted by it:
 * the database refuses the same three things, and this is what lets the dialog
 * say so before the round trip.
 */

/** The oldest a typed year can be. A mistyped 0202 is not a club. */
export const JOIN_DATE_FLOOR = "1900-01-01";

export type JoinDateProblem = "empty" | "unreadable" | "future" | "tooOld";

/**
 * What is wrong with it, or null when nothing is.
 *
 * `today` is passed in rather than read, so this is testable and so the club
 * day comes from the same place every other date in this app comes from.
 */
export function joinDateProblem(value: string, today: string): JoinDateProblem | null {
  const typed = value.trim();
  if (!typed) return "empty";

  // An `<input type="date">` hands back `YYYY-MM-DD` or nothing at all, so a
  // half-typed date arrives as "" rather than as something to parse. Anything
  // else came from somewhere this screen does not control.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(typed)) return "unreadable";
  const when = new Date(`${typed}T00:00:00Z`);
  if (Number.isNaN(when.getTime())) return "unreadable";

  if (typed > today) return "future";
  if (typed < JOIN_DATE_FLOOR) return "tooOld";
  return null;
}

export const JOIN_DATE_MESSAGES: Record<JoinDateProblem, string> = {
  empty: "Pick the date they joined.",
  unreadable: "That is not a date. Use the picker.",
  future: "A join date cannot be in the future.",
  tooOld: "That year looks like a typo. Use 1900 or later.",
};

/** What the club refuses with, said the way the screen says it. */
export const JOIN_DATE_ERRORS: Record<string, string> = {
  JOINED_REQUIRED: JOIN_DATE_MESSAGES.empty,
  JOINED_IN_FUTURE: JOIN_DATE_MESSAGES.future,
  JOINED_TOO_OLD: JOIN_DATE_MESSAGES.tooOld,
  MEMBERSHIP_NOT_FOUND: "That membership is not here any more.",
};

/**
 * Whole years between two calendar dates, counted by anniversary.
 *
 * Not days divided by 365: somebody who joined on 29 February is not a year
 * older on 28 February, and a leap year makes the division wrong either way.
 * `age()` in SQL counts the same way, which is why the badge and this agree.
 */
export function yearsBetween(joined: string, today: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(joined) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return 0;
  const [jy, jm, jd] = joined.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  let years = ty - jy;
  if (tm < jm || (tm === jm && td < jd)) years -= 1;
  return Math.max(0, years);
}
