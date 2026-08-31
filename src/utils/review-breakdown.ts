/** How a club's reviews are spread across the five ratings. */
export type RatingBand = {
  rating: number;
  count: number;
  /** Share of all reviews, 0-100, for the bar. */
  percent: number;
};

/**
 * The breakdown, highest rating first.
 *
 * Only ratings somebody actually gave are returned. Five rows where four read
 * zero is a chart of nothing, and legacy's dropdown had the matching fault:
 * it offered "2 stars" on a club whose reviews were all fives, and picking it
 * emptied the list.
 */
export function ratingBands(ratings: number[]): RatingBand[] {
  const total = ratings.length;
  if (!total) return [];

  const counts = new Map<number, number>();
  for (const rating of ratings) {
    const star = Math.round(rating);
    if (star < 1 || star > 5) continue;
    counts.set(star, (counts.get(star) ?? 0) + 1);
  }

  return [5, 4, 3, 2, 1]
    .filter((star) => counts.has(star))
    .map((star) => {
      const count = counts.get(star) ?? 0;
      return { rating: star, count, percent: Math.round((count / total) * 100) };
    });
}

/** "8 five-star reviews", for the line that says what you are looking at. */
const WORDS = ["", "one", "two", "three", "four", "five"];

export function bandLabel(rating: number, count: number): string {
  const word = WORDS[Math.round(rating)] ?? String(rating);
  return `${count} ${word}-star review${count === 1 ? "" : "s"}`;
}
