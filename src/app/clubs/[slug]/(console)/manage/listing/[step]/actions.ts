"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubDetail } from "@/services/clubDetail.service";
import {
  saveContentStep, savePricingStep, saveProfileStep, saveScheduleStep,
} from "@/services/listing.service";
import type { FieldErrors } from "@/utils/listing-draft";

export type ListingState = {
  error?: string;
  notice?: string;
  /** Per-field messages, shown under the field they belong to. */
  errors?: FieldErrors;
};

/**
 * Save one step of the listing.
 *
 * The club is looked up from the slug rather than trusted from the form: a
 * club id in a hidden field is a club id somebody can change. The policy would
 * refuse it anyway, but a form that names its own target invites the attempt.
 */
export async function saveListingStepAction(
  _prev: ListingState, data: FormData,
): Promise<ListingState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const slug = String(data.get("slug") ?? "");
  const step = String(data.get("step") ?? "");
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
      error: result.error ?? "Some of that needs another look.",
      errors: result.errors,
    };
  }

  // The public page and the console both read this club, and the stepper's own
  // counts are computed from what was just written.
  revalidatePath(`/clubs/${slug}`, "layout");
  return { notice: "Saved. Members see this now." };
}
