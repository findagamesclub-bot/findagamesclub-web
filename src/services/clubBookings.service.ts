import "server-only";

import * as repo from "@/repositories/clubBookings.repository";
import { DOOR_SORTS, DOOR_TABS, owed, type DoorSort, type DoorTab }
  from "@/utils/door-list";
import type { ClubBookingRow } from "@/types/eventEditor";

/**
 * A club's bookings across every event it runs.
 *
 * Filters arrive from the URL, so they arrive as strings somebody could have
 * typed. Everything is narrowed to a known value here rather than trusted into
 * a query.
 */

export type BookingsView = {
  rows: ClubBookingRow[];
  total: number;
  counts: Record<DoorTab, number>;
  /** Events with at least one booking, for the picker. */
  events: { id: number; title: string; bookings: number }[];
  /** For the Events tab's badge, so showing Bookings costs nothing extra. */
  eventCount: number;
  /** What is still to collect, across the filter in force. */
  owed: { people: number; amount: number };
  filters: repo.BookingFilters;
};

const asTab = (raw: string | undefined): DoorTab =>
  DOOR_TABS.includes(raw as DoorTab) ? (raw as DoorTab) : "all";

const asSort = (raw: string | undefined): DoorSort =>
  DOOR_SORTS.includes(raw as DoorSort) ? (raw as DoorSort) : "newest";

export function readFilters(query: Record<string, string | string[] | undefined>) {
  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return {
    tab: asTab(one("state")),
    query: (one("q") ?? "").slice(0, 120),
    eventId: Number(one("event")) || 0,
    sort: asSort(one("sort")),
    page: Math.max(1, Math.floor(Number(one("page")) || 1)),
  } satisfies repo.BookingFilters;
}

export async function getClubBookings(
  clubId: number, filters: repo.BookingFilters,
): Promise<BookingsView> {
  // Two round trips: the page of rows, and everything around it. The summary
  // is counted under the chosen event, so every tab describes what is on
  // screen. Tabs reading 340 while the list shows one event's eight is a
  // number nobody can act on.
  const [page, summary] = await Promise.all([
    repo.findClubBookings(clubId, filters),
    repo.findBookingsSummary(clubId, filters.eventId),
  ]);

  return {
    rows: page.rows,
    total: page.total,
    counts: summary.counts,
    events: summary.picker,
    eventCount: summary.events,
    // Off the page in hand rather than the whole club: a figure computed from
    // twenty-five rows and labelled as if it covered a thousand would be a lie
    // the club acts on.
    owed: owed(page.rows),
    filters,
  };
}
