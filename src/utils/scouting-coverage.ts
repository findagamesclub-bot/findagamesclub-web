/**
 * How much a scouting pack is actually built on.
 *
 * A briefing written from two games and one written from twenty should not
 * sound equally sure of themselves, and the model will not volunteer the
 * difference. This says it above the pack, in the reader's words, so the
 * confidence is set before the prose is read.
 *
 * The thresholds are the same shape as the meta tracker's early-signal rule:
 * under two is not evidence, and the wording never rounds up.
 */

export type Coverage = {
  games: number;
  label: string;
  detail: string;
  /** Below this the pack leads with its own caveat. */
  thin: boolean;
};

export function coverageFor(params: {
  games: number;
  /** Games where an army was actually recorded, not just a score. */
  withArmies: number;
  opponentName: string;
}): Coverage {
  const games = Math.max(0, Math.floor(params.games || 0));
  const armies = Math.max(0, Math.min(games, Math.floor(params.withArmies || 0)));
  const name = params.opponentName.trim() || "this opponent";

  if (games === 0) {
    return { games, thin: true, label: "Nothing recorded",
      detail: `You have no confirmed games against ${name}, so this is built on what they have played at the club rather than on how they play you.` };
  }
  if (games < 2) {
    return { games, thin: true, label: "One game",
      detail: `Built on a single confirmed game against ${name}. Treat it as a starting point rather than a read.` };
  }
  if (armies === 0) {
    return { games, thin: true, label: `${games} games, no armies`,
      detail: `You have ${games} confirmed games against ${name}, but none of them record what was brought, so the army half of this is guesswork.` };
  }
  if (games < 5) {
    return { games, thin: false, label: `${games} games`,
      detail: `Built on ${games} confirmed games against ${name}, ${armies} of which say what they brought.` };
  }
  return { games, thin: false, label: `${games} games`,
    detail: `Built on ${games} confirmed games against ${name}, ${armies} of which say what they brought. Enough to see a pattern.` };
}
