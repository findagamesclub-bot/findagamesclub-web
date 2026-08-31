import "server-only";

import * as repo from "@/repositories/reviews.repository";

/**
 * Reviews.
 *
 * Legacy asks for no membership at all — anybody with an account may review
 * any club (create_club_review, club_store.py:3130). That is kept: a review
 * site where only members can review is a testimonials page.
 */

type Result = { ok: true } | { ok: false; error: string };

function clean(rating: number, comment: string): { rating: number; comment: string } | string {
  const score = Math.floor(Number(rating));
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    return "Choose a score between 1 and 5 stars.";
  }
  const words = comment.trim();
  if (!words) return "Say something about the club as well as the score.";
  if (words.length > 4000) return "That review is too long. Trim it and try again.";
  return { rating: score, comment: words };
}

export async function writeReview(params: {
  clubId: number;
  profileId: string;
  authorName: string;
  rating: number;
  comment: string;
}): Promise<Result> {
  const parsed = clean(params.rating, params.comment);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  try {
    await repo.insertReview({ ...params, ...parsed });
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    // The partial unique index. Legacy words it the same way.
    if (raw.includes("club_reviews_one_active_per_author") || raw.includes("23505")) {
      return { ok: false, error: "You have already left a review for this club." };
    }
    return { ok: false, error: "Could not save that review. Try again." };
  }
}

export async function editReview(
  reviewId: number,
  rating: number,
  comment: string,
): Promise<Result> {
  const parsed = clean(rating, comment);
  if (typeof parsed === "string") return { ok: false, error: parsed };

  try {
    await repo.updateOwnReview(reviewId, parsed.rating, parsed.comment);
    return { ok: true };
  } catch {
    return { ok: false, error: "That review is not yours to edit." };
  }
}

export async function setFlag(reviewId: number, flagged: boolean): Promise<Result> {
  try {
    await repo.flagReview(reviewId, flagged);
    return { ok: true };
  } catch {
    return { ok: false, error: "Only the club or an administrator can flag a review." };
  }
}

export async function takeDown(reviewId: number): Promise<Result> {
  try {
    await repo.removeReview(reviewId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Only an administrator can remove a review." };
  }
}

/**
 * How many reviews the club has, against however many the page is carrying.
 *
 * A count rather than a length: the club page loads the newest few hundred, and
 * the difference is what the page has to admit to.
 */
export async function getReviewCount(clubId: number): Promise<number> {
  try {
    return await repo.countReviews(clubId);
  } catch {
    // A failed count must not take the club page down. Zero reads as "no more
    // than what is on the page", which is the safe way to be wrong.
    return 0;
  }
}
