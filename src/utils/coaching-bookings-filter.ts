/**
 * Coaching bookings, as the club sorts through them.
 *
 * The question a club asks this list is "who still owes me, and who am I out
 * of pocket to". The session cards already group by session and answer the
 * other question, "who is coming".
 *
 * The tabs are the event roster's vocabulary minus the one that does not apply:
 * there is no checking in to a coaching session. Cancelled is on here and not
 * on the cards on purpose — a place somebody paid for and then lost is the row
 * this list exists for, and it is exactly what the client could not reach.
 */

import type { Priced } from "./price-lines";
import type { StatusTone } from "./moderation-status";
import { refundTag, type RefundStatus } from "./refund-status";

export type { RefundStatus };

export type CoachingBookingRow = {
  /** The booking's id, which every action on the row acts on. */
  id: number;
  name: string;
  /** Who they are, so the club can open their profile. */
  profileId: string;
  paid: boolean;
  cancelled: boolean;
  refundStatus: RefundStatus;
  /** The club's own words when it called the place off. */
  cancelReason: string;
  /** What the club wrote down when it took the money. The member reads it. */
  paymentNote: string;
  slotId: number;
  title: string;
  /** ISO date of the session, for sorting and for the label. */
  date: string;
  time: string;
  /** What they were charged after their tier and their points, from 0157. */
  total: number;
  pointsSpent: number;
  /** The whole sum, so the club can answer "why is it that much". */
  priced: Priced;
};

export type BookingFilter = "all" | "unpaid" | "paid" | "cancelled" | "refund";
export type BookingSort = "soonest" | "latest";

const fold = (value: string) => value.trim().toLowerCase();

/** A refund the club still has to settle. The whole reason the tab exists. */
export const owesRefund = (row: CoachingBookingRow) => row.refundStatus === "due";

/**
 * Live bookings only, for the two money tabs.
 *
 * A cancelled place is not somebody who still owes you, and counting it as
 * unpaid is how a club chases money for a session that never happened.
 */
const live = (row: CoachingBookingRow) => !row.cancelled;

export function countCoachingBookings(rows: CoachingBookingRow[]) {
  return {
    all: rows.length,
    unpaid: rows.filter((row) => live(row) && !row.paid).length,
    paid: rows.filter((row) => live(row) && row.paid).length,
    cancelled: rows.filter((row) => row.cancelled).length,
    refund: rows.filter(owesRefund).length,
  };
}

function matches(row: CoachingBookingRow, filter: BookingFilter): boolean {
  if (filter === "all") return true;
  if (filter === "cancelled") return row.cancelled;
  if (filter === "refund") return owesRefund(row);
  if (filter === "paid") return live(row) && row.paid;
  return live(row) && !row.paid;
}

export function filterCoachingBookings(
  rows: CoachingBookingRow[],
  { query = "", filter = "all", sort = "soonest" }: {
    query?: string; filter?: BookingFilter; sort?: BookingSort;
  },
): CoachingBookingRow[] {
  const needle = fold(query);

  const kept = rows.filter((row) =>
    matches(row, filter)
    // The member, the session and the club's own cancellation reason, because
    // those are the three things somebody remembers about a row they are
    // looking for.
    && (!needle
        || fold(`${row.name} ${row.title} ${row.cancelReason}`).includes(needle)));

  return [...kept].sort((a, b) => {
    const order = a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
    return sort === "latest" ? -order : order;
  });
}

/**
 * What a row says about itself, in one vocabulary.
 *
 * Rule 11: a status is one tag drawn one way everywhere, and the words belong
 * in one place rather than at the call site. The tones are `StatusChip`'s own:
 * down for something that is off, waiting for something owed, kept for
 * something settled.
 */
export function bookingTags(
  row: CoachingBookingRow,
): { label: string; tone: StatusTone }[] {
  const tags: { label: string; tone: StatusTone }[] = [];
  if (row.cancelled) tags.push({ label: "Called off", tone: "down" });
  // One reading of what a refund looks like, shared with events, merchandise
  // and table bookings. "Refunded" used to be green here, which said the
  // money was settled rather than that it had gone back.
  const refund = refundTag(row.refundStatus);
  if (refund) tags.push(refund);
  return tags;
}

/**
 * The two a coaching place can be in, in the words the other two payment
 * dialogs use. Coaching has no `payment_method` column and no "on the door"
 * against "in advance", so it is the pair rather than the trio: the one word
 * both lists share is "Unpaid", and a status is one vocabulary everywhere.
 */
export const COACHING_PAYMENT_STATES = [
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
] as const;

/** The three refund states, as a club reads them. */
export const REFUND_STATES = [
  { value: "not_due", label: "Nothing owed" },
  { value: "due", label: "Refund due" },
  { value: "refunded", label: "Refunded" },
] as const;
