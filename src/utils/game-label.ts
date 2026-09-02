import labels from "./canonical-labels.json";

const games = labels.games as Record<string, string>;

/**
 * One spelling per game.
 *
 * Members type the game into a booking themselves, so the same night turns up
 * as "warhammer 40k" and "Warhammer 40,000". Left alone, a head-to-head splits
 * one game system across two rows and neither row is the real record. The
 * import script folds the same synonyms (scripts/export-legacy-data.py), which
 * is why they share this file rather than each keeping a list.
 */
export function canonicalGame(label: string | null | undefined): string {
  const raw = String(label ?? "").trim();
  if (!raw) return "Club game";
  return games[raw.toLowerCase()] ?? raw;
}
