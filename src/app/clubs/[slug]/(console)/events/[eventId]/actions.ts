"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import * as tickets from "@/services/tickets.service";
import { getBooking } from "@/services/eventBookings.service";
import { notifyBooked, notifyClubBooked } from "@/services/ticket-notify.service";

export type TicketState = { error?: string; notice?: string };

/**
 * Cart and checkout for one event.
 *
 * One action, like the booking and membership ones, so two hooks in a component
 * can never disagree about which message is current.
 */
export async function ticketAction(
  _prev: TicketState,
  data: FormData,
): Promise<TicketState> {
  const viewer = await getCurrentProfile();
  const slug = String(data.get("slug") ?? "");
  const eventKey = String(data.get("eventKey") ?? "");
  const intent = String(data.get("intent") ?? "");

  if (!viewer) return { error: "Sign in to book tickets." };
  if (!slug || !eventKey) return { error: "Something went wrong. Reload and try again." };

  const refresh = () => revalidatePath(`/clubs/${slug}/events/${eventKey}`);

  if (intent === "add" || intent === "set") {
    const result = await tickets.addToCart({
      eventId: Number(data.get("eventId")),
      ticketTypeId: Number(data.get("ticketTypeId")),
      quantity: Number(data.get("quantity") ?? 1),
    });
    refresh();
    if (!result.ok) return { error: result.error };
    return { notice: "Added to your tickets." };
  }

  if (intent === "remove") {
    const result = await tickets.removeFromCart(Number(data.get("ticketTypeId")), viewer.id);
    refresh();
    if (!result.ok) return { error: result.error };
    return { notice: "Removed." };
  }

  if (intent === "checkout") {
    const result = await tickets.checkout({
      eventId: Number(data.get("eventId")),
      profileId: viewer.id,
      fullName: String(data.get("fullName") ?? "") || viewer.full_name,
      email: String(data.get("email") ?? "") || viewer.email,
      // A request. checkout_event_cart checks it against the tier and the
      // balance and writes what it allows.
      redeemPoints: Number(data.get("redeemPoints") ?? 0),
    });

    refresh();
    if (!result.ok) return { error: result.error };

    // Read back rather than assembling from the cart: the confirmation must say
    // what was actually written, including any line the capacity check trimmed.
    const booking = await getBooking(result.reference);
    if (booking) {
      await notifyBooked(booking);
      // The club too. A booking the owner never hears about is a place they
      // cannot plan around and money they cannot chase.
      await notifyClubBooked(booking);
    }

    // Straight to the confirmation, which is the only place the reference is
    // shown. A notice on the page behind would be lost on the next reload.
    redirect(`/tickets/${result.reference}`);
  }

  return { error: "Something went wrong. Reload and try again." };
}
