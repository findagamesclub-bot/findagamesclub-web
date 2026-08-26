"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import * as reviews from "@/services/reviews.service";

export type ReviewState = { error?: string; notice?: string };

/** Writing, editing and moderating one club's reviews. */
export async function reviewAction(_prev: ReviewState, data: FormData): Promise<ReviewState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to leave a review." };

  const slug = String(data.get("slug") ?? "");
  const intent = String(data.get("intent") ?? "");
  if (!slug) return { error: "Something went wrong. Reload and try again." };

  const rating = Number(data.get("rating") ?? 0);
  const comment = String(data.get("comment") ?? "");
  const reviewId = Number(data.get("reviewId") ?? 0);

  const done = (result: { ok: true } | { ok: false; error: string }, notice: string) => {
    revalidatePath(`/clubs/${slug}`);
    return result.ok ? { notice } : { error: result.error };
  };

  if (intent === "write") {
    return done(
      await reviews.writeReview({
        clubId: Number(data.get("clubId")),
        profileId: viewer.id,
        authorName: viewer.full_name || "Club member",
        rating,
        comment,
      }),
      "Thanks — your review is live.",
    );
  }

  if (intent === "edit") {
    return done(await reviews.editReview(reviewId, rating, comment), "Your review is updated.");
  }

  if (intent === "flag") {
    return done(
      await reviews.setFlag(reviewId, true),
      "Flagged for an administrator to look at. It stays visible in the meantime.",
    );
  }

  if (intent === "unflag") {
    return done(await reviews.setFlag(reviewId, false), "Flag cleared.");
  }

  if (intent === "remove") {
    return done(await reviews.takeDown(reviewId), "Review removed.");
  }

  return { error: "Something went wrong. Reload and try again." };
}
