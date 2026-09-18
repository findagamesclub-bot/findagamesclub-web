import "server-only";

import * as repo from "@/repositories/eventRoster.repository";
import { notifyPlaceCancelled, notifyPaymentRecorded } from "./event-notify.service";
import { toCsv, csvFilename } from "@/utils/csv";
import { PAYMENT_LABELS, REFUND_LABELS, type DoorRow, type PaymentStatus, type RefundStatus }
  from "@/utils/door-list";
import { formatMoney } from "@/utils/format";
import { rosterRefusal } from "@/utils/event-refusals";
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
  fields: { fullName: string; email: string; notes: string },
): Promise<Result> {
  if (!fields.fullName.trim()) return { ok: false, error: "A booking needs a name on it." };

  try {
    await repo.editBooking(eventId, bookingId, {
      full_name: fields.fullName.trim(),
      email: fields.email.trim(),
      notes: fields.notes.trim(),
    });
    return { ok: true, notice: "Saved." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
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
