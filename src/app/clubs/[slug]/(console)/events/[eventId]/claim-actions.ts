"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { claimEventNames } from "@/services/memberCodes.service";

export type ClaimState = { error?: string; notice?: string };

/**
 * "That's me", on an event somebody played at.
 *
 * Decides nothing: 0177 checks that the caller holds a ticket for the event
 * and that the name on each row is their own, and the count comes back from
 * there. The page only has to know whether to draw the button.
 */
export async function claimNamesAction(
  _prev: ClaimState,
  data: FormData,
): Promise<ClaimState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in first." };

  const slug = String(data.get("slug") ?? "");
  const eventKey = String(data.get("eventKey") ?? "");
  const eventId = Number(data.get("eventId"));
  if (!slug || !eventKey || !Number.isFinite(eventId)) {
    return { error: "Something went wrong. Reload and try again." };
  }

  const result = await claimEventNames(eventId);
  if (!result.ok) return { error: result.error };

  // The page is server rendered, so without this the strip stays up over
  // results that are now attached.
  revalidatePath(`/clubs/${slug}/events/${eventKey}`);
  revalidatePath(`/members/${viewer.id}`);

  return {
    notice: result.count === 1
      ? "That one is yours now."
      : `${result.count} results are yours now.`,
  };
}
