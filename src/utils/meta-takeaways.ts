/**
 * The sentences the tracker leads with.
 *
 * Legacy writes these in Python (club_store.py:25932 onwards) and the wording
 * is copied, because it is the wording the client has been reading for a year.
 * Pure, so the page renders what a test can assert.
 *
 * What is missing here is the saved army list line: lists arrive in stage 10,
 * and a sentence about a feature nobody can use yet would be the page making
 * something up.
 */

export type FactionRow = {
  factionId: string; label: string;
  games: number; winRate: number | null; appearances: number;
  averageVp: number | null;
};
export type DepthRow = {
  label: string; parent: string; games: number; winRate: number | null;
};
export type MatchupRow = {
  label: string; opponent: string; games: number; winRate: number | null;
};
export type ContextRow = { value: string; games: number };
export type UnitRow = { unitName: string; label: string; mvp: number };

const rate = (value: number | null) => `${(value ?? 0).toFixed(1)}%`;

/** Legacy's own sentence for a window nobody has played in. */
export const NOTHING_YET =
  "Not enough internal result data has been logged in this window yet to show "
  + "meaningful meta signals.";

/**
 * The lead paragraph: what is winning, and the strongest thing under it.
 */
export function metaSummary(input: {
  lensLabel: string;
  factions: FactionRow[];
  detachments: DepthRow[];
  dispositions: DepthRow[];
}): string {
  const top = input.factions[0];
  if (!top) return NOTHING_YET;

  const parts = [
    `${top.label} leads the ${input.lensLabel.toLowerCase()} sample at `
    + `${rate(top.winRate)} from ${top.games} scored `
    + `${top.games === 1 ? "game" : "games"}.`,
  ];

  const detachment = input.detachments[0];
  if (detachment) {
    parts.push(`${detachment.label} is the strongest detachment signal for `
      + `${detachment.parent}.`);
  }

  const disposition = input.dispositions[0];
  if (disposition) {
    parts.push(`${disposition.label} is the strongest recorded disposition for `
      + `${disposition.parent}.`);
  }

  return parts.join(" ");
}

/**
 * The bullets underneath, in legacy's order.
 *
 * Every one is skipped when there is nothing to say rather than printed with a
 * zero in it, which is the difference between a quiet club and a broken page.
 */
export function metaTakeaways(input: {
  factions: FactionRow[];
  detachments: DepthRow[];
  dispositions: DepthRow[];
  matchups: MatchupRow[];
  missions: ContextRow[];
  terrain: ContextRow[];
  units: UnitRow[];
}): string[] {
  const lines: string[] = [];

  const top = input.factions[0];
  if (top) {
    lines.push(`${top.label} tops this view at ${rate(top.winRate)} over `
      + `${top.games} ${top.games === 1 ? "game" : "games"}.`);
  }

  const mostPlayed = [...input.factions].sort(
    (a, b) => b.appearances - a.appearances || (b.winRate ?? 0) - (a.winRate ?? 0))[0];
  if (mostPlayed) {
    lines.push(`${mostPlayed.label} is the most played faction in this window `
      + `with ${mostPlayed.appearances} logged `
      + `${mostPlayed.appearances === 1 ? "appearance" : "appearances"}.`);
  }

  const detachment = input.detachments[0];
  if (detachment) {
    lines.push(`${detachment.label} is the strongest detachment signal for `
      + `${detachment.parent} at ${rate(detachment.winRate)}.`);
  }

  const disposition = input.dispositions[0];
  if (disposition) {
    lines.push(`${disposition.label} is the strongest recorded disposition for `
      + `${disposition.parent} at ${rate(disposition.winRate)}.`);
  }

  const unit = input.units[0];
  if (unit) {
    lines.push(`${unit.unitName} is the strongest unit signal for ${unit.label}: `
      + "tracked from the units players tagged after their own games.");
  }

  const mission = input.missions[0];
  if (mission) {
    lines.push(`${mission.value} is the busiest mission in this window with `
      + `${mission.games} logged ${mission.games === 1 ? "game" : "games"}.`);
  }

  const scoring = [...input.factions]
    .filter((one) => one.averageVp !== null)
    .sort((a, b) => (b.averageVp ?? 0) - (a.averageVp ?? 0))[0];
  if (scoring) {
    lines.push(`${scoring.label} is posting the highest average total VP in this `
      + `window at ${(scoring.averageVp ?? 0).toFixed(1)}.`);
  }

  const terrain = input.terrain[0];
  if (terrain) {
    lines.push(`${terrain.value} is the most common terrain preset in this window.`);
  }

  const matchup = input.matchups[0];
  if (matchup) {
    lines.push(`${matchup.label} has the strongest matchup signal into `
      + `${matchup.opponent} at ${rate(matchup.winRate)}.`);
  }

  return lines;
}

/**
 * Legacy's six caveats, word for word (club_store.py:26144).
 *
 * They are the honest part of the page: every one of them is a limit of what
 * this data can say, and the client has been showing them to members for a
 * year. The last two are edited only where they name a feature that does not
 * exist here yet.
 */
export const META_CAVEATS = [
  "This tracker is built only from results entered inside the app, so it reflects the Find A Games Club community sample rather than any external tournament feed.",
  "Win-rate and matchup views use scored games only. Event podiums and league tables strengthen faction, detachment and unit signals but do not create synthetic wins or losses.",
  "A table booking counts once the club has confirmed the result. Until then it is one player's word and it stays out of the numbers.",
  "Small samples are still shown, and they are flagged as early signals rather than hidden. Fewer than two scored games is a hint, not a rate.",
  "A disposition is counted under the detachment it was played with, never on its own. The tracker never invents combinations between them.",
  "The club view filters the same model down to one club, which is useful for local prep and will naturally be noisier than the site-wide sample.",
] as const;
