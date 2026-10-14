import "server-only";

import * as repo from "@/repositories/eventRoster.repository";
import { notifyPlaceCancelled, notifyPaymentRecorded } from "./event-notify.service";
import { toCsv, csvFilename } from "@/utils/csv";
import { PAYMENT_LABELS, REFUND_LABELS, type DoorRow, type PaymentStatus, type RefundStatus }
  from "@/utils/door-list";
import { formatMoney } from "@/utils/format";
import { rosterRefusal } from "@/utils/event-refusals";
import { makeReference } from "./tickets.service";
import { getBooking } from "./eventBookings.service";
import { notifyBooked } from "./ticket-notify.service";
import type { Result } from "./eventEditor.service";
import type { EventFacts } from "@/types/eventEditor";

/**
 * The list a club works from on the day.
 *
 * Every write here is a fact about a booking somebody else made, so each one
 * tells that person: being marked as paid, or losing a place, is not something
 * to find out by opening the site.
 */

function refusalOf(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const said = rosterRefusal(raw);
  if (said) return said;
  console.error("[roster] unexpected refusal:", raw);
  return fallback;
}

export function getDoorList(eventId: number): Promise<DoorRow[]> {
  return repo.findDoorList(eventId);
}

export async function recordPayment(
  event: EventFacts, bookingId: number,
  status: PaymentStatus, method: string, note: string, total: number,
): Promise<Result> {
  try {
    const row = await repo.recordPayment(event.id, bookingId, status, method.trim(), note.trim());
    if (status !== "unpaid") {
      await notifyPaymentRecorded(event, {
        profileId: row.profile_id,
        email: row.email ?? "",
        fullName: row.full_name ?? "",
        reference: row.reference ?? "",
        howPaid: [PAYMENT_LABELS[status], method.trim()].filter(Boolean).join(", "),
        total: formatMoney(total, "GBP"),
      });
    }
    return { ok: true, notice: `Marked as ${PAYMENT_LABELS[status].toLowerCase()}.` };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

export async function checkIn(
  eventId: number, bookingId: number, arrived: boolean,
): Promise<Result> {
  try {
    await repo.checkIn(eventId, bookingId, arrived);
    return { ok: true, notice: arrived ? "Checked in." : "Check in undone." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

export async function cancelPlace(
  event: EventFacts, bookingId: number, reason: string,
): Promise<Result> {
  try {
    const row = await repo.cancelBooking(event.id, bookingId, reason.trim());
    await notifyPlaceCancelled(event, {
      profileId: row.profile_id,
      email: row.email ?? "",
      fullName: row.full_name ?? "",
      reference: row.reference ?? "",
      reason: reason.trim(),
    });
    return { ok: true, notice: "Cancelled. They have been told." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not cancel. Try again.") };
  }
}

export async function setRefundStatus(
  eventId: number, bookingId: number, status: RefundStatus,
): Promise<Result> {
  try {
    await repo.setRefundStatus(eventId, bookingId, status);
    return { ok: true, notice: `Marked as ${REFUND_LABELS[status].toLowerCase()}.` };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

export async function editBooking(
  eventId: number, bookingId: number,
  fields: {
    fullName: string; email: string; notes: string;
    /**
     * Whose place it is. Empty means nobody, which is a real answer: a member
     * who bought a ticket and put a friend's name on it leaves a booking
     * carrying their own account and somebody else's name, and clearing it is
     * how the club says so. Undefined means the caller is not editing the
     * link at all, which is the club-wide bookings list.
     */
    memberId?: string;
    memberCode?: string;
  },
): Promise<Result> {
  if (!fields.fullName.trim()) return { ok: false, error: "A booking needs a name on it." };

  try {
    await repo.editBooking(eventId, bookingId, {
      full_name: fields.fullName.trim(),
      email: fields.email.trim(),
      notes: fields.notes.trim(),
    });

    // Second, and only when the dialog asked about it. The name and the
    // account are two different facts and the second is the other person's
    // to agree to, which is why it goes through its own guarded writer
    // rather than riding along on an ordinary update.
    if (fields.memberId !== undefined) {
      await repo.setBookingMember(bookingId,
        fields.memberId.trim() || null, (fields.memberCode ?? "").trim());
    }
    return { ok: true, notice: "Saved." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

/**
 * The club putting somebody on the list (0179).
 *
 * The client: "club owner cannot book event tickets for themselves or for
 * another member." Booking their own place is the ordinary desk, which the
 * event page now shows them. This is the other case, and it is the one that
 * actually happens on the day: somebody turns up, hands over cash, and wants
 * to be on the list.
 *
 * `p_profile` is optional on purpose. Most people at a door have no account,
 * and inventing one for them would be worse than a name on a list. Where a
 * member IS named, the place is theirs: it shows on their own tickets, earns
 * them loyalty points, and is priced off their tier.
 *
 * The confirmation goes to the address on the booking, which is the rule
 * 0096 already learned the hard way: the person who is actually coming is the
 * person who has to be told. Told, not blocked on, like every other mail here.
 */
export async function addPlace(
  event: EventFacts,
  fields: {
    profileId: string | null; fullName: string; email: string;
    ticketTypeId: number; quantity: number;
  },
): Promise<Result> {
  const fullName = fields.fullName.trim();
  const email = fields.email.trim().toLowerCase();

  if (!fullName) return { ok: false, error: "A place needs a name on it." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That email address does not look right." };
  }
  if (!Number.isFinite(fields.ticketTypeId) || fields.ticketTypeId <= 0) {
    return { ok: false, error: "Pick which ticket they are on." };
  }

  const quantity = Math.max(1, Math.floor(fields.quantity || 1));
  const reference = makeReference();

  try {
    await repo.addEventBooking({
      eventId: event.id, profileId: fields.profileId,
      fullName, email, reference, ticketTypeId: fields.ticketTypeId, quantity,
    });
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }

  // Read back rather than assembling it here, so the confirmation says what
  // was actually written. It has to be read in every case, not only when an
  // address was typed: a named member with the box left blank takes their own
  // account address, which 0180 fills in and this layer never sees.
  const booking = await getBooking(reference).catch(() => null);
  if (booking?.email) await notifyBooked(booking).catch(() => undefined);

  return {
    ok: true,
    notice: booking?.email
      ? `Added. ${fullName} has their reference at ${booking.email}.`
      : `Added. Quote ${reference} on the door.`,
  };
}

/**
 * The door list as a spreadsheet.
 *
 * Every column the club works from on the day, cancellations included: a name
 * that turns up having been cancelled is exactly the row somebody needs to be
 * able to find.
 */
export function doorListCsv(event: EventFacts, rows: DoorRow[]): {
  filename: string; body: string;
} {
  const body = toCsv(
    ["Name", "Email", "Reference", "Tickets", "Total", "Status", "Payment",
     "How paid", "Checked in", "Refund", "Notes", "Booked"],
    rows.map((row) => [
      row.fullName, row.email, row.reference, row.tickets,
      row.total.toFixed(2),
      row.status === "cancelled" ? "Cancelled" : "Booked",
      PAYMENT_LABELS[row.paymentStatus],
      row.paymentMethod,
      row.checkedInAt ? "Yes" : "No",
      REFUND_LABELS[row.refundStatus],
      [row.notes, row.cancelReason].filter(Boolean).join(" · "),
      row.createdAt.slice(0, 10),
    ]),
  );

  return { filename: csvFilename(["door list", event.title, event.startDate]), body };
}
