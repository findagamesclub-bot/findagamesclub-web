"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { cancelBooking } from "@/services/bookings.service";

export type AccountBookingState = { error?: string; notice?: string };

/**
 * Cancelling a table from the profile.
 *
 * The club's own booking page has done this since Stage 3, but somebody in
 * three clubs had to work out which one a booking belonged to before they could
 * drop it. The rules are unchanged: club_bookings_cancel decides, and it still
 * refuses on the day.
 */
export async function accountBookingAction(
  _prev: AccountBookingState,
  data: FormData,
): Promise<AccountBookingState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to manage your bookings." };

  const bookingId = Number(data.get("bookingId"));
  if (!bookingId) return { error: "Something went wrong. Reload and try again." };

  const slug = String(data.get("clubSlug") ?? "");
  const name = String(data.get("clubName") ?? "");

  const result = await cancelBooking(
    bookingId,
    String(data.get("reason") ?? ""),
    slug ? { slug, name } : undefined,
  );

  revalidatePath("/account/bookings");
  revalidatePath("/account");
  if (slug) revalidatePath(`/clubs/${slug}/bookings`);

  return result.ok
    ? { notice: "Booking cancelled. The table is free for somebody else." }
    : { error: result.error };
}
