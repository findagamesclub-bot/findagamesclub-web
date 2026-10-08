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
    // Both, because the same action serves two pages: the club page's calendar
    // and the console. Only the first was revalidated, so marking somebody paid
    // from the console's Bookings tab changed the row and the screen went on
    // showing the old one. Found by pressing it rather than by reading it.
    revalidatePath(`/clubs/${slug}/coaching`);
    revalidatePath(`/clubs/${slug}/manage/coaching`);
    return r.ok ? { notice } : { error: r.error };
  };

  if (intent === "book") {
    return done(
      await extras.bookCoaching(
        Number(data.get("slotId")),
        Number(data.get("points") ?? 0) || 0),
      "Booked. See you there.");
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

  // The club calling somebody's place off, which is not the same act as the
  // member giving it up: this one takes a reason and this one is announced.
  if (intent === "club-cancel") {
    return done(
      await extras.cancelCoachingAsClub(
        Number(data.get("bookingId")),
        String(data.get("reason") ?? "")),
      "Place cancelled. They have been told.",
    );
  }

  if (intent === "set-refund") {
    return done(
      await extras.setCoachingRefund(
        Number(data.get("bookingId")),
        String(data.get("refund") ?? "")),
      "Refund updated.",
    );
  }

  if (intent === "edit-slot") {
    return done(
      await extras.editCoachingSlot({
        slotId: Number(data.get("slotId")),
        title: String(data.get("title") ?? ""),
        description: String(data.get("description") ?? ""),
        slotDate: String(data.get("slotDate") ?? ""),
        startTime: String(data.get("startTime") ?? ""),
        endTime: String(data.get("endTime") ?? ""),
        price: String(data.get("price") ?? ""),
        coachingType: String(data.get("coachingType") ?? "one-to-one"),
        capacity: Number(data.get("capacity") ?? 1),
      }),
      "Session updated.",
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
