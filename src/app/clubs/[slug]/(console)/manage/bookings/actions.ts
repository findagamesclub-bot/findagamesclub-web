"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { setTablePayment } from "@/services/clubTableBookings.service";
import type { TablePaymentStatus } from "@/utils/table-bookings";

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

  const club = await getClubDetail(slug);
  if (!club) return { error: "That club is not here any more." };

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("bookings.manage")) {
    return { error: "You cannot change the money on that booking." };
  }

  const done = await setTablePayment({
    booking,
    status: status as TablePaymentStatus,
    method: String(data.get("method") ?? ""),
    note: String(data.get("note") ?? ""),
  });
  if (!done.ok) return { error: done.error };

  // Both doors onto the same row: this list, and the night the table is on.
  revalidatePath(`/clubs/${slug}/manage/bookings`);
  revalidatePath(`/clubs/${slug}/bookings`);
  return {
    notice: status === "unpaid" ? "Set back to unpaid." : "Payment recorded.",
  };
}
