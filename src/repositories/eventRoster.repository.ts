import "server-only";

import { callRpc, table } from "@/lib/supabase/table";
import { uniquePlayers } from "@/utils/pairings-draw";
import type { DoorRow, PaymentStatus, RefundStatus } from "@/utils/door-list";

/**
 * The door list, and the club's side of a booking.
 *
 * Reading goes through `club_event_door_list`, a definer function, so the
 * capability is checked once in SQL rather than trusted from whatever query
 * this file happens to write. Writing is an ordinary update through the policy
 * 0092 adds, with the zero-row check every guarded write in this codebase has.
 */

type DoorListRow = {
  booking_id: number;
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
  tickets: number;
  total: number | string | null;
  created_at: string;
};

const text = (value: string | null | undefined) => value ?? "";

export async function findDoorList(eventId: number): Promise<DoorRow[]> {
  const rows = await callRpc<DoorListRow[] | null>("club_event_door_list", { p_event: eventId });
  return (rows ?? []).map((row) => ({
    bookingId: row.booking_id,
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
    tickets: row.tickets,
    // `numeric` comes back as a string over PostgREST, and adding two of those
    // concatenates rather than sums.
    total: Number(row.total ?? 0),
    createdAt: row.created_at,
  }));
}

export type PaymentStanding = {
  payment_status: PaymentStatus;
  payment_method: string | null;
  refund_status: RefundStatus;
  cancel_reason: string | null;
};

/**
 * What the club has written down about the money, for bookings somebody is
 * already allowed to read.
 *
 * A second query rather than columns on the typed select, because 0092 is not
 * in the generated types until the user has run it. Merge this into the typed
 * select and delete it after the regeneration.
 */
export async function findPaymentStanding(
  bookingIds: number[],
): Promise<Map<number, PaymentStanding>> {
  if (!bookingIds.length) return new Map();

  const bookings = await table<PaymentStanding & { id: number }>("club_event_bookings");
  const { data, error } = await bookings
    .select("id, payment_status, payment_method, refund_status, cancel_reason")
    .in("id", bookingIds);
  if (error) throw new Error(error.message);

  return new Map((data ?? []).map((row) => [row.id, row]));
}

type BookingRow = { id: number; reference: string | null; profile_id: string | null;
                    full_name: string | null; email: string | null; status: string };

/**
 * One booking, changed by the club.
 *
 * Pinned to the event as well as the booking, and matched on the states the
 * change is valid from, so an owner working from a list that loaded a minute
 * ago cannot check in somebody who has since cancelled.
 */
async function change(
  eventId: number, bookingId: number,
  patch: Record<string, unknown>, fromStates: string[],
): Promise<BookingRow> {
  const bookings = await table<BookingRow>("club_event_bookings");
  const { data, error } = await bookings
    .update(patch)
    .eq("id", bookingId).eq("event_id", eventId).in("status", fromStates)
    .select("id, reference, profile_id, full_name, email, status")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

export function recordPayment(
  eventId: number, bookingId: number,
  status: PaymentStatus, method: string, note: string,
) {
  // `paid_at` is stamped by the trigger in 0092 rather than sent from here:
  // when somebody paid is a fact about the row, not something a form names.
  return change(eventId, bookingId,
    { payment_status: status, payment_method: method, payment_note: note },
    ["reserved"]);
}

export function checkIn(eventId: number, bookingId: number, arrived: boolean) {
  return change(eventId, bookingId,
    { checked_in_at: arrived ? new Date().toISOString() : null }, ["reserved"]);
}

export function cancelBooking(eventId: number, bookingId: number, reason: string) {
  // The trigger stamps who and when, and flips the refund to due when the
  // place had been paid for.
  return change(eventId, bookingId, { status: "cancelled", cancel_reason: reason },
    ["reserved"]);
}

export function setRefundStatus(eventId: number, bookingId: number, status: RefundStatus) {
  return change(eventId, bookingId, { refund_status: status }, ["cancelled", "reserved"]);
}

export function editBooking(
  eventId: number, bookingId: number, fields: { full_name: string; email: string; notes: string },
) {
  return change(eventId, bookingId, fields, ["reserved", "cancelled"]);
}

/**
 * Who the cancellation took out, for telling them it is back on.
 *
 * Matched on the wording 0092 writes when it cancels a place on the event's
 * behalf, so somebody who gave their own place back beforehand is left alone.
 */
export async function findCancelledByEvent(eventId: number) {
  const bookings = await table<{
    profile_id: string | null; email: string | null;
    full_name: string | null; reference: string | null;
  }>("club_event_bookings");

  const { data, error } = await bookings
    .select("profile_id, email, full_name, reference")
    .eq("event_id", eventId)
    .eq("status", "cancelled")
    .eq("cancel_reason", "The event was called off");
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    profileId: row.profile_id,
    email: text(row.email),
    fullName: text(row.full_name),
    reference: text(row.reference),
  }));
}

/**
 * The roster as people the draw can use: everybody still holding a place.
 *
 * Names come off the booking rather than the profile, because a booking made
 * for somebody else carries the name that is actually turning up.
 *
 * One row per person, not per booking. Somebody who booked six times is one
 * player, and left as they came they were paired with the same opponent three
 * times and once with themselves.
 */
export async function findRosterPlayers(eventId: number) {
  const list = await findDoorList(eventId);
  return uniquePlayers(list
    .filter((row) => row.status !== "cancelled")
    .map((row) => ({ profileId: row.profileId, name: row.fullName.trim() })));
}

/**
 * Whose place this is, or nobody's.
 *
 * `club_event_bookings.profile_id` is not in any column grant (0015 gives
 * `status` and nothing else), and it should not be: attaching a result to an
 * account is `may_link_profile`'s question since 0177, not a column's.
 */
export const setBookingMember = (
  bookingId: number, profileId: string | null, code: string,
) => callRpc<boolean>("set_booking_member", {
  p_booking: bookingId, p_profile: profileId, p_code: code,
});

/**
 * The club putting somebody on the list (0179).
 *
 * Through a function rather than an insert, because `club_event_bookings` has
 * had insert revoked from `authenticated` since 0015 and should keep it: the
 * money columns and the tier the price is frozen against are not things a
 * caller may name. The function reads the named person's tier itself.
 */
export const addEventBooking = (params: {
  eventId: number;
  /** Null for somebody with no account, which is the ordinary door case. */
  profileId: string | null;
  fullName: string;
  email: string;
  reference: string;
  ticketTypeId: number;
  quantity: number;
}) => callRpc<number>("club_add_event_booking", {
  p_event: params.eventId,
  p_profile: params.profileId,
  p_name: params.fullName,
  p_email: params.email,
  p_reference: params.reference,
  p_ticket_type: params.ticketTypeId,
  p_quantity: params.quantity,
});
