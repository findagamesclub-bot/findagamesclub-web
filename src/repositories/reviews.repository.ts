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

export type ClubReviewRow = {
  id: number;
  rating: number;
  comment: string | null;
  author_name: string;
  author_profile_id: string | null;
  created_at: string;
  flagged_at: string | null;
};

/**
 * A club's own reviews, for its console.
 *
 * Paged in SQL rather than read with the club: the club page embeds every
 * review to work out an average, which is fine at eleven and wrong at four
 * hundred, and this is the screen a club with four hundred opens.
 *
 * Removed ones are filtered here rather than relied on through RLS, because
 * `club_reviews_select` deliberately still returns them to the club: a review
 * an admin took down should not simply vanish from the owner's view without
 * explanation, and that is the next thing to build (DEFERRED).
 */
/** The one base query. A second copy is a second thing to get wrong. */
function narrow(supabase: Awaited<ReturnType<typeof createClient>>) {
  return (clubId: number) => supabase
    .from("club_reviews")
    .select("id, rating, comment, author_name, author_profile_id, created_at, flagged_at",
      { count: "exact" })
    .eq("club_id", clubId)
    .is("removed_at", null);
}

export type ReviewView = "all" | "low" | "reported";

/** The filter, as SQL. One place, so the list and its counts cannot disagree. */
function scoped(
  query: ReturnType<ReturnType<typeof narrow>>, view: ReviewView,
) {
  if (view === "low") return query.lte("rating", 2);
  if (view === "reported") return query.not("flagged_at", "is", null);
  return query;
}

export async function findClubReviewsPage(
  clubId: number,
  opts: { from: number; to: number; view: ReviewView; oldest: boolean },
): Promise<{ rows: ClubReviewRow[]; total: number }> {
  const supabase = await createClient();
  const { data, error, count } = await scoped(narrow(supabase)(clubId), opts.view)
    .order("created_at", { ascending: opts.oldest })
    .range(opts.from, opts.to);

  if (error) throw new Error(`Failed to load the reviews: ${error.message}`);
  return { rows: (data ?? []) as ClubReviewRow[], total: count ?? 0 };
}

/**
 * How many are in each tab, narrowed the same way the list is.
 *
 * Three index counts rather than a figure the page works out from the rows it
 * happens to be showing: "Low 2" beside a page of twenty-five has to mean two
 * in the club, not two on this page.
 */
export async function countClubReviews(clubId: number) {
  const supabase = await createClient();
  const views: ReviewView[] = ["all", "low", "reported"];

  const counts = await Promise.all(views.map(async (view) => {
    const { count } = await scoped(narrow(supabase)(clubId), view);
    return [view, count ?? 0] as const;
  }));

  return Object.fromEntries(counts) as Record<ReviewView, number>;
}
