"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { askSuspensionReview } from "@/services/adminListings.service";

export type AskState = { error?: string; notice?: string };

/**
 * The club telling the admins a suspension is settled.
 *
 * Everything that decides whether they may is in the database: the function
 * checks the club, the role and that the thing is actually down, so this is a
 * thin wrapper and the guard is not here. What it adds is the one thing SQL
 * cannot do, which is tell the pages showing the banner to draw it again.
 */
export async function askReviewAction(
  _prev: AskState,
  data: FormData,
): Promise<AskState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in first." };

  const kind = String(data.get("kind") ?? "");
  const id = Number(data.get("id"));
  const slug = String(data.get("slug") ?? "");
  if (kind !== "club" && kind !== "event") return { error: "That did not send. Try again." };
  if (!id) return { error: "That did not send. Try again." };

  const result = await askSuspensionReview(kind, id, String(data.get("note") ?? ""));
  if (!result.ok) return { error: result.error };

  // Both doors onto the same banner: a club's own page and its console, or an
  // event's page and the editor behind it. The slug is only for revalidating,
  // so a form that forgets it gets a stale banner rather than a refusal.
  if (slug) {
    revalidatePath(`/clubs/${slug}`);
    revalidatePath(`/clubs/${slug}/manage/listing/[step]`, "page");
    revalidatePath(`/clubs/${slug}/events/[eventId]`, "page");
    revalidatePath(`/clubs/${slug}/manage/events/[eventId]`, "page");
  }
  return { notice: "The admins have been told." };
}
