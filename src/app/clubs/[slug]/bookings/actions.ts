"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import * as bookings from "@/services/bookings.service";
import * as waitlist from "@/services/waitlist.service";
import * as lfg from "@/services/lookingForGames.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getBookingCalendar, londonToday } from "@/services/bookingCalendar.service";

export type BookingState = { error?: string; notice?: string };

/**
 * One action for booking and cancelling, for the same reason the membership
 * panel has one: two useActionState hooks in a component can disagree, and the
 * older notice wins.
 */
export async function bookingAction(
  _prev: BookingState,
  data: FormData,
): Promise<BookingState> {
  const viewer = await getCurrentProfile();
  const slug = String(data.get("slug") ?? "");
  const intent = String(data.get("intent") ?? "");

  if (!viewer) return { error: "Sign in to book a table." };
  if (!slug) return { error: "Something went wrong. Reload and try again." };

  const refresh = () => revalidatePath(`/clubs/${slug}/bookings`);

  if (intent === "book") {
    const result = await bookings.createBooking({
      clubId: Number(data.get("clubId")),
      clubSessionId: Number(data.get("clubSessionId")),
      sessionDate: String(data.get("sessionDate") ?? ""),
      gameTitle: String(data.get("gameTitle") ?? ""),
      notes: String(data.get("notes") ?? ""),
      opponentName: String(data.get("opponentName") ?? ""),
    });

    refresh();
    if (!result.ok) return { error: result.error };
    return {
      notice: result.postWithdrawn
        ? `Table ${result.tableIndex + 1} is yours. Your looking-for-a-game post came down.`
        : `Table ${result.tableIndex + 1} is yours.`,
    };
  }

  if (intent === "cancel") {
    const club = await getClubDetail(slug);
    const result = await bookings.cancelBooking(
      Number(data.get("bookingId")),
      undefined,
      club ? { name: club.name, slug: club.slug } : undefined,
    );
    refresh();
    if (!result.ok) return { error: result.error };
    return { notice: "Booking cancelled." };
  }

  if (intent === "waitlist") {
    const result = await waitlist.joinQueue({
      clubId: Number(data.get("clubId")),
      clubSessionId: Number(data.get("clubSessionId")),
      sessionDate: String(data.get("sessionDate") ?? ""),
      gameTitle: String(data.get("gameTitle") ?? ""),
      notes: String(data.get("notes") ?? ""),
    });

    refresh();
    if (!result.ok) return { error: result.error };
    return { notice: "You are on the waiting list. We will email you if a table frees up." };
  }

  if (intent === "leave-waitlist") {
    const result = await waitlist.leaveQueue(Number(data.get("entryId")));
    refresh();
    if (!result.ok) return { error: result.error };
    return { notice: "You have left the waiting list." };
  }

  if (intent === "promote") {
    const result = await waitlist.promoteEntry(Number(data.get("entryId")));
    refresh();
    if (!result.ok) return { error: result.error };
    return { notice: "Table given. They have been emailed." };
  }

  if (intent === "lfg-post") {
    const clubId = Number(data.get("clubId"));
    const club = await getClubDetail(slug);
    if (!club) return { error: "Something went wrong. Reload and try again." };

    // The posting window counts bookable club nights, so it needs the same
    // session list the page rendered from rather than a day count.
    const calendar = await getBookingCalendar({
      clubId, clubSlug: slug, clubName: club.name,
      capacity: club.tablesAvailable ?? 0,
      viewerId: viewer.id, isMember: true, canManage: false,
    });

    const result = await lfg.createPost({
      clubId,
      profileId: viewer.id,
      clubSessionId: Number(data.get("clubSessionId")),
      sessionDate: String(data.get("sessionDate") ?? ""),
      gameTitle: String(data.get("gameTitle") ?? ""),
      notes: String(data.get("notes") ?? ""),
      benefits: calendar.benefits,
      bookableDates: calendar.sessions.map((s) => s.date),
    });

    refresh();
    if (!result.ok) return { error: result.error };
    return { notice: "Posted. Members of the club can now take you up on it." };
  }

  if (intent === "lfg-withdraw") {
    const result = await lfg.withdrawPost(Number(data.get("postId")));
    refresh();
    if (!result.ok) return { error: result.error };
    return { notice: "Post withdrawn." };
  }

  if (intent === "lfg-accept") {
    const result = await lfg.acceptPost(Number(data.get("postId")));
    refresh();
    if (!result.ok) return { error: result.error };
    return { notice: "You are playing. The table is booked." };
  }

  return { error: "Something went wrong. Reload and try again." };
}
