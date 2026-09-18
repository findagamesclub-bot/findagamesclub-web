/**
 * A round drawn from the people who turned up.
 *
 * Random, which is what a club night tournament actually does for round one.
 * Swiss reads the standings and is its own piece of work; this is the button
 * that saves twenty minutes between rounds.
 */

export type Player = { profileId: string | null; name: string };

export type DrawnMatch = {
  table: string;
  playerOne: Player;
  /** Null is a bye, and an odd turnout always produces exactly one. */
  playerTwo: Player | null;
};

/**
 * One row per person, however many times they have booked.
 *
 * The roster is built from bookings, and somebody can book six times: two
 * tickets in September, one more when a friend drops out, another on the day.
 * Left as they come, that person appears six times in the draw, gets paired
 * with the same opponent three times over and, on one table, with themselves.
 *
 * Matched on the account when there is one, on the folded name when there is
 * not, because a booking made at the door carries a name and nothing else.
 */
export function uniquePlayers(players: Player[]): Player[] {
  const seen = new Map<string, Player>();

  for (const player of players) {
    const name = player.name.trim();
    if (!name) continue;
    const key = player.profileId ?? `name:${name.toLowerCase()}`;
    // The first one wins, so the earliest booking is the one that carries the
    // account if a later one was made without signing in.
    if (!seen.has(key)) seen.set(key, { profileId: player.profileId, name });
  }

  return [...seen.values()];
}

/**
 * Fisher-Yates over a copy.
 *
 * The random source is a parameter so a test can pin the order. `Math.random`
 * is the default and nothing else ever passes one.
 */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = out[i]!;
    out[i] = out[j]!;
    out[j] = swap;
  }
  return out;
}

/**
 * Pair everybody up, tables numbered from one.
 *
 * An odd number of players leaves the last one with a bye rather than dropping
 * them: somebody who paid and turned up has to appear on the draw, even if
 * there is nobody to play.
 */
export function drawRound(
  players: Player[], random: () => number = Math.random,
): DrawnMatch[] {
  // Deduplicated here as well as at the source, because a draw that pairs
  // somebody with themselves is the one outcome nobody can play.
  const order = shuffle(uniquePlayers(players), random);
  const matches: DrawnMatch[] = [];

  for (let i = 0; i < order.length; i += 2) {
    matches.push({
      table: String(matches.length + 1),
      playerOne: order[i]!,
      playerTwo: order[i + 1] ?? null,
    });
  }

  return matches;
}

/** "10 tables, one bye" and the like, for the button's confirmation. */
export function drawSummary(matches: DrawnMatch[]): string {
  if (!matches.length) return "Nobody to pair yet.";
  const byes = matches.filter((m) => !m.playerTwo).length;
  const tables = matches.length - byes;
  const parts = [`${tables} ${tables === 1 ? "table" : "tables"}`];
  if (byes) parts.push("one bye");
  return parts.join(" and ");
}
