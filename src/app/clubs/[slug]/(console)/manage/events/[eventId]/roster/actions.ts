"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getEvent } from "@/services/eventEditor.service";
import * as roster from "@/services/eventRoster.service";
import { PAYMENT_STATUSES, REFUND_STATUSES } from "@/utils/door-list";
import type { PaymentStatus, RefundStatus } from "@/utils/door-list";
import type { EventFacts } from "@/types/eventEditor";

export type RosterState = { error?: string; notice?: string };

async function open(data: FormData) {
  const slug = String(data.get("slug") ?? "");
  const eventId = Number(data.get("eventId"));

  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." as const };

  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." as const };

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("events.manage")) {
    return { error: "You do not have permission to change this." as const };
  }
  if (!Number.isFinite(eventId)) {
    return { error: "Something went wrong. Reload and try again." as const };
  }

  const event = await getEvent(club.id, eventId);
  if (!event) return { error: "That event is not here any more." as const };

  const facts: EventFacts = {
    id: event.id, legacyId: event.legacyId, title: event.title,
    startDate: event.startDate || null, clubName: club.name, clubSlug: slug,
  };
  return { slug, facts };
}

/** One entry point, for the same reason the pairings page has one. */
export async function rosterAction(
  _prev: RosterState, data: FormData,
): Promise<RosterState> {
  const gate = await open(data);
  if ("error" in gate) return { error: gate.error };

  const { slug, facts } = gate;
  const intent = String(data.get("intent") ?? "");

  // Adding somebody is the one intent with no booking to act on, so the id is
  // checked by the five that need it rather than at the top. Checking it here
  // refused an add before it started, which is the shape of bug that reads as
  // "the button does nothing".
  const bookingId = Number(data.get("bookingId"));
  const needsBooking = intent !== "add";
  if (needsBooking && !Number.isFinite(bookingId)) {
    return { error: "Something went wrong. Reload and try again." };
  }

  const result = await (async () => {
    switch (intent) {
      case "add":
        return roster.addPlace(facts, {
          // Empty means somebody with no account, which is most of a door.
          profileId: String(data.get("profileId") ?? "") || null,
          fullName: String(data.get("fullName") ?? ""),
          email: String(data.get("email") ?? ""),
          ticketTypeId: Number(data.get("ticketTypeId")),
          quantity: Number(data.get("quantity") ?? 1),
        });

      case "payment": {
        const status = String(data.get("paymentStatus") ?? "");
        if (!PAYMENT_STATUSES.includes(status as PaymentStatus)) {
          return { ok: false as const, error: "Something went wrong. Reload and try again." };
        }
        return roster.recordPayment(facts, bookingId, status as PaymentStatus,
          String(data.get("method") ?? ""), String(data.get("note") ?? ""),
          Number(data.get("total")) || 0);
      }

      case "check-in":
        return roster.checkIn(facts.id, bookingId,
          String(data.get("arrived") ?? "") === "yes");

      case "cancel":
        return roster.cancelPlace(facts, bookingId, String(data.get("reason") ?? ""));

      case "refund": {
        const status = String(data.get("refundStatus") ?? "");
        if (!REFUND_STATUSES.includes(status as RefundStatus)) {
          return { ok: false as const, error: "Something went wrong. Reload and try again." };
        }
        return roster.setRefundStatus(facts.id, bookingId, status as RefundStatus);
      }

      case "edit":
        return roster.editBooking(facts.id, bookingId, {
          fullName: String(data.get("fullName") ?? ""),
          email: String(data.get("email") ?? ""),
          notes: String(data.get("notes") ?? ""),
          // Absent from the club-wide bookings list, which does not ask about
          // the account; present and possibly empty from the door list, where
          // empty means nobody.
          ...(data.has("memberId")
            ? { memberId: String(data.get("memberId") ?? ""),
                memberCode: String(data.get("memberCode") ?? "") }
            : {}),
        });

      default:
        return { ok: false as const, error: "Something went wrong. Reload and try again." };
    }
  })();

  if (!result.ok) return { error: result.error };

  revalidatePath(`/clubs/${slug}/manage/events/${facts.id}/roster`);
  revalidatePath(`/clubs/${slug}/manage/events/${facts.id}`);
  // The club-wide bookings list shows the same row, so a payment recorded from
  // there has to move on the list it was recorded from.
  revalidatePath(`/clubs/${slug}/manage/events`);
  revalidatePath(`/clubs/${slug}/events/${facts.legacyId}`);
  return { notice: result.notice };
}
