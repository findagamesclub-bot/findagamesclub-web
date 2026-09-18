/**
 * Searching, grouping and ordering the tickets a member holds.
 *
 * The same three questions the memberships, coaching and orders lists answer,
 * asked of tickets: what am I going to, what do I still owe, and where is that
 * reference I need at the door.
 *
 * Pure, and the date is passed in rather than read, so a ticket does not
 * change group at midnight in the middle of a test.
 */

import { fold } from "./text";
import type { PaymentStatus } from "./door-list";

export const TICKET_TABS =
  ["all", "upcoming", "topay", "paid", "past", "cancelled"] as const;
export type TicketTab = (typeof TICKET_TABS)[number];

export const TICKET_SORTS = ["soonest", "latest", "booked"] as const;
export type TicketSort = (typeof TICKET_SORTS)[number];

/** Everything the grouping needs. `EventBooking` already satisfies it. */
export type TicketLike = {
  reference: string;
  eventTitle: string;
  clubName: string;
  eventDate: string | null;
  status: string;
  paymentStatus: PaymentStatus;
  total: number;
  createdAt: string;
};

const cancelled = (t: TicketLike) => t.status === "cancelled";

/**
 * Past once the day itself is behind us, on London wall-clock dates, the same
 * rule the club side uses. A ticket with no date on it has not happened.
 */
const over = (t: TicketLike, today: string) => Boolean(t.eventDate) && t.eventDate! < today;

function inTab(t: TicketLike, tab: TicketTab, today: string): boolean {
  if (tab === "all") return true;
  if (tab === "cancelled") return cancelled(t);
  // A cancelled ticket is not something you are going to, nor something you
  // owe for. It only appears under All and Cancelled.
  if (cancelled(t)) return false;
  if (tab === "past") return over(t, today);
  if (tab === "upcoming") return !over(t, today);
  // Settled, whichever way the club recorded it. The stub says which.
  if (tab === "paid") return t.paymentStatus !== "unpaid";
  // Still to pay, whether the day has been and gone or not: money owed on a
  // tournament last month is still money owed.
  return t.paymentStatus === "unpaid";
}

export function countTickets(
  tickets: TicketLike[], today: string,
): Record<TicketTab, number> {
  const counts: Record<TicketTab, number> = {
    all: 0, upcoming: 0, topay: 0, paid: 0, past: 0, cancelled: 0,
  };
  for (const tab of TICKET_TABS) counts[tab] = tickets.filter((t) => inTab(t, tab, today)).length;
  return counts;
}

export function filterTickets<T extends TicketLike>(
  tickets: T[],
  params: { tab: TicketTab; query?: string; sort?: TicketSort; today: string },
): T[] {
  const needle = fold(params.query ?? "");

  const rows = tickets.filter((t) => {
    if (!inTab(t, params.tab, params.today)) return false;
    if (!needle) return true;
    // The event, the club and the reference: the three things somebody has in
    // mind when they come looking for one of these.
    return fold(t.eventTitle).includes(needle)
      || fold(t.clubName).includes(needle)
      || fold(t.reference).includes(needle);
  });

  const sort = params.sort ?? "soonest";
  return [...rows].sort((a, b) => {
    if (sort === "booked") return b.createdAt.localeCompare(a.createdAt);
    // An undated event sorts last either way, rather than to the top as an
    // empty string would.
    if (!a.eventDate || !b.eventDate) {
      return (a.eventDate ? 0 : 1) - (b.eventDate ? 0 : 1)
        || b.createdAt.localeCompare(a.createdAt);
    }
    return sort === "latest"
      ? b.eventDate.localeCompare(a.eventDate)
      : a.eventDate.localeCompare(b.eventDate);
  });
}

/** Whether giving this place back is still a thing that makes sense. */
export function canCancel(t: TicketLike, today: string): boolean {
  return !cancelled(t) && !over(t, today);
}
