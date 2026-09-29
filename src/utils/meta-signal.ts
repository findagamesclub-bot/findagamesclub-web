/**
 * How much a number is worth believing.
 *
 * Legacy's threshold, copied: fewer than two games is an early signal
 * (club_store.py:8066). It is shown and flagged rather than hidden, because a
 * club that has played three games is not a broken page and should not look
 * like one.
 */

export const EARLY_SIGNAL_BELOW = 2;

export function isEarlySignal(games: number): boolean {
  return (Number(games) || 0) < EARLY_SIGNAL_BELOW;
}

/** What the chip says. One vocabulary, wherever it appears. */
export const EARLY_SIGNAL_LABEL = "Early signal";

/** Why it says it, for the title on the chip. */
export const EARLY_SIGNAL_NOTE =
  "Fewer than two scored games, so read it as a hint rather than a rate.";

/**
 * A win rate, or the honest absence of one.
 *
 * Null rather than 0 when nothing has been played: a faction taken to a
 * tournament and never scored has no win rate, and printing 0% says it lost.
 */
export function winRate(games: number, wins: number): number | null {
  const played = Number(games) || 0;
  if (played <= 0) return null;
  return Math.round((1000 * (Number(wins) || 0)) / played) / 10;
}

/** Sorted the way legacy sorts: by rate, then by sample, then by name. */
export function byStrength<T extends {
  winRate: number | null; games: number; label: string;
}>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    (b.winRate ?? -1) - (a.winRate ?? -1)
    || b.games - a.games
    || a.label.localeCompare(b.label));
}
