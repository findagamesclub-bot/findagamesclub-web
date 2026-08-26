"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { cancelEventBooking, getBooking } from "@/services/eventBookings.service";
import { notifyCancelled } from "@/services/ticket-notify.service";

export type CancelState = { error?: string; notice?: string };

/** Give up a reserved place. RLS decides whether it is theirs to give up. */
export async function cancelTicketAction(
  _prev: CancelState,
  data: FormData,
): Promise<CancelState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to manage your tickets." };

  const result = await cancelEventBooking(Number(data.get("bookingId")));

  revalidatePath("/tickets");
  if (!result.ok) return { error: result.error };

  revalidatePath(`/tickets/${result.reference}`);

  const booking = await getBooking(result.reference);
  if (booking) await notifyCancelled(booking);

  return { notice: `Booking ${result.reference} cancelled. Your place is back in the pool.` };
}
