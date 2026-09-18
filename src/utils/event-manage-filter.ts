/**
 * Searching and grouping a club's own events.
 *
 * The public list already has `event-filters.ts`, which answers a different
 * question: a visitor asks "what is on near me", a club asks "what am I still
 * writing, what is coming, and what happened". Drafts and cancelled events do
 * not exist in the public one at all.
 */

import { fold } from "./text";

export const MANAGE_EVENT_TABS = ["upcoming", "past", "drafts", "cancelled"] as const;
export type ManageEventTab = (typeof MANAGE_EVENT_TABS)[number];

export const MANAGE_EVENT_SORTS = ["date", "title", "tickets"] as const;
export type ManageEventSort = (typeof MANAGE_EVENT_SORTS)[number];

export type ManageEvent = {
  id: number;
  legacyId: string;
  title: string;
  status: "draft" | "published" | "cancelled";
  startDate: string | null;
  endDate: string | null;
  venueName: string | null;
  /** Live bookings. Cancelled ones are not somebody the club has to seat. */
  bookings: number;
  ticketsAvailable: number | null;
};

/**
 * Past by the same rule as everywhere else: an event is over once its last day
 * is behind us. The comparison is on London wall-clock dates as strings, which
 * is what `londonToday()` returns and what the column holds.
 */
const lastDay = (event: ManageEvent) => event.endDate || event.startDate || "";

export function isPast(event: ManageEvent, today: string): boolean {
  const day = lastDay(event);
  // An event with no date at all is something half written, not something
  // that has happened.
  return day ? day < today : false;
}

function tabOf(event: ManageEvent, today: string): ManageEventTab {
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "draft") return "drafts";
  return isPast(event, today) ? "past" : "upcoming";
}

export function countManageEvents(
  events: ManageEvent[], today: string,
): Record<ManageEventTab, number> {
  const counts: Record<ManageEventTab, number> = {
    upcoming: 0, past: 0, drafts: 0, cancelled: 0,
  };
  for (const event of events) counts[tabOf(event, today)] += 1;
  return counts;
}

export function filterManageEvents(
  events: ManageEvent[],
  params: { tab: ManageEventTab; query?: string; sort?: ManageEventSort; today: string },
): ManageEvent[] {
  const needle = fold(params.query ?? "");

  const rows = events.filter((event) => {
    if (tabOf(event, params.today) !== params.tab) return false;
    if (!needle) return true;
    // Title and venue: an event is found by what it is called or by the hall
    // it runs in, which is how a club with four venues looks for one.
    return fold(event.title).includes(needle) || fold(event.venueName ?? "").includes(needle);
  });

  const sort = params.sort ?? "date";
  // Past events read newest first; everything else reads soonest first. A club
  // looking at last year wants the last one, not the first one they ever ran.
  const newestFirst = params.tab === "past";

  return [...rows].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "tickets") return b.bookings - a.bookings || a.title.localeCompare(b.title);

    const dayA = lastDay(a);
    const dayB = lastDay(b);
    // An undated draft sorts last rather than to 1970.
    if (!dayA || !dayB) return (dayA ? 0 : 1) - (dayB ? 0 : 1) || a.title.localeCompare(b.title);
    return newestFirst ? dayB.localeCompare(dayA) : dayA.localeCompare(dayB);
  });
}
