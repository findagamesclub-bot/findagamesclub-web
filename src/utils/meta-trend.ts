import { byStrength, isEarlySignal } from "./meta-signal";

/**
 * Which way a faction is going.
 *
 * Legacy carries a `trendDelta` per faction: the rate now against the rate at
 * the start of the window (club_store.py:25872). A list of every faction in
 * every month is the data behind that, not the answer to it: twelve months of
 * eight factions is ninety-six rows, and following one faction through them
 * means reading all ninety-six.
 *
 * So the trend view is one row per faction, comparing this window with the one
 * before it, which is what `previousWindow` in `meta-lens.ts` exists for.
 */

export type TrendSide = {
  factionId: string; label: string; winRate: number | null; games: number;
};

export type Trend = {
  factionId: string; label: string;
  winRate: number | null; games: number;
  /** Percentage points, positive for rising. Null when there is nothing to compare. */
  delta: number | null;
  direction: "rising" | "falling" | "steady" | "new";
  earlySignal: boolean;
};

/** Below this a move is noise, not a direction. Two games can swing 50 points. */
export const STEADY_WITHIN = 5;

export function trendRows(now: TrendSide[], before: TrendSide[]): Trend[] {
  const was = new Map(before.map((one) => [one.factionId, one]));

  const rows = now.map((one): Trend => {
    const previous = was.get(one.factionId);

    // Nothing to compare against is not a rise from zero. A faction that
    // turned up for the first time this window is new, and saying it climbed
    // from 0% would invent a past it never had.
    if (!previous || previous.winRate === null || one.winRate === null) {
      return {
        factionId: one.factionId, label: one.label,
        winRate: one.winRate, games: one.games,
        delta: null, direction: "new",
        earlySignal: isEarlySignal(one.games),
      };
    }

    const delta = Math.round((one.winRate - previous.winRate) * 10) / 10;
    return {
      factionId: one.factionId, label: one.label,
      winRate: one.winRate, games: one.games,
      delta,
      direction: Math.abs(delta) < STEADY_WITHIN
        ? "steady" : delta > 0 ? "rising" : "falling",
      earlySignal: isEarlySignal(one.games),
    };
  });

  // Biggest movers first, in both directions, then everything that held still.
  const moving = rows.filter((r) => r.direction === "rising" || r.direction === "falling");
  const rest = rows.filter((r) => r.direction === "steady" || r.direction === "new");

  moving.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)
    || a.label.localeCompare(b.label));

  return [...moving, ...byStrength(rest.map((r) => ({ ...r })))];
}

/** What the card says under the name. */
export function trendNote(row: Trend, lensLabel: string): string {
  if (row.direction === "new") return `First seen in ${lensLabel.toLowerCase()}`;
  const points = Math.abs(row.delta ?? 0).toFixed(1);
  if (row.direction === "steady") return `Holding, within ${points} points`;
  return row.direction === "rising"
    ? `Up ${points} points on the window before`
    : `Down ${points} points on the window before`;
}
