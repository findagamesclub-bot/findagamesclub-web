"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { approve, decline, requestChanges } from "@/services/submissionReview.service";

export type ReviewState = { error?: string; notice?: string };

/**
 * Answer one listing.
 *
 * One action with an intent rather than three, matching the dialog pattern the
 * rest of the console uses. The role is re-checked here even though the layout
 * redirects: the layout draws the console, it does not guard the write, and
 * every function underneath refuses a non-admin as well.
 */
export async function reviewAction(
  _prev: ReviewState, data: FormData,
): Promise<ReviewState> {
  const viewer = await getCurrentProfile();
  if (!viewer || viewer.role !== "admin") {
    return { error: "Only an admin can answer a listing." };
  }

  const id = Number(data.get("id") ?? 0);
  const intent = String(data.get("intent") ?? "");
  if (!id) return { error: "That listing is not here any more." };

  if (intent === "approve") {
    const result = await approve(id);
    if (!result.ok) return { error: result.error };
    revalidatePath("/admin/submissions");
    revalidatePath(`/admin/submissions/${id}`);
    revalidatePath("/admin", "layout");
    revalidatePath("/clubs");
    // The club's own side too, so their listing card and console appear rather
    // than the page they were last served.
    revalidatePath("/account/listings");
    return { notice: `${result.name} is live at /clubs/${result.slug}.` };
  }

  if (intent === "changes") {
    const result = await requestChanges(id, String(data.get("note") ?? ""));
    if (!result.ok) return { error: result.error };
    revalidatePath("/admin/submissions");
    revalidatePath(`/admin/submissions/${id}`);
    revalidatePath("/admin", "layout");
    revalidatePath("/account/listings");
    return { notice: result.message };
  }

  if (intent === "decline") {
    const result = await decline(id, String(data.get("reason") ?? ""));
    if (!result.ok) return { error: result.error };
    revalidatePath("/admin/submissions");
    revalidatePath(`/admin/submissions/${id}`);
    revalidatePath("/admin", "layout");
    revalidatePath("/account/listings");
    return { notice: result.message };
  }

  return { error: "That is not something you can do to a listing." };
}
