"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { setTablePayment, setTableRefund } from "@/services/clubTableBookings.service";
import type { TablePaymentStatus } from "@/utils/table-bookings";
import { REFUND_STATUSES, type RefundStatus } from "@/utils/refund-status";

export type TablePaymentState = { error?: string; notice?: string };

const STATES: TablePaymentStatus[] = ["unpaid", "paid_on_the_door", "paid_in_advance"];

/**
 * What the club took for a table.
 *
 * The screen checks the capability so a reader who cannot do this is not shown
 * a button, and `club_set_booking_payment` checks it again, because the anon
 * key is public and a screen is not a guard. The slug is only for revalidating:
 * the function re-derives the club from the booking, so a form that forgets it
 * gets a stale page rather than a refusal.
 */
export async function tablePaymentAction(
  _prev: TablePaymentState, data: FormData,
): Promise<TablePaymentState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in again and try that once more." };

  const slug = String(data.get("slug") ?? "");
  const booking = Number(data.get("bookingId") ?? 0);
  if (!booking) return { error: "That booking is not here any more." };

  const status = String(data.get("paymentStatus") ?? "");
  if (!STATES.includes(status as TablePaymentStatus)) {
    return { error: "Pick one of the payment states from the list." };
  }

  // Which of the two seats is being settled. 0221 split the fee between the
  // people on the table, and a missing field here would quietly settle the
  // booker's half for somebody pressing the opponent's row.
  const side = String(data.get("side") ?? "");
  if (side !== "booker" && side !== "opponent") {
    return { error: "That is not one of the two seats on the table." };
  }

  const club = await getClubDetail(slug);
  if (!club) return { error: "That club is not here any more." };

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("bookings.manage")) {
    return { error: "You cannot change the money on that booking." };
  }

  const done = await setTablePayment({
    booking,
    side,
    status: status as TablePaymentStatus,
    method: String(data.get("method") ?? ""),
    note: String(data.get("note") ?? ""),
  });
  if (!done.ok) return { error: done.error };

  // The refund is its own write, because it is its own question and the
  // dialog can move one without the other. It runs after the payment on
  // purpose: marking a half paid and refunded in one press has to record the
  // payment first, or the refund is refused for a half nothing was taken on.
  const refund = String(data.get("refundStatus") ?? "not_due");
  if (!REFUND_STATUSES.includes(refund as RefundStatus)) {
    return { error: "Pick one of the three refund states from the list." };
  }
  const back = await setTableRefund({
    booking,
    side,
    status: refund as RefundStatus,
    method: String(data.get("refundMethod") ?? ""),
    note: String(data.get("refundNote") ?? ""),
  });
  if (!back.ok) return { error: back.error };

  // Both doors onto the same row: this list, and the night the table is on.
  revalidatePath(`/clubs/${slug}/manage/bookings`);
  revalidatePath(`/clubs/${slug}/bookings`);
  return {
    notice: refund === "refunded" ? "Refund recorded."
      : status === "unpaid" ? "Set back to unpaid."
        : "Payment recorded.",
  };
}
