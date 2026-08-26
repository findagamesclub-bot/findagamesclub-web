import "server-only";

import { findEventsForClubs } from "@/repositories/events.repository";
import { findOwnedClubs } from "@/repositories/ownerInbox.repository";
import { getEventBookingCounts, type EventSales } from "./eventBookings.service";
import { splitByDate, toEventSummary } from "@/utils/event-summary";
import type { ClubEventSummary } from "@/types/clubDetail";

/**
 * Every event across the clubs somebody runs.
 *
 * The owner's question on a Tuesday is "what is on next and is it selling",
 * and the answer used to mean opening each club's page in turn. Ordered by
 * date rather than grouped by club for that reason — four clubs' events
 * interleave in real life.
 */
export type OwnerEvent = ClubEventSummary & {
  club: { id: number; slug: string; name: string };
  sales: EventSales | null;
};

export type OwnerEvents = {
  upcoming: OwnerEvent[];
  past: OwnerEvent[];
  clubCount: number;
  totals: EventSales;
};

const EMPTY: OwnerEvents = {
  upcoming: [], past: [], clubCount: 0,
  totals: { bookings: 0, tickets: 0, due: 0 },
};

export async function getOwnerEvents(profileId: string): Promise<OwnerEvents> {
  const clubs = await findOwnedClubs(profileId);
  if (!clubs.length) return EMPTY;

  const ids = clubs.map((c) => c.id);
  const [rows, sales] = await Promise.all([
    findEventsForClubs(ids),
    getEventBookingCounts(ids),
  ]);

  const events: OwnerEvent[] = rows.map((row) => {
    const club = (row as unknown as { clubs: { id: number; slug: string; name: string } }).clubs;
    return {
      ...toEventSummary(row),
      club: { id: club.id, slug: club.slug, name: club.name },
      sales: sales.get(row.id) ?? null,
    };
  });

  const { upcoming, past } = splitByDate(events);
  const totals = [...sales.values()].reduce(
    (t, s) => ({
      bookings: t.bookings + s.bookings,
      tickets: t.tickets + s.tickets,
      due: t.due + s.due,
    }),
    { bookings: 0, tickets: 0, due: 0 },
  );

  return { upcoming, past, clubCount: clubs.length, totals };
}
