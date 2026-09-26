"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getCurrentProfile } from "@/services/auth.service";
import { FEATURED_TAG, featureClub, unfeatureClub } from "@/services/featured.service";

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

  refresh();
  return { notice: "Booked. It leads the homepage for the dates you set." };
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
