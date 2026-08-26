import type { BookableSession, ClubScheduleSlot } from "@/types/booking";

/**
 * Turn a club's weekly schedule into real dated nights.
 *
 * Ported from _build_booking_sessions (club_store.py:15986-16017) with one
 * deliberate change. Legacy identifies a session by `${date}__${arrayIndex}`,
 * where the index is the slot's position in the club's schedule array. That is
 * positional, so reordering or deleting a schedule row silently repoints every
 * existing booking at a different night — and the live data already shows a
 * club having edited its schedule after bookings existed. We key on
 * club_sessions.id instead, which survives edits, and keep the legacy string
 * only so imported bookings can be matched to their session once.
 *
 * Dates are club-night wall-clock dates, never instants. All arithmetic is on
 * plain YYYY-MM-DD strings so a UK club night cannot slide a day under BST.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Parse YYYY-MM-DD as a calendar date, with no timezone applied. */
function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function weekdayOf(iso: string): string {
  return WEEKDAYS[parseDate(iso).getUTCDay()]!;
}

/**
 * Every bookable night in a window, in date then schedule order.
 *
 * `days` is a horizon in calendar days. The separate rule about how many
 * distinct NIGHTS a member may book across (advanceBookingDates) is applied
 * later — it counts club nights, not days, so a monthly club and a weekly club
 * get very different windows from the same number.
 */
export function generateSessions(
  schedule: ClubScheduleSlot[],
  fromDate: string,
  days: number,
): BookableSession[] {
  if (!schedule.length || days <= 0) return [];

  const byDay = new Map<string, ClubScheduleSlot[]>();
  for (const slot of schedule) {
    const day = slot.day.trim();
    const list = byDay.get(day) ?? [];
    list.push(slot);
    byDay.set(day, list);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.position - b.position);

  const sessions: BookableSession[] = [];
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(fromDate, offset);
    for (const slot of byDay.get(weekdayOf(date)) ?? []) {
      sessions.push({
        clubSessionId: slot.id,
        date,
        day: slot.day,
        time: slot.time,
        label: slot.label,
        legacyKey: `${date}__${slot.position}`,
      });
    }
  }
  return sessions;
}

/**
 * The first N distinct club nights a member may book into.
 *
 * advanceBookingDates counts NIGHTS, not days (club_store.py:16683 scans
 * sessions, not the calendar) — four at a club meeting weekly is a month, four
 * at a monthly club is a third of a year.
 */
export function bookableSessions<T extends { date: string }>(
  sessions: T[],
  advanceBookingDates: number,
): T[] {
  if (advanceBookingDates <= 0) return sessions;

  const allowed = new Set<string>();
  return sessions.filter((s) => {
    if (allowed.has(s.date)) return true;
    if (allowed.size >= advanceBookingDates) return false;
    allowed.add(s.date);
    return true;
  });
}
