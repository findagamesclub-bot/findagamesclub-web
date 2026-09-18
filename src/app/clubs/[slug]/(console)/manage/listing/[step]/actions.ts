"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubDetail } from "@/services/clubDetail.service";
import {
  pauseListing, resumeListing,
  saveContentStep, savePricingStep, saveProfileStep, saveScheduleStep,
} from "@/services/listing.service";
import { saveDraftStep } from "@/services/submissions.service";
import { refusedMessage, type FieldErrors } from "@/utils/listing-draft";

export type ListingState = {
  error?: string;
  notice?: string;
  /** Per-field messages, shown under the field they belong to. */
  errors?: FieldErrors;
};


/**
 * Save one step of the listing.
 *
 * One action for both builders. The same five steps fill in a club that exists
 * and a listing that does not, and which one this is comes from the field the
 * form carried: `slug` for a club, `draft` for a submission.
 *
 * The club is looked up from the slug rather than trusted from the form: a club
 * id in a hidden field is a club id somebody can change. The draft id is a
 * different matter, since the policy on `club_submissions` only lets somebody
 * write their own and only while it is theirs to write, so naming a draft that
 * is not yours affects zero rows and says so.
 */
export async function saveListingStepAction(
  _prev: ListingState, data: FormData,
): Promise<ListingState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const step = String(data.get("step") ?? "");
  const draft = Number(data.get("draft") ?? 0);

  if (draft > 0) {
    const saved = await saveDraftStep(draft, step, data);
    if (!saved.ok) {
      return {
        error: saved.error
          ?? refusedMessage(saved.errors, "Some of that needs another look."),
        errors: saved.errors,
      };
    }
    // Nothing is public yet, so the wording cannot promise that members see it.
    return { notice: "Saved. You can come back to this whenever you like." };
  }

  const slug = String(data.get("slug") ?? "");
  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." };

  const save = step === "profile" ? saveProfileStep
    : step === "content" ? saveContentStep
    : step === "pricing" ? savePricingStep
    : step === "schedule" ? saveScheduleStep
    : null;
  if (!save) return { error: "That step cannot be saved yet." };

  const result = await save(club.id, data);
  if (!result.ok) {
    return {
      error: result.error
        ?? refusedMessage(result.errors, "Some of that needs another look."),
      errors: result.errors,
    };
  }

  // The public page and the console both read this club, and the stepper's own
  // counts are computed from what was just written.
  revalidatePath(`/clubs/${slug}`, "layout");
  return { notice: "Saved. Members see this now." };
}

/**
 * Take the listing out of the directory, or put it back.
 *
 * The club comes from the slug, not from a hidden id, for the same reason every
 * other write here does: an id in a form is an id somebody can change. The
 * function underneath decides whether this person may.
 */
export async function pauseListingAction(
  _prev: ListingState, data: FormData,
): Promise<ListingState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const slug = String(data.get("slug") ?? "");
  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." };

  const back = String(data.get("intent") ?? "") === "resume";
  const named = {
    name: club.name, city: club.city, slug: club.slug, ownerId: club.ownerId,
  };
  const result = back
    ? await resumeListing(club.id, named, viewer.id)
    : await pauseListing(club.id, named, viewer.id);
  if (!result.ok) return { error: result.error };

  // The directory, the map and the club's own page all read this, and so does
  // every console screen that says whether it is live.
  revalidatePath("/clubs");
  revalidatePath(`/clubs/${slug}`, "layout");
  // Both lists that say whether this club is live: the owner's own cards and
  // the admin's queue, which went on reading "Approved and live" about a club
  // that was not.
  revalidatePath("/account/listings");
  revalidatePath("/list-your-club");
  revalidatePath("/admin/submissions");
  revalidatePath("/admin", "layout");

  return {
    notice: back
      ? "Back in the directory. People can find the club again."
      : "Out of the directory. Your members keep everything, and you can put it back whenever.",
  };
}
