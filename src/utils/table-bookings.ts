import type { Priced } from "./price-lines";

/**
 * Table bookings, as the club reads its own.
 *
 * The night calendar answers "who is playing on Thursday". This answers the
 * question the client asked, which four pages of a calendar cannot: *"we
 * currently have no method to mark applicable table bookings as paid and with
 * notes ... it would be useful to be able to filter a view based on paid or
 * unpaid status"*.
 *
 * `free` is a group because a tier that waives the fee is a real thing a club
 * sells (`waiveGameBookingFee`), priced into the booking by 0043 the moment it
 * is made. A free table is not an unpaid one, and counting it as one is how a
 * club chases somebody for money their membership already covered. The
 * client's own sentence asks for exactly this distinction.
 */

export type TablePaymentStatus = "unpaid" | "paid_on_the_door" | "paid_in_advance";

export type TableBookingSide = "booker" | "opponent";

export type TableBookingRow = {
  bookingId: number;
  /**
   * Which seat of the table this row is about.
   *
   * 0221 split the fee between the people on it, so this list is one row per
   * person per table rather than one per booking: the client's own words were
   * "member A may have paid their half, but member B has not", and a row per
   * booking cannot hold two answers. `bookingId` is therefore not a key here
   * — `${bookingId}:${side}` is.
   */
  side: TableBookingSide;
  sessionDate: string;
  sessionLabel: string;
  sessionTime: string;
  /** A seat index, which starts at 0. Never shown raw: see `tableNumber`. */
  tableIndex: number;
  gameTitle: string;
  /** Whose half this is. Null for a guest, who has no account. */
  bookedById: string | null;
  bookedName: string;
  /** Who they are playing. Empty on a table nobody else is down for. */
  opponentName: string;
  status: string;
  paymentStatus: TablePaymentStatus;
  paymentMethod: string;
  /** What the club wrote beside the money. */
  paymentNote: string;
  paidAt: string | null;
  /** The whole sum, so a row can answer "why is it that much". */
  priced: Priced;
  total: number;
  bookedAt: string;
};

export type TableTab = "all" | "topay" | "paid" | "free" | "cancelled";
export type TableSort = "newest" | "oldest" | "name" | "value";

export const TABLE_TABS: { value: TableTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "topay", label: "To pay" },
  { value: "paid", label: "Paid" },
  { value: "free", label: "Free" },
  { value: "cancelled", label: "Cancelled" },
];

export const TABLE_SORTS: { value: TableSort; label: string }[] = [
  { value: "newest", label: "Latest night first" },
  { value: "oldest", label: "Earliest night first" },
  { value: "name", label: "By name" },
  { value: "value", label: "Most owed first" },
];

/**
 * One vocabulary for a payment, and it is the one the door list already uses.
 *
 * Rule 11: a status is one tag drawn one way everywhere. An event booking and
 * a table booking are the same question asked about two things, so they say it
 * in the same words rather than inventing a second set.
 */
export const TABLE_PAYMENT_LABELS: Record<TablePaymentStatus, string> = {
  unpaid: "Unpaid",
  paid_on_the_door: "Paid on the door",
  paid_in_advance: "Paid in advance",
};

export const isTableTab = (value: string): value is TableTab =>
  TABLE_TABS.some((tab) => tab.value === value);

export const isTableSort = (value: string): value is TableSort =>
  TABLE_SORTS.some((sort) => sort.value === value);

/**
 * Everything a reader needs to say where a table stands on money.
 *
 * Structural rather than the club's own row, because the member's own games
 * page asks the same question of the same booking from the other side of it,
 * and two readings of one ledger is how a club and a member end up being told
 * different things about the same fiver.
 */
export type Payable = {
  status: string;
  total: number;
  paymentStatus: TablePaymentStatus;
};

/** A cancelled table is not somebody who owes you. */
export const tableIsLive = (row: Payable) => row.status === "booked";

/** Their tier covers it, so there is nothing to chase. */
export const tableIsFree = (row: Payable) => row.total <= 0;

export const tableIsPaid = (row: Payable) => row.paymentStatus !== "unpaid";

/**
 * What a row says about itself, in one place rather than at three call sites.
 *
 * Nothing at all for a live, free, unpaid table: "Unpaid" on a table the
 * member's tier covered is the site inventing a debt.
 */
export function tableBookingTag(
  row: Payable,
): { label: string; tone: "down" | "waiting" | "kept" } | null {
  if (!tableIsLive(row)) return { label: "Cancelled", tone: "down" };
  if (tableIsFree(row)) return { label: "Nothing to pay", tone: "kept" };
  if (tableIsPaid(row)) {
    return { label: TABLE_PAYMENT_LABELS[row.paymentStatus], tone: "kept" };
  }
  return { label: "Unpaid", tone: "waiting" };
}
