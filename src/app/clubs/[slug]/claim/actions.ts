"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/services/auth.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getMyClaim, startClaim, withdrawClaim } from "@/services/claims.service";
import * as notify from "@/services/claim-notify.service";

export type ClaimState = { error?: string; notice?: string };

/**
 * Say a listing is yours.
 *
 * The club comes from the slug, not a hidden id, for the reason every other
 * write here does: an id in a form is an id somebody can change. The policy
 * underneath refuses a club that is not open to claims anyway.
 */
export async function claimClubAction(
  _prev: ClaimState, data: FormData,
): Promise<ClaimState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const slug = String(data.get("slug") ?? "");
  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." };

  const result = await startClaim({
    clubId: club.id,
    message: String(data.get("message") ?? ""),
    evidence: String(data.get("evidence") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  // Read afterwards, so the emails carry the row that was actually written.
  const claim = await getMyClaim(club.id).catch(() => null);
  if (claim) {
    void notify.claimReceived(
      viewer.id,
      { slug: club.slug, name: club.name, city: club.city },
      viewer.full_name ?? "",
      claim.id);
  }

  revalidatePath("/admin/claims");
  revalidatePath("/admin", "layout");
  revalidatePath(`/clubs/${slug}/claim`);

  // A toast and the page's own state, not a redirect to a banner. Redirecting
  // threw the toast away and the banner then said the same sentence the status
  // block underneath it already said, so the page told somebody twice that we
  // had their claim.
  return { notice: "We have it. We will email you either way." };
}

export async function withdrawClaimAction(
  _prev: ClaimState, data: FormData,
): Promise<ClaimState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const id = Number(data.get("claim") ?? 0);
  if (!id) return { error: "That claim is not here any more." };

  const result = await withdrawClaim(id);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/claims");
  revalidatePath("/admin", "layout");
  revalidatePath(`/clubs/${String(data.get("slug") ?? "")}/claim`);

  return { notice: "Taken back. You can claim it again while it is still open." };
}
