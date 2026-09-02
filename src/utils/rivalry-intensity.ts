/**
 * How hot a rivalry is, on legacy's formula (club_store.py:20060).
 *
 * Ten a game, up to twelve more for how close it is on points, eight more if
 * they have met in the last three months. It rewards a close series that is
 * still running over a long one that finished years ago, which is the thing a
 * bare win-loss record cannot say.
 */
export type Intensity = "High" | "Medium" | "Emerging" | "New";

const RECENT_DAYS = 90;

export function rivalryScore(
  played: number,
  differential: number,
  lastPlayed: string | null,
  today = new Date(),
) {
  if (played <= 0) return 0;

  const closeness = Math.max(0, 12 - Math.abs(differential));
  const cutoff = new Date(today.getTime() - RECENT_DAYS * 86400000);
  // Dates are calendar days, so compare them as text rather than parsing them
  // into a timezone that can move the day.
  const recent = lastPlayed !== null && lastPlayed >= cutoff.toISOString().slice(0, 10);

  return Math.round((played * 10 + closeness + (recent ? 8 : 0)) * 10) / 10;
}

export function intensityOf(
  played: number,
  differential: number,
  lastPlayed: string | null,
  today = new Date(),
): Intensity {
  const score = rivalryScore(played, differential, lastPlayed, today);
  if (score >= 35) return "High";
  if (score >= 20) return "Medium";
  return score > 0 ? "Emerging" : "New";
}
