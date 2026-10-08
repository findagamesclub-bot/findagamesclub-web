"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getCurrentProfile } from "@/services/auth.service";
import { FEATURED_TAG, featureClub, unfeatureClub } from "@/services/featured.service";
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
