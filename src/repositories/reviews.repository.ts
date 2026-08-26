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
 * The club raising a hand. Flagging does not hide anything — legacy keeps a
 * flagged review visible (club_store.py:20210) and only an admin can remove it.
 */
export async function flagReview(reviewId: number, flagged: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_reviews")
    .update({
      flagged_at: flagged ? new Date().toISOString() : null,
      // The trigger overwrites this with the actor's real name; sending it
      // keeps the column in the grant list rather than silently unwritable.
      flagged_by_name: flagged ? "" : null,
    })
    .eq("id", reviewId)
    .is("removed_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

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
