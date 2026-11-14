"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getCurrentProfile } from "@/services/auth.service";
import {
  FEATURED_TAG, cancelFeaturedSlot, featureClub, recordFeaturedPayment,
  setFeaturedRefund, unfeatureClub,
} from "@/services/featured.service";
import { REFUND_STATUSES, type RefundStatus } from "@/utils/refund-status";
import { answerFeatured } from "@/services/featuredRequests.service";

export type FeaturedState = { error?: string; notice?: string };

export async function featuredAction(
  _prev: FeaturedState, data: FormData,
): Promise<FeaturedState> {
  const viewer = await getCurrentProfile();
  if (!viewer || viewer.role !== "admin") {
    return { error: "Only an admin can change what is featured." };
  }

  const intent = String(data.get("intent") ?? "");

  if (intent === "remove") {
    const slot = Number(data.get("slot") ?? 0);
    if (!slot) return { error: "That slot is not here any more." };

    const gone = await unfeatureClub(slot);
    if (!gone.ok) return { error: gone.error };

    refresh();
    return { notice: "Taken off the homepage." };
  }

  // Called off, or put back. The client's item 16d: a club books, pays and
  // then changes its mind. Not a removal, because the payment has to stay on
  // the record and the refund hangs off it.
  if (intent === "cancel") {
    const slot = Number(data.get("slot") ?? 0);
    if (!slot) return { error: "That slot is not here any more." };

    const cancel = String(data.get("cancel") ?? "") === "yes";
    const done = await cancelFeaturedSlot({
      slot, cancel, reason: String(data.get("reason") ?? ""),
    });
    if (!done.ok) return { error: done.error };

    // This one DOES clear the homepage cache, unlike recording a payment: a
    // called-off slot has to come off the front page now, not in a minute.
    refresh();
    return {
      notice: cancel ? "Called off and taken off the homepage." : "Put back.",
    };
  }

  // What arrived for a slot. Only an admin reaches this action at all, and
  // `record_featured_payment` asks `is_admin()` again, because the anon key is
  // public and a screen is not a guard.
  if (intent === "payment") {
    const slot = Number(data.get("slot") ?? 0);
    if (!slot) return { error: "That slot is not here any more." };

    const paid = String(data.get("paid") ?? "") === "yes";
    const done = await recordFeaturedPayment({
      slot, paid,
      method: String(data.get("method") ?? ""),
      note: String(data.get("note") ?? ""),
    });
    if (!done.ok) return { error: done.error };

    // The refund rides on the same save, because the dialog can move it in
    // the same press. After the payment, so marking a slot paid and refunded
    // at once records the payment first: the guard refuses a refund on a
    // slot nothing was taken for.
    const refund = String(data.get("refundStatus") ?? "not_due");
    if (!REFUND_STATUSES.includes(refund as RefundStatus)) {
      return { error: "Pick one of the three refund states from the list." };
    }
    const back = await setFeaturedRefund({
      slot, status: refund,
      method: String(data.get("refundMethod") ?? ""),
      note: String(data.get("refundNote") ?? ""),
    });
    if (!back.ok) return { error: back.error };

    // No homepage revalidation: who leads it does not depend on whether we
    // have banked the money, and refreshing the front page to move a chip on
    // an admin screen is work for nothing.
    revalidatePath("/admin/featured");
    return {
      notice: refund === "refunded" ? "Refund recorded."
        : paid ? "Recorded as paid." : "Marked as not paid yet.",
    };
  }

  const club = Number(data.get("club") ?? 0);
  if (!club) return { error: "Pick a club." };

  const from = String(data.get("from") ?? "");
  if (!from) return { error: "Say when the slot starts." };

  const pounds = Number(String(data.get("price") ?? "").replace(/[^0-9.]/g, ""));

  const result = await featureClub({
    club,
    from,
    to: String(data.get("to") ?? "") || null,
    pricePence: Number.isFinite(pounds) && pounds >= 0 ? Math.round(pounds * 100) : null,
    note: String(data.get("note") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  // Booked in answer to a club asking. Marked against the slot that just
  // appeared rather than a second button saying what the admin already did,
  // and quietly: 0155 already writes to the owner when the slot itself lands.
  const asked = Number(data.get("requestId") ?? 0);
  if (asked && result.slotId) {
    const tied = await answerFeatured(asked, result.slotId, "");
    if (!tied.ok) console.error("[featured] slot booked but the request stayed open");
  }

  refresh();
  return { notice: "Booked. It leads the homepage for the dates you set." };
}

/** Turn one down, with the reason the club is told. */
export async function declineFeaturedRequest(
  _prev: FeaturedState, data: FormData,
): Promise<FeaturedState> {
  const viewer = await getCurrentProfile();
  if (!viewer || viewer.role !== "admin") {
    return { error: "Only an admin can answer a featured request." };
  }

  const id = Number(data.get("requestId") ?? 0);
  if (!id) return { error: "That request is not here any more." };

  const reason = String(data.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason. It is what they will be told." };

  const result = await answerFeatured(id, null, reason);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/featured");
  return { notice: "Turned down, and they have been told why." };
}

/**
 * The homepage read is cached for a minute and tagged, so a slot booked now
 * would otherwise take up to a minute to appear. `revalidateTag` rather than
 * `updateTag`: this is not read-your-own-writes, it is the front page, and
 * Next 16 wants the second argument.
 */
function refresh() {
  revalidateTag(FEATURED_TAG, "max");
  revalidatePath("/admin/featured");
  revalidatePath("/");
}
