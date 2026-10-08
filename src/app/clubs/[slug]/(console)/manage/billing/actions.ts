"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import {
  askToBeFeatured, chooseListingPlan, withdrawFeatured,
} from "@/services/featuredRequests.service";

export type BillingState = { error?: string; notice?: string };

/**
 * The owner's own billing writes.
 *
 * One action with an intent rather than three, the shape the rest of the
 * console uses. Every one of these is re-checked in the database as well: the
 * club is resolved from the slug here only so the right page is revalidated,
 * and 0161's functions decide on `billing.manage` rather than on anything this
 * form says.
 */
export async function billingAction(
  _prev: BillingState, data: FormData,
): Promise<BillingState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const slug = String(data.get("slug") ?? "");
  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." };

  const access = await getClubAccess(club.id, viewer);
  if (access.role !== "owner" && access.role !== "admin") {
    return { error: "Only the owner looks after the money." };
  }

  const intent = String(data.get("intent") ?? "");
  const done = () => revalidatePath(`/clubs/${slug}/manage/billing`);

  if (intent === "plan") {
    const result = await chooseListingPlan(club.id, String(data.get("plan") ?? ""));
    if (!result.ok) return { error: result.error };
    done();
    return {
      notice: String(data.get("plan")) === "yearly"
        ? "Moved to yearly. It takes effect when your listing next renews."
        : "Moved to monthly. It takes effect when your listing next renews.",
    };
  }

  if (intent === "ask-featured") {
    const result = await askToBeFeatured(
      club.id,
      String(data.get("preferredFrom") ?? "").trim() || null,
      String(data.get("note") ?? "").trim(),
    );
    if (!result.ok) return { error: result.error };
    done();
    return { notice: "Asked. We will come back to you." };
  }

  if (intent === "withdraw-featured") {
    const result = await withdrawFeatured(Number(data.get("requestId") ?? 0));
    if (!result.ok) return { error: result.error };
    done();
    return { notice: "Taken back." };
  }

  return { error: "That cannot be done here." };
}
