"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/services/auth.service";
import { carryListingFrom, listingBackTarget } from "@/utils/back-link";
import {
  cancelListing, deleteListing, restartListing, startListing, submitListing,
} from "@/services/submissions.service";

export type ListingFlowState = { error?: string; notice?: string };

/**
 * Start one, and go straight to step one.
 *
 * A redirect rather than a page that says "created". Nothing has been typed
 * yet, so a confirmation would be confirming an empty row.
 */
export async function startListingAction(data?: FormData): Promise<void> {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-up?next=/list-your-club");

  let id: number;
  try {
    id = await startListing(viewer.id);
  } catch {
    redirect("/list-your-club?failed=1");
  }
  // The door it was started from, so back leads out of the same one. Filtered
  // through the allowlist rather than trusted, since this arrives in a form.
  redirect(`/list-your-club/${id}/profile${carryListingFrom(data?.get("from") as string)}`);
}

/**
 * Send it to us.
 *
 * Redirects on success rather than toasting, because the next thing they need
 * is the page that says what happens now. A refusal comes back as a message,
 * since the form is still the place to fix it.
 */
export async function submitListingAction(
  _prev: ListingFlowState, data: FormData,
): Promise<ListingFlowState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const id = Number(data.get("draft") ?? 0);
  if (!id) return { error: "That listing is not here any more." };

  const result = await submitListing(id, viewer.full_name ?? "");
  if (!result.ok) return { error: result.error ?? "Could not send that. Try again." };

  // The admin queue and the count on their rail both go stale otherwise. An
  // admin with the console open saw "Nothing waiting. The queue is clear."
  // while a request sat in it, because the page had been rendered before the
  // request existed and nothing told it to look again.
  revalidatePath("/admin/submissions");
  // The request's own page too. Revalidating the list left an admin reading the
  // detail still looking at "Changes needed" after the club had answered.
  revalidatePath(`/admin/submissions/${id}`);
  revalidatePath("/admin", "layout");

  redirect(`/list-your-club/${id}/submitted`);
}

export async function cancelListingAction(
  _prev: ListingFlowState, data: FormData,
): Promise<ListingFlowState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const id = Number(data.get("draft") ?? 0);
  if (!id) return { error: "That listing is not here any more." };

  const result = await cancelListing(id, viewer.full_name ?? "");
  if (!result.ok) return { error: result.error ?? "Could not stop that. Try again." };

  // The admin queue may have just lost a row.
  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${id}`);
  revalidatePath("/admin", "layout");

  // Back to the list rather than to the account overview: somebody who has just
  // stopped one of several listings is still looking at the others, and to the
  // door they came in by rather than whichever of the two was hardcoded.
  redirect(listingBackTarget(data.get("from") as string).href);
}

/**
 * Start again from one that is over.
 *
 * A redirect into the builder rather than a toast, for the same reason starting
 * one does: the next thing they need is the listing, not a message about it.
 * Straight to the review step, because every field is already filled in and the
 * useful screen is the one saying what still needs doing.
 */
export async function restartListingAction(
  _prev: ListingFlowState, data: FormData,
): Promise<ListingFlowState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const id = Number(data.get("draft") ?? 0);
  if (!id) return { error: "That listing is not here any more." };

  const result = await restartListing(id);
  if (!result.ok) return { error: result.error };

  redirect(`/list-your-club/${result.draftId}/review`
    + carryListingFrom(data.get("from") as string));
}

/**
 * Bin a draft nobody has seen.
 *
 * Separate from cancelling on purpose: one leaves a record for an admin who has
 * read the listing, the other removes something that never left this account.
 */
export async function deleteListingAction(
  _prev: ListingFlowState, data: FormData,
): Promise<ListingFlowState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const id = Number(data.get("draft") ?? 0);
  if (!id) return { error: "That listing is not here any more." };

  const result = await deleteListing(id);
  if (!result.ok) return { error: result.error ?? "Could not delete that. Try again." };

  redirect(listingBackTarget(data.get("from") as string).href);
}
