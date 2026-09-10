import "server-only";

import { findBookingDates } from "@/repositories/bookings.repository";
import { findMembershipPulse } from "@/repositories/memberships.repository";
import { londonToday } from "./bookingCalendar.service";
import {
  byWeekday, changeOnLastMonth, countByMonth, tierMix,
  type MixSlice, type MonthCount, type NightCount,
} from "@/utils/club-pulse";
import type { MembershipTier } from "@/types/clubDetail";

/**
 * The club's year, for the console overview.
 *
 * The tasks above it answer "what is waiting on me today". This answers the
 * other question an owner opens the console with, which the app has never been
 * able to answer: is the club going anywhere. Legacy puts the same shapes on
 * its owner dashboard, and the full set of them is a later milestone; these
 * four are the ones that need no new columns.
 *
 * Both queries are caught. A chart is not worth failing the page an owner
 * opens to find out somebody is waiting on them.
 */

export type ClubPulse = {
  /** Tables booked and members joined, month by month, over the same run. */
  months: { key: string; label: string; tables: number; joined: number }[];
  nights: NightCount[];
  tiers: MixSlice[];
  tables: { total: number; now: number; before: number; delta: number };
  members: { total: number; joinedInWindow: number };
  /** False when nothing has happened yet, so the page can say so plainly. */
  hasHistory: boolean;
};

const MONTHS_BACK = 12;

export async function getClubPulse(
  clubId: number, tiers: MembershipTier[], today = londonToday(),
): Promise<ClubPulse> {
  const start = firstOfMonth(today, MONTHS_BACK - 1);

  const [dates, members] = await Promise.all([
    // Only what has happened. A table booked for next Thursday is not a
    // measure of how the year went, and it would make the current month look
    // like a spike every time somebody booked ahead.
    findBookingDates(clubId, start, today).catch(() => [] as string[]),
    findMembershipPulse(clubId).catch(() => [] as { joined_at: string | null; tier_key: string | null }[]),
  ]);

  const tableMonths = countByMonth(dates, today, MONTHS_BACK);
  const joinMonths = countByMonth(members.map((m) => m.joined_at), today, MONTHS_BACK);
  const change = changeOnLastMonth(tableMonths);

  return {
    months: tableMonths.map((m, i) => ({
      key: m.key, label: m.label, tables: m.value, joined: joinMonths[i]?.value ?? 0,
    })),
    nights: byWeekday(dates),
    tiers: tierMix(members.map((m) => ({ tierKey: m.tier_key })),
                   tiers.map((t) => ({ tierKey: t.key, label: t.label }))),
    tables: { total: dates.length, ...change },
    members: {
      total: members.length,
      joinedInWindow: joinMonths.reduce((n, m) => n + m.value, 0),
    },
    hasHistory: dates.length > 0 || members.length > 0,
  };
}

/** The first of the month `back` months before the one `today` falls in. */
function firstOfMonth(today: string, back: number): string {
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return today;
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));
  return start.toISOString().slice(0, 10);
}
