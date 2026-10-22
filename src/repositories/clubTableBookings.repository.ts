import "server-only";

import { callRpc } from "@/lib/supabase/table";
import type { BookingFacet } from "@/utils/booking-facets";
import type { TablePaymentStatus, TableSort, TableTab } from "@/utils/table-bookings";

/**
 * The club's own side of a table booking.
 *
 * Everything goes through 0205's functions rather than a typed select, for two
 * separate reasons and both of them matter:
 *
 *  - `payment_status` and the three columns beside it are not in the generated
 *    `database.ts` until it is regenerated, and `check:columns` is right to
 *    refuse a select naming a column its schema has never heard of.
 *  - the write must not be a column grant. `club_bookings` carries three
 *    permissive UPDATE policies and PostgreSQL ORs them, so granting the
 *    payment columns to `authenticated` would let a member mark their own
 *    table paid. The guard lives in `club_set_booking_payment`.
 */

export type TableBookingRpcRow = {
  booking_id: number;
  session_date: string;
  session_label: string | null;
  session_time: string | null;
  table_index: number;
  game_title: string | null;
  booked_by: string | null;
  booked_name: string | null;
  opponent_name: string | null;
  status: string;
  payment_status: TablePaymentStatus;
  payment_method: string | null;
  payment_note: string | null;
  paid_at: string | null;
  base_price: number | string | null;
  tier_label: string | null;
  tier_percent: number | null;
  tier_amount: number | string | null;
  points_spent: number | null;
  points_amount: number | string | null;
  total_price: number | string | null;
  currency: string | null;
  booked_at: string;
  total_rows: number | string | null;
};

export type TableBookingFilters = {
  tab: TableTab;
  query: string;
  /** "YYYY-MM", or empty for every night the club has ever run. */
  month: string;
  sort: TableSort;
  page: number;
  per: number;
};

export function findTableBookings(clubId: number, filters: TableBookingFilters) {
  return callRpc<TableBookingRpcRow[] | null>("club_table_bookings", {
    p_club: clubId,
    p_tab: filters.tab,
    p_query: filters.query,
    p_month: filters.month,
    p_sort: filters.sort,
    p_page: filters.page,
    p_per: filters.per,
  });
}

export type TableBookingCounts = {
  all_rows: number | string;
  topay: number | string;
  paid: number | string;
  free: number | string;
  cancelled: number | string;
};

export function findTableBookingCounts(clubId: number, query: string, month: string) {
  return callRpc<TableBookingCounts[] | TableBookingCounts | null>(
    "club_table_booking_counts",
    { p_club: clubId, p_query: query, p_month: month });
}

/**
 * The months, games and players this club has bookings for.
 *
 * One read for three dropdowns, shared by the money screen, the Scores page
 * and the member's past-nights view, so the three cannot offer each other
 * different months.
 *
 * The scope is which question the counts answer: every booking the club has
 * taken, or only the nights that have been played. A picker offering
 * "Sep 2026 (12)" over a page drawing three games is the screen contradicting
 * itself, which is what it did before 0214.
 */
export function findClubBookingFacets(clubId: number, scope: "all" | "played") {
  return callRpc<BookingFacet[] | null>("club_booking_facets",
    { p_club: clubId, p_scope: scope });
}

export type TablePaymentRow = {
  booking_id: number;
  payment_status: TablePaymentStatus;
  payment_method: string | null;
  payment_note: string | null;
  paid_at: string | null;
};

export function setBookingPayment(params: {
  booking: number; status: TablePaymentStatus; method: string; note: string;
}) {
  return callRpc<TablePaymentRow[] | null>("club_set_booking_payment", {
    p_booking: params.booking,
    p_status: params.status,
    p_method: params.method,
    p_note: params.note,
  });
}
