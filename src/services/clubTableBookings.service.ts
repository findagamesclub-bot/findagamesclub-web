import "server-only";

import * as repo from "@/repositories/clubTableBookings.repository";
import { splitFacets, NO_FACETS, type BookingFacets } from "@/utils/booking-facets";
import { PER_PAGE } from "@/utils/paging";
import type {
  TableBookingRow, TableBookingSide, TablePaymentStatus, TableSort, TableTab,
} from "@/utils/table-bookings";
import type { RefundStatus } from "@/utils/refund-status";

/**
 * Every table a club has booked, filtered and counted in SQL.
 *
 * The coaching bookings list reads everything and sifts it in the browser,
 * which is right at fifty rows. This is not that: ten tables twice a week is a
 * thousand a year, so a club a few seasons in is well past the point where
 * shipping the lot to hide most of it is defensible. Same call the club-wide
 * event bookings list made, and for the same reason.
 */

export type TableBookingsResult = {
  rows: TableBookingRow[];
  total: number;
  /** Null when the read failed, so the page can say so rather than draw none. */
  counts: Record<TableTab, number> | null;
  /** What there is to narrow by. Empty lists draw no pickers. */
  facets: BookingFacets;
  failed: boolean;
};

const num = (value: number | string | null | undefined) => Number(value ?? 0);
const text = (value: string | null | undefined) => value ?? "";

function toRow(row: repo.TableBookingRpcRow): TableBookingRow {
  return {
    bookingId: row.booking_id,
    side: row.side,
    sessionDate: row.session_date,
    sessionLabel: text(row.session_label),
    sessionTime: text(row.session_time),
    tableIndex: Number(row.table_index ?? 0),
    gameTitle: text(row.game_title),
    // The person this half belongs to, and who they are playing. A guest has
    // no account, so the id can be null on either side.
    bookedById: row.person_id,
    bookedName: text(row.person_name) || "A member",
    opponentName: text(row.against_name),
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: text(row.payment_method),
    paymentNote: text(row.payment_note),
    paidAt: row.paid_at,
    // The whole sum, in the shape `PriceBreakdown` already draws everywhere
    // else money is explained. `numeric` arrives as a string over PostgREST
    // and adding two of those concatenates, hence `num` on every figure.
    priced: {
      subtotal: num(row.base_price),
      tierLabel: row.tier_label || null,
      tierPercent: num(row.tier_percent),
      tierAmount: num(row.tier_amount),
      points: num(row.points_spent),
      pointsAmount: num(row.points_amount),
      total: num(row.total_price),
      currency: text(row.currency) || "GBP",
    },
    total: num(row.total_price),
    bookedAt: row.booked_at,
    // `not_due` for a row read before 0229, which is every booking the club
    // took until this week. A null here would draw a tag that says nothing.
    refundStatus: (text(row.refund_status) || "not_due") as RefundStatus,
    refundedAt: row.refunded_at,
    refundMethod: text(row.refund_method),
    refundNote: text(row.refund_note),
  };
}

export async function getTableBookings(
  clubId: number,
  filters: { tab: TableTab; query: string; month: string; night: string;
             sort: TableSort; page: number },
): Promise<TableBookingsResult> {
  const per = PER_PAGE.rows;

  // One wave. None of the three needs another's answer, and each costs a
  // round trip of about 300ms whatever it asks for.
  const [listed, counted, facets] = await Promise.all([
    repo.findTableBookings(clubId, { ...filters, per }).catch((error) => {
      console.error("[table bookings] the list did not load", error);
      return null;
    }),
    // Narrowed by the month as well as the search: "To pay 3" under September
    // has to mean three in September, which is 0118's rule on a second axis.
    repo.findTableBookingCounts(clubId, filters.query, filters.month, filters.night)
      .catch((error) => {
      console.error("[table bookings] the counts did not load", error);
      return null;
    }),
    // Every booking, cancelled and still to come included: this screen is
    // about the money the club has taken, not about what was played.
    // The month goes in so the nights that come back are that month's. Every
    // other facet here is the club's whole history; the nights are not, for
    // the reason 0228 gives.
    repo.findClubBookingFacets(clubId, "all", filters.month).catch((error) => {
      console.error("[table bookings] the months did not load", error);
      return null;
    }),
  ]);

  const rows = (listed ?? []).map(toRow);
  // The window function returns the same figure on every row, so any row will
  // do and an empty page means an empty list.
  const total = listed?.length ? num(listed[0]!.total_rows) : 0;

  const raw = Array.isArray(counted) ? counted[0] : counted;
  const counts = raw
    ? {
        all: num(raw.all_rows),
        topay: num(raw.topay),
        paid: num(raw.paid),
        free: num(raw.free),
        cancelled: num(raw.cancelled),
        refunddue: num(raw.refunddue),
        refunded: num(raw.refunded),
      }
    : null;

  return {
    rows, total, counts,
    // A failed facets read costs the pickers, never the list: a month picker
    // is how you narrow this screen, not how you read it.
    facets: facets ? splitFacets(facets) : NO_FACETS,
    failed: listed === null,
  };
}

export type TablePaymentResult = { ok: true } | { ok: false; error: string };

const REFUSALS: Record<string, string> = {
  NOT_PERMITTED: "You cannot change the money on that booking.",
  BOOKING_NOT_FOUND: "That booking is not here any more.",
  BOOKING_NOT_LIVE:
    "That table was cancelled, so there is nothing left to settle on it.",
  BOOKING_PAYMENT_UNKNOWN: "Pick one of the payment states from the list.",
  BOOKING_SIDE_UNKNOWN: "That is not one of the two seats on the table.",
  BOOKING_NO_OPPONENT:
    "Nobody is down on the other seat, so there is no second half to settle.",
  REFUND_STATUS_UNKNOWN: "Pick one of the three refund states from the list.",
  BOOKING_NOT_PAID:
    "Nothing was taken on that half, so there is nothing to give back.",
};

/**
 * Money going back on one half (0229).
 *
 * Its own call rather than more arguments on the payment write, because the
 * two answer different questions and the dialog may change one without the
 * other. Same refusal map, because the guards it can hit are the same ones.
 */
export async function setTableRefund(params: {
  booking: number; side: TableBookingSide;
  status: RefundStatus; method: string; note: string;
}): Promise<TablePaymentResult> {
  try {
    await repo.setBookingRefund(params);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = Object.keys(REFUSALS).find((key) => message.includes(key));
    if (!code) console.error("[table bookings] an unmapped refund refusal", error);
    return { ok: false, error: code ? REFUSALS[code]! : "That did not save. Try again." };
  }
}

export async function setTablePayment(params: {
  booking: number; side: TableBookingSide;
  status: TablePaymentStatus; method: string; note: string;
}): Promise<TablePaymentResult> {
  try {
    await repo.setBookingPayment(params);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = Object.keys(REFUSALS).find((key) => message.includes(key));
    if (!code) {
      // Logged rather than discarded. Everything that is not a code we know
      // about became "that did not save" with the cause thrown away, which
      // cost two rounds of guessing at something the server knew.
      console.error("[table bookings] an unmapped refusal", error);
    }
    return { ok: false, error: code ? REFUSALS[code]! : "That did not save. Try again." };
  }
}
