/**
 * When a member plays, and how the run is going.
 *
 * Split from `member-analytics.ts` because these two read the calendar and
 * everything there reads a tally. They also carry the timezone rule that file
 * does not need, and it is worth having that written once next to the code it
 * governs.
 */

import type { AnalyticsGame } from "./member-analytics";

export type DatedGame = { date: string; outcome: AnalyticsGame["outcome"] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type MonthBucket = {
  /** "2026-09", so buckets sort and key without a Date in the component. */
  key: string;
  /** "Sep", with the year appended in January so a 12-month run is readable. */
  label: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  unscored: number;
};

/**
 * Games per month, ending on the month `today` falls in.
 *
 * Every month is present whether anything happened in it or not: the gaps are
 * the point. A chart that silently drops empty months tells a member who
 * played twice in March and twice in September that they play steadily.
 *
 * Dates are read with UTC getters. `new Date("2026-09-03")` parses as UTC
 * midnight, so `getMonth()` reads it in the viewer's timezone and anybody
 * behind UTC sees the game fall in the month before.
 */
export function gamesByMonth(
  games: DatedGame[],
  today: string,
  months = 12,
): MonthBucket[] {
  const end = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return [];

  const buckets = new Map<string, MonthBucket>();
  for (let back = months - 1; back >= 0; back -= 1) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - back, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const name = MONTHS[d.getUTCMonth()]!;
    buckets.set(key, {
      key,
      // The year only where the run turns over, so twelve labels do not
      // become twelve dates.
      label: d.getUTCMonth() === 0 ? `${name} ${String(d.getUTCFullYear()).slice(2)}` : name,
      played: 0, won: 0, drawn: 0, lost: 0, unscored: 0,
    });
  }

  for (const game of games) {
    const bucket = buckets.get((game.date ?? "").slice(0, 7));
    if (!bucket) continue;
    bucket.played += 1;
    if (game.outcome === "won") bucket.won += 1;
    else if (game.outcome === "drew") bucket.drawn += 1;
    else if (game.outcome === "lost") bucket.lost += 1;
    else bucket.unscored += 1;
  }

  return [...buckets.values()];
}

/**
 * The last few results, oldest first, for a form guide.
 *
 * Unscored games are left out entirely rather than shown as a gap: a form
 * guide is a run of results, and a fixture nobody filled in is not a result.
 */
export function formGuide(
  games: DatedGame[],
  count = 10,
): ("won" | "drew" | "lost")[] {
  return [...games]
    .filter((g) => g.outcome !== null)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .slice(-count)
    .map((g) => g.outcome as "won" | "drew" | "lost");
}

/**
 * The length of every winning run, oldest first.
 *
 * "Longest win streak: 2" says how good the best run was and nothing about how
 * often the member gets one. Three runs of two reads very differently from one
 * run of two in a season, and both produce the same number.
 *
 * Draws break a run rather than extending it, the same way a league table
 * reads them, and unscored games are skipped entirely: a fixture nobody filled
 * in should not cut a winning run in half.
 */
export function winRuns(games: DatedGame[]): number[] {
  const runs: number[] = [];
  let run = 0;

  for (const game of [...games]
    .filter((g) => g.outcome !== null)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))) {
    if (game.outcome === "won") {
      run += 1;
    } else if (run > 0) {
      runs.push(run);
      run = 0;
    }
  }
  if (run > 0) runs.push(run);

  return runs;
}
