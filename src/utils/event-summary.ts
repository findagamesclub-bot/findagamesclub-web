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
  event_type: string | null;
  price: string | null;
  round_count: number | null;
  tickets_available: number | null;
  venue_name: string | null;
};

/** An event is over once its end date has passed; undated events stay upcoming. */
export function hasEnded(
  endDate: string | null,
  startDate: string | null,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  const last = endDate ?? startDate;
  if (!last) return false;
  return last < today;
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
    eventType: e.event_type,
    price: e.price,
    roundCount: e.round_count,
    ticketsAvailable: e.tickets_available,
    venueName: e.venue_name,
    hasEnded: hasEnded(e.end_date, e.start_date),
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
