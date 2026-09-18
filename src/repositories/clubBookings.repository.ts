import "server-only";

import { callRpc, table } from "@/lib/supabase/table";
import { orIlike } from "@/utils/postgrest";
import type { DoorTab, PaymentStatus, RefundStatus } from "@/utils/door-list";
import { PER_PAGE } from "@/utils/paging";
import type { ClubBookingRow } from "@/types/eventEditor";

/**
 * Every event booking a club holds, across every event.
 *
 * The roster answers "who is coming on Saturday". This answers the other
 * question a club with ten events a year has: "who still owes me anything, on
 * anything". Legacy has no such screen; the shop's orders queue and the
 * coaching bookings list are the shape it copies.
 *
 * Filtered and paged in SQL rather than in the browser. A club a few seasons
 * in has a thousand of these, and shipping all of them to filter five of them
 * out is the thing `CLAUDE.md` says not to do.
 */

type Row = {
  id: number;
  event_id: number;
  profile_id: string | null;
  full_name: string | null;
  email: string | null;
  reference: string | null;
  status: string;
  payment_status: PaymentStatus;
  payment_method: string | null;
  checked_in_at: string | null;
  refund_status: RefundStatus;
  cancel_reason: string | null;
  notes: string | null;
  total: number | string | null;
  created_at: string;
  club_events: { id: number; title: string; legacy_id: string; start_date: string | null } | null;
  club_event_booking_items: { quantity: number }[] | null;
};

const COLUMNS = `id, event_id, profile_id, full_name, email, reference, status,
  payment_status, payment_method, checked_in_at, refund_status, cancel_reason, notes,
  total, created_at,
  club_events!inner(id, title, legacy_id, start_date),
  club_event_booking_items(quantity)`;

export type BookingFilters = {
  tab: DoorTab;
  query: string;
  /** One event, or 0 for all of them. */
  eventId: number;
  sort: "name" | "newest" | "value";
  page: number;
};

/**
 * The same five groups `door-list.ts` splits a roster into, said in PostgREST.
 *
 * The two have to agree, because the tab a row lands in here decides which
 * count it is under and the roster shows the same row under the same word.
 */
function narrow<T>(query: T, tab: DoorTab): T {
  const q = query as unknown as {
    eq(c: string, v: string | number | boolean): T;
    neq(c: string, v: string | number | boolean): T;
    is(c: string, v: null | boolean): T;
    not(c: string, op: string, v: null): T;
  };

  switch (tab) {
    case "cancelled": return q.eq("status", "cancelled");
    // Everything else is about people who still hold a place, so a
    // cancellation drops out rather than sitting in Reserved looking live.
    case "paid": return (q.neq("status", "cancelled") as unknown as typeof q)
      .neq("payment_status", "unpaid");
    case "checkedin": return (q.neq("status", "cancelled") as unknown as typeof q)
      .not("checked_in_at", "is", null);
    case "reserved": return ((q.neq("status", "cancelled") as unknown as typeof q)
      .eq("payment_status", "unpaid") as unknown as typeof q)
      .is("checked_in_at", null);
    default: return query;
  }
}

function toRow(row: Row): ClubBookingRow {
  const text = (value: string | null | undefined) => value ?? "";
  return {
    bookingId: row.id,
    profileId: row.profile_id,
    fullName: text(row.full_name),
    email: text(row.email),
    reference: text(row.reference),
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: text(row.payment_method),
    checkedInAt: row.checked_in_at,
    refundStatus: row.refund_status,
    cancelReason: text(row.cancel_reason),
    notes: text(row.notes),
    tickets: (row.club_event_booking_items ?? []).reduce((n, i) => n + i.quantity, 0),
    // `numeric` arrives as a string over PostgREST, and adding two of those
    // concatenates.
    total: Number(row.total ?? 0),
    createdAt: row.created_at,
    eventId: row.club_events?.id ?? row.event_id,
    eventTitle: row.club_events?.title ?? "",
    eventLegacyId: row.club_events?.legacy_id ?? "",
    eventStartDate: row.club_events?.start_date ?? null,
  };
}

export async function findClubBookings(
  clubId: number, filters: BookingFilters,
): Promise<{ rows: ClubBookingRow[]; total: number }> {
  const bookings = await table<Row>("club_event_bookings");

  let query = bookings.select(COLUMNS, { count: "exact" }).eq("club_id", clubId);
  query = narrow(query, filters.tab);
  if (filters.eventId) query = query.eq("event_id", filters.eventId);
  // Name, email and reference: the three things somebody at the door has.
  if (filters.query) query = query.or(orIlike(["full_name", "email", "reference"], filters.query));

  query = filters.sort === "value" ? query.order("total", { ascending: false })
    : filters.sort === "name" ? query.order("full_name", { ascending: true })
    : query.order("created_at", { ascending: false });

  const from = (Math.max(1, filters.page) - 1) * PER_PAGE.rows;
  const { data, error, count } = await query.range(from, from + PER_PAGE.rows - 1);
  if (error) throw new Error(error.message);

  return { rows: (data ?? []).map(toRow), total: count ?? 0 };
}

/**
 * Everything the tab row and the pickers need, in one round trip.
 *
 * This was nine queries: five to count the five states, two to list the events
 * for the picker, two more for the Events tab's own badge. Measured against the
 * dev project, every query costs about 215ms whatever it asks for, so those
 * nine were two seconds of waiting before a single row was drawn.
 */
export type BookingsSummary = {
  events: number;
  counts: Record<DoorTab, number>;
  picker: { id: number; title: string; bookings: number }[];
};

export async function findBookingsSummary(
  clubId: number, eventId: number,
): Promise<BookingsSummary> {
  return callRpc<BookingsSummary>("club_event_bookings_summary",
    { p_club: clubId, p_event: eventId });
}
