/**
 * The breakdowns behind a member's record.
 *
 * Legacy's dashboard answers four questions the totals cannot: who you beat,
 * who you play, what you play, and where. All four are read off games we
 * already hold, so none of this costs a query.
 *
 * A game with no outcome is a game nobody scored, not a loss. It counts
 * towards "played" and towards nothing else, which is the same rule
 * `member-stats.ts` uses and the reason a fixture nobody filled in cannot drag
 * a win rate down.
 */

export type AnalyticsGame = {
  club: { slug: string; name: string };
  title: string;
  opponentId: string | null;
  opponentName: string;
  outcome: "won" | "lost" | "drew" | null;
};

export type Breakdown = {
  /** Stable identity for React and for links. */
  key: string;
  label: string;
  /** Whether `key` is a real profile id, so an opponent row knows to link. */
  profileId: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  /** Percent, one decimal. Null until something has been scored. */
  winRate: number | null;
  /** Every club this row was played at, for the line under the name. */
  clubs: string[];
  /** "8-0-0", wins-draws-losses, the order a league table prints. */
  record: string;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

function tally(
  games: AnalyticsGame[],
  keyOf: (g: AnalyticsGame) => { key: string; label: string; profileId: string | null } | null,
): Breakdown[] {
  const rows = new Map<string, Breakdown & { clubSet: Set<string> }>();

  for (const game of games) {
    const id = keyOf(game);
    if (!id) continue;

    let row = rows.get(id.key);
    if (!row) {
      row = {
        key: id.key, label: id.label, profileId: id.profileId,
        played: 0, won: 0, drawn: 0, lost: 0, winRate: null,
        clubs: [], record: "0-0-0", clubSet: new Set<string>(),
      };
      rows.set(id.key, row);
    }

    row.played += 1;
    row.clubSet.add(game.club.name);
    if (game.outcome === "won") row.won += 1;
    if (game.outcome === "drew") row.drawn += 1;
    if (game.outcome === "lost") row.lost += 1;
  }

  return [...rows.values()].map((row) => {
    const scored = row.won + row.drawn + row.lost;
    return {
      key: row.key,
      label: row.label,
      profileId: row.profileId,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      winRate: scored ? round1((row.won / scored) * 100) : null,
      clubs: [...row.clubSet].sort(),
      record: `${row.won}-${row.drawn}-${row.lost}`,
    };
  });
}

/**
 * One row per opponent.
 *
 * Keyed on the profile id where there is one, so somebody who changes their
 * display name does not split into two people. A guest with no account is
 * keyed on their name folded to lower case, which is the best that can be done
 * for somebody the database has never met.
 */
export function byOpponent(games: AnalyticsGame[]): Breakdown[] {
  return tally(games, (g) => {
    const name = g.opponentName.trim();
    if (g.opponentId) return { key: g.opponentId, label: name || "A member", profileId: g.opponentId };
    if (!name) return null;
    return { key: `name:${name.toLowerCase()}`, label: name, profileId: null };
  });
}

/** One row per game system. Titles arrive canonicalised, so the two spellings of 40k are one row. */
export function byGame(games: AnalyticsGame[]): Breakdown[] {
  return tally(games, (g) => {
    const title = g.title.trim();
    if (!title) return null;
    return { key: `game:${title.toLowerCase()}`, label: title, profileId: null };
  });
}

/** One row per club. */
export function byClub(games: AnalyticsGame[]): Breakdown[] {
  return tally(games, (g) =>
    g.club.slug ? { key: g.club.slug, label: g.club.name, profileId: null } : null);
}

/**
 * Sorted for "who do I beat" and for "who do I play".
 *
 * Ties break on the other figure and then on name, so the order is the same on
 * every render rather than whatever the Map happened to hold.
 */
export function mostWins(rows: Breakdown[]): Breakdown[] {
  return [...rows].sort((a, b) =>
    b.won - a.won || b.played - a.played || a.label.localeCompare(b.label));
}

export function mostPlayed(rows: Breakdown[]): Breakdown[] {
  return [...rows].sort((a, b) =>
    b.played - a.played || b.won - a.won || a.label.localeCompare(b.label));
}
