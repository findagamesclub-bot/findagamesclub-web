/**
 * A club night's hours, which are one string in the database and two fields on
 * the form.
 *
 * `club_sessions.time` has held a range as a single string since milestone 1,
 * "18:30 - 22:30", and every one of the twenty real rows in the client's data
 * is exactly that shape. So the column stays as it is and the form does the
 * splitting: two time inputs are a picker on every phone and a keyboard on
 * every desktop, where typing the whole range by hand produced whatever the
 * person felt like that day.
 *
 * Anything that will not parse is handed back untouched rather than cleared.
 * A club whose hours read "first Sunday, afternoon" has said something true,
 * and a form that silently replaces it with 00:00 is worse than one that keeps
 * it as words.
 */

const RANGE = /^\s*(\d{1,2}):(\d{2})\s*(?:-|–|—|to)\s*(\d{1,2}):(\d{2})\s*$/i;

export type TimeRange = { from: string; to: string };

/** Two digits, so "9:30" round-trips as "09:30" the way an input wants it. */
const pad = (hour: string, minute: string) =>
  `${hour.padStart(2, "0")}:${minute}`;

/**
 * Split a stored range into the two values a pair of time inputs holds.
 * Null when it is not a range, which is the caller's signal to keep the words.
 */
export function parseTimeRange(value: string | null | undefined): TimeRange | null {
  const match = RANGE.exec(String(value ?? ""));
  if (!match) return null;

  const from = pad(match[1]!, match[2]!);
  const to = pad(match[3]!, match[4]!);

  // A time input only accepts 00:00 to 23:59. Anything outside it came from
  // somewhere else and is words, not a range.
  if (!isTime(from) || !isTime(to)) return null;

  return { from, to };
}

function isTime(value: string): boolean {
  const [hour, minute] = value.split(":").map(Number);
  return Number.isInteger(hour) && Number.isInteger(minute)
    && hour! >= 0 && hour! <= 23 && minute! >= 0 && minute! <= 59;
}

/**
 * Put the two back together in the one shape the column has always held.
 *
 * Half a range is not a range: a night with a start and no end is incomplete,
 * and the step's own validation refuses it by name rather than saving
 * "18:30 - ".
 */
export function formatTimeRange(from: string, to: string): string {
  const start = from.trim();
  const end = to.trim();
  if (!start && !end) return "";
  if (!start || !end) return start || end;
  return `${start} - ${end}`;
}

/**
 * Does a night run past midnight?
 *
 * Not an error. A Friday that starts at 20:00 and ends at 01:00 is a real club
 * night, and the only thing that matters is that nothing treats it as a
 * negative length.
 */
export function crossesMidnight(range: TimeRange): boolean {
  return range.to < range.from;
}

/**
 * Is this half a range rather than hours?
 *
 * A single clock time on its own, "18:38", is somebody who picked a start and
 * did not pick an end. Saving it would put "18:38" on the club page as the
 * hours, which says nothing about when the night finishes.
 *
 * Words are not half a range. "first Sunday, afternoon" is a club telling the
 * truth in the only way it can, and the form has no business refusing it.
 */
export function isHalfRange(value: string | null | undefined): boolean {
  return /^\s*\d{1,2}:\d{2}\s*$/.test(String(value ?? ""));
}
