/**
 * A club's event sales, as the club's own events page may report them.
 *
 * The client, item r: "it shows 29 tickets sold, but we only have 28 in total
 * across all events?" Both figures were honest and neither could be checked
 * against the other.
 *
 * A booking outlives the publishing of the event it is on. A club that takes
 * an event down keeps whoever had booked it, so the places stay counted while
 * the event itself is hidden from both lists on that page: the header added up
 * events the page was forbidden to show. And the ranking underneath was built
 * from whichever page of past events happened to be on screen, so a club a few
 * seasons in got bars for twelve events under a total of forty.
 *
 * One read answers both, so the bars add up to the figure above them whatever
 * is on screen. Published only, because that is what the page shows; the
 * console's own events list is where a club sees everything it has.
 */
export type SalesTotals = { bookings: number; tickets: number; due: number };

/**
 * What one event sold. Declared here rather than imported, because a util
 * imports from nothing: `EventSales` in the service is this plus whatever the
 * service needs, and structural typing is what lets a page hand its map
 * straight over.
 */
export type SoldEvent = SalesTotals & { title: string; status: string };

const ZERO: SalesTotals = { bookings: 0, tickets: 0, due: 0 };

/** How many bars a ranking carries before it stops being one. */
export const RANKED_EVENTS = 8;

export function publishedSales(sales: Map<number, SoldEvent> | undefined): {
  totals: SalesTotals | null;
  ranked: { label: string; value: number }[];
} {
  if (!sales) return { totals: null, ranked: [] };

  const live = [...sales.values()].filter((one) => one.status === "published");

  const totals = live.reduce(
    (t, one) => ({
      bookings: t.bookings + one.bookings,
      tickets: t.tickets + one.tickets,
      due: t.due + one.due,
    }),
    ZERO,
  );

  const ranked = live
    .map((one) => ({ label: one.title, value: one.tickets }))
    // A row of zeroes is a list, not a ranking.
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, RANKED_EVENTS);

  return { totals, ranked };
}
