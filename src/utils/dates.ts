/** Human date helpers. Server-rendered once, so no hydration concerns. */

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Aug 2026". Used where the day would be noise.
 *
 * A plain `new Date("2026-09-03")` parses as UTC midnight but `getMonth()` reads
 * it in the viewer's timezone, so anyone behind UTC sees 2 Sep and the label
 * says August. Server and client then disagree and React throws away the tree.
 * Club dates are calendar dates, so they are read in UTC on both sides.
 */
export function monthYear(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * "today", "3 days ago", "2 months ago".
 *
 * Deliberately coarse: an owner clearing a queue needs to know whether someone
 * has been waiting a while, not the minute they applied.
 */
export function sinceLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? "s" : ""} ago`;
}

/** Last day of the month `d` lands in, so month maths never rolls over. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Add whole months, clamping the day.
 *
 * Plain date maths turns 31 Jan + 1 month into 3 March. A membership bought on
 * the 31st has to run to the 28th, not skip a month.
 */
export function addMonths(from: Date, count: number): Date {
  const year = from.getFullYear();
  const month = from.getMonth() + count;
  const day = Math.min(from.getDate(), daysInMonth(year, month));
  const next = new Date(from);
  next.setFullYear(year, month, day);
  return next;
}

export function addYears(from: Date, count: number): Date {
  return addMonths(from, count * 12);
}

/** "12 Sep 2026". Long enough to be unambiguous on a receipt line. */
export function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // UTC getters, for the same reason as monthYear.
  return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "THU 27 AUG" — the way a club night is spoken about. */
export function nightLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  return `${DAY_SHORT[date.getUTCDay()]} ${date.getUTCDate()} ${MONTH[date.getUTCMonth()]}`;
}

/** "This week" / "Next week" / "In 3 weeks", for grouping a list of nights. */
export function weeksAway(iso: string, from: string): string {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${iso}T00:00:00Z`);
  const days = Math.round((b - a) / 86_400_000);
  if (days <= 6) return "This week";
  if (days <= 13) return "Next week";
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `In ${weeks} weeks`;
  return "Later";
}

/**
 * A timestamp for a conversation, where sinceLabel is too coarse.
 *
 * Nine replies in one afternoon all reading "today" says nothing about the
 * order things were said in. Same day gives the clock; older gives the date.
 *
 * Pinned to London rather than the reader's machine, because this renders on
 * the server first and a client in another timezone would print something
 * different and blow up hydration. The clubs are all in the UK.
 */
const LONDON = "Europe/London";

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON, hour: "2-digit", minute: "2-digit", hour12: false,
});
const dayMonth = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON, day: "numeric", month: "short",
});
const withYear = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON, day: "numeric", month: "short", year: "numeric",
});

/** The London calendar day, as YYYY-MM-DD, so two stamps can be compared. */
function londonDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

export function messageTime(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const today = londonDay(now);
  const day = londonDay(d);
  if (day === today) return clock.format(d);

  const yesterday = londonDay(new Date(now.getTime() - 86_400_000));
  if (day === yesterday) return `Yesterday ${clock.format(d)}`;

  return day.slice(0, 4) === today.slice(0, 4) ? dayMonth.format(d) : withYear.format(d);
}

/**
 * The clock in London, as wall-clock strings.
 *
 * Club dates and times are London wall-clock on both sides of the app, so
 * comparing an event's 17:00 against the viewer's own clock would end events
 * an hour early for anyone in Paris.
 */
export function londonNow(at: Date = new Date()): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric", month: "2-digit", day: "2-digit",
      // h23, not hour12:false: the latter can render midnight as "24".
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}
