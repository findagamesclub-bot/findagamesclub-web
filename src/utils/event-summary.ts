import { londonNow } from "./dates";
import type { ClubEventSummary } from "@/types/clubDetail";

/** The row shape both the club page and the owner's list read from. */
type EventRow = {
  id: number;
  legacy_id: string;
  title: string;
  summary: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  event_type: string | null;
  price: string | null;
  round_count: number | null;
  tickets_available: number | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_postcode: string | null;
};

/**
 * Is this event over?
 *
 * Nothing marks an event complete; there is no such field and no button. It is
 * decided from the dates every time anybody looks, matching legacy's
 * `_event_has_ended` (club_store.py:23144), including two rules that are easy
 * to get wrong:
 *
 * - **An undated event counts as over.** It cannot be attended and it should
 *   not sit at the top of "coming up" forever.
 * - **The end time decides the last day.** An event finishing at 17:00 is over
 *   at 17:00, not at midnight. Without an end time it runs to the end of the
 *   day, which is what legacy's `datetime.max.time()` means.
 *
 * London wall-clock on both sides, so the answer does not change with who is
 * looking at it.
 */
export function hasEnded(
  endDate: string | null,
  startDate: string | null,
  endTime: string | null = null,
  now: { date: string; time: string } = londonNow(),
): boolean {
  const last = endDate ?? startDate;
  if (!last) return true;
  if (last !== now.date) return last < now.date;
  // On the day itself, only an end time can call it finished.
  return endTime ? endTime < now.time : false;
}

export function toEventSummary(e: EventRow): ClubEventSummary {
  return {
    id: e.id,
    slug: e.legacy_id,
    title: e.title,
    summary: e.summary,
    startDate: e.start_date,
    startTime: e.start_time,
    endDate: e.end_date,
    endTime: e.end_time,
    eventType: e.event_type,
    price: e.price,
    roundCount: e.round_count,
    ticketsAvailable: e.tickets_available,
    venueName: e.venue_name,
    venue: {
      name: e.venue_name,
      address: e.venue_address,
      postcode: e.venue_postcode,
    },
    hasEnded: hasEnded(e.end_date, e.start_date, e.end_time),
  };
}

/** Soonest first for what is coming, most recent first for what has been. */
export function splitByDate<T extends ClubEventSummary>(events: T[]) {
  const byDate = [...events].sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  return {
    upcoming: byDate.filter((e) => !e.hasEnded),
    past: byDate.filter((e) => e.hasEnded).reverse(),
  };
}
