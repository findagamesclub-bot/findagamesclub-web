"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/services/auth.service";
import {
  approveClaim, createClubAsAdmin, declineClaim, getClaim, setClaimable,
} from "@/services/claims.service";
import * as notify from "@/services/claim-notify.service";

export type ClaimReviewState = { error?: string; notice?: string };

/**
 * Answer a claim.
 *
 * One action with an intent rather than two, matching the submissions review
 * screen. The role is re-checked even though the layout redirects, because the
 * layout draws the console and does not guard the write.
 */
export async function claimReviewAction(
  _prev: ClaimReviewState, data: FormData,
): Promise<ClaimReviewState> {
  const viewer = await getCurrentProfile();
  if (!viewer || viewer.role !== "admin") {
    return { error: "Only an admin can answer a claim." };
  }

  const id = Number(data.get("id") ?? 0);
  if (!id) return { error: "That claim is not here any more." };

  // Read before the write: afterwards the claim is answered and the claimant is
  // the only thing left to email, so who to write to has to be in hand.
  const before = await getClaim(id).catch(() => null);
  const intent = String(data.get("intent") ?? "");

  if (intent === "approve") {
    const result = await approveClaim(id, String(data.get("note") ?? ""));
    if (!result.ok) return { error: result.error };

    if (before) {
      void notify.claimApproved(before.claimant_id,
        { slug: result.slug, name: result.name });
    }

    refresh(id);
    // The club has an owner now, so the directory, the club's own pages and
    // anywhere claiming was offered are all stale.
    revalidatePath("/clubs");
    if (before?.club?.slug) revalidatePath(`/clubs/${before.club.slug}`, "layout");

    return { notice: `${result.name} is theirs now. They have been emailed.` };
  }

  if (intent === "decline") {
    const note = String(data.get("note") ?? "");
    const result = await declineClaim(id, note);
    if (!result.ok) return { error: result.error };

    if (before) {
      void notify.claimDeclined(before.claimant_id,
        before.club?.name ?? "that club", note.trim());
    }

    refresh(id);
    return { notice: "Turned down. They have been emailed your reason." };
  }

  return { error: "That is not something you can do to a claim." };
}

function refresh(id: number) {
  revalidatePath("/admin/claims");
  revalidatePath(`/admin/claims/${id}`);
  revalidatePath("/admin", "layout");
}

export type ClaimableState = { error?: string; notice?: string };

/**
 * Open a listing to claims, close one, or add a listing for a club that is not
 * in the directory yet.
 *
 * Three intents and one action, because they are three answers to one question
 * an admin is asking on one screen: which clubs can somebody put their hand up
 * for. The database refuses a club that already has an owner; this only decides
 * what to say about it.
 */
export async function claimableAction(
  _prev: ClaimableState, data: FormData,
): Promise<ClaimableState> {
  const viewer = await getCurrentProfile();
  if (!viewer || viewer.role !== "admin") {
    return { error: "Only an admin can open a listing to claims." };
  }

  const intent = String(data.get("intent") ?? "");

  if (intent === "create") {
    const name = String(data.get("name") ?? "").trim();
    const city = String(data.get("city") ?? "").trim();
    if (!name) return { error: "Give the club a name." };
    if (!city) return { error: "Say which town or city it is in." };

    const result = await createClubAsAdmin({ name, city, claimable: true });
    if (!result.ok) return { error: result.error };

    refreshClaimable();
    return {
      notice: `${name} is in the directory at /clubs/${result.slug}, `
        + "open for somebody to claim.",
    };
  }

  const club = Number(data.get("club") ?? 0);
  if (!club) return { error: "Pick a club first." };

  const opening = intent === "open";
  const result = await setClaimable(club, opening);
  if (!result.ok) return { error: result.error };

  refreshClaimable();
  return {
    notice: opening
      ? "Open to claims. The club page now offers it to anybody signed in."
      : "Closed. Nobody can claim it now, and any claim already in stays where it is.",
  };
}

function refreshClaimable() {
  revalidatePath("/admin/claims");
  revalidatePath("/clubs");
}
