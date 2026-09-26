import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Writing and moderating reviews.
 *
 * The read path lives in clubs.repository, alongside the club it belongs to.
 * Every write here is policy-scoped, so a refusal comes back as zero rows
 * rather than an error — hence the maybeSingle-and-check on each one.
 */

export async function insertReview(params: {
  clubId: number;
  profileId: string;
  authorName: string;
  rating: number;
  comment: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_reviews")
    .insert({
      club_id: params.clubId,
      author_profile_id: params.profileId,
      author_name: params.authorName,
      rating: params.rating,
      comment: params.comment,
    })
    .select("id")
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/** Their own words, and only while the review is still standing. */
export async function updateOwnReview(reviewId: number, rating: number, comment: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_reviews")
    .update({ rating, comment })
    .eq("id", reviewId)
    .is("removed_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/**
 * Taking a review down, which stays with the admin.
 *
 * Raising one is no longer here at all: it goes through `flag_content` like
 * every other kind (0128), so the chip on the club page and the report in the
 * admin's queue cannot disagree. Legacy keeps a flagged review visible
 * (club_store.py:20210) and so do we.
 */
export async function removeReview(reviewId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_reviews")
    .update({ removed_at: new Date().toISOString(), removed_by_name: "" })
    .eq("id", reviewId)
    .is("removed_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/**
 * How many reviews a club actually has.
 *
 * The club page carries the newest `REVIEW_CAP` of them. This is what says so
 * out loud when there are more, rather than letting the page quietly present
 * five hundred as all of them.
 */
export async function countReviews(clubId: number): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("club_reviews")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .is("removed_at", null);

  if (error) throw new Error(`Failed to count reviews: ${error.message}`);
  return count ?? 0;
}
