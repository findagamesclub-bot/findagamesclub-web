"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import * as extras from "@/services/clubExtras-writes.service";

export type CoachingState = { error?: string; notice?: string };

/** Booking a coaching slot, and the club running the calendar. */
export async function coachingAction(
  _prev: CoachingState,
  data: FormData,
): Promise<CoachingState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to book coaching." };

  const slug = String(data.get("slug") ?? "");
  const intent = String(data.get("intent") ?? "");
  if (!slug) return { error: "Something went wrong. Reload and try again." };

  const done = (r: { ok: true } | { ok: false; error: string }, notice: string) => {
    revalidatePath(`/clubs/${slug}/coaching`);
    return r.ok ? { notice } : { error: r.error };
  };

  if (intent === "book") {
    return done(await extras.bookCoaching(Number(data.get("slotId"))), "Booked. See you there.");
  }

  if (intent === "cancel") {
    return done(
      await extras.cancelCoaching(Number(data.get("bookingId"))),
      "Cancelled. Your place is back in the pool.",
    );
  }

  if (intent === "mark-paid") {
    return done(
      await extras.markCoachingPaid(
        Number(data.get("bookingId")),
        String(data.get("paid") ?? "") === "true",
      ),
      "Payment recorded.",
    );
  }

  if (intent === "set-slot-status") {
    const status = String(data.get("status") ?? "");
    return done(
      await extras.setSlotStatus(Number(data.get("slotId")), status),
      status === "open" ? "Slot reopened."
        : status === "closed" ? "Slot closed to new bookings."
        : "Slot cancelled.",
    );
  }

  if (intent === "add-slot") {
    return done(
      await extras.addCoachingSlot({
        clubId: Number(data.get("clubId")),
        title: String(data.get("title") ?? ""),
        description: String(data.get("description") ?? ""),
        slotDate: String(data.get("slotDate") ?? ""),
        startTime: String(data.get("startTime") ?? ""),
        endTime: String(data.get("endTime") ?? ""),
        price: String(data.get("price") ?? ""),
        coachingType: String(data.get("coachingType") ?? "one-to-one"),
        capacity: Number(data.get("capacity") ?? 1),
      }),
      "Slot added.",
    );
  }

  return { error: "Something went wrong. Reload and try again." };
}
