/**
 * Coaching bookings, as the club sorts through them.
 *
 * The question a club asks this list is "who still owes me", which is why the
 * tabs are paid and not paid rather than the session they are on. The session
 * cards already group by session and answer the other question.
 */

export type CoachingBookingRow = {
  /** The booking's id, which is what marking it paid acts on. */
  id: number;
  name: string;
  paid: boolean;
  /** The session it is on, for the second filter. */
  slotId: number;
  title: string;
  /** ISO date of the session, for sorting and for the label. */
  date: string;
  time: string;
  price: string | null;
  /** The session was called off. They are still on the list, and may be owed. */
  cancelled: boolean;
};

export type BookingFilter = "all" | "unpaid" | "paid";
export type BookingSort = "soonest" | "latest";

const fold = (value: string) => value.trim().toLowerCase();

export function countCoachingBookings(rows: CoachingBookingRow[]) {
  return {
    all: rows.length,
    unpaid: rows.filter((row) => !row.paid).length,
    paid: rows.filter((row) => row.paid).length,
  };
}

export function filterCoachingBookings(
  rows: CoachingBookingRow[],
  { query = "", filter = "all", sort = "soonest" }: {
    query?: string; filter?: BookingFilter; sort?: BookingSort;
  },
): CoachingBookingRow[] {
  const needle = fold(query);

  const kept = rows.filter((row) =>
    (filter === "all" || (filter === "paid" ? row.paid : !row.paid))
    // The member and the session, because a club searches for whichever of the
    // two it has in front of it.
    && (!needle || fold(`${row.name} ${row.title}`).includes(needle)));

  return [...kept].sort((a, b) => {
    const order = a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
    return sort === "latest" ? -order : order;
  });
}
