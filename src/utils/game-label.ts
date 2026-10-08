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

/**
 * The games this app has a canonical spelling for, for a picker to offer.
 *
 * Derived from the same file `canonicalGame` folds against rather than typed
 * out again, so a game added to the synonym list turns up in the dropdown
 * without anybody remembering to. The list is deliberately short: it is what
 * the clubs on this site actually play, and the box takes free text for
 * everything else.
 */
export function knownGames(): string[] {
  return [...new Set(Object.values(games))].sort((a, b) => a.localeCompare(b, "en-GB"));
}
