/**
 * What a member's own record adds up to.
 *
 * Every figure here is read off games we already hold: an outcome, and the two
 * scores when somebody put them in. Nothing new is captured for this.
 *
 * A game with no outcome is not a loss, it is a game nobody scored. Counting
 * those would tell a member they are losing when they have simply not recorded
 * anything, so unscored games are excluded from every calculation except the
 * count of games they have played.
 */

export type StatGame = {
  date: string;
  outcome: "won" | "lost" | "drew" | null;
  myScore: number | null;
  theirScore: number | null;
};

export type MemberRecord = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  /** Percent, one decimal. Null when nothing has been scored. */
  winRate: number | null;
  /** Averages across scored games, one decimal. Null when none carry scores. */
  averageFor: number | null;
  averageAgainst: number | null;
  /** The run they are on now, most recent first. */
  streak: { kind: "won" | "lost" | "drew"; length: number } | null;
  longestWin: number;
  /** Their last five, oldest to newest, as "2-1-2". */
  lastFive: string;
  /** Percent across those five only. Null when they have played none. */
  lastFiveWinRate: number | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Newest first, which is the order every calculation below assumes. */
function byNewest(games: StatGame[]): StatGame[] {
  return [...games].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function memberRecord(games: StatGame[]): MemberRecord {
  const scored = byNewest(games.filter((g) => g.outcome !== null));

  const won = scored.filter((g) => g.outcome === "won").length;
  const drawn = scored.filter((g) => g.outcome === "drew").length;
  const lost = scored.filter((g) => g.outcome === "lost").length;

  const withScores = scored.filter(
    (g) => typeof g.myScore === "number" && typeof g.theirScore === "number",
  );

  // The current run. Draws break a run rather than extending it, the same way
  // a league table reads them.
  let streak: MemberRecord["streak"] = null;
  if (scored.length) {
    const kind = scored[0]!.outcome!;
    let length = 0;
    for (const g of scored) {
      if (g.outcome !== kind) break;
      length += 1;
    }
    streak = { kind, length };
  }

  let longestWin = 0;
  let run = 0;
  for (const g of scored) {
    run = g.outcome === "won" ? run + 1 : 0;
    if (run > longestWin) longestWin = run;
  }

  const five = scored.slice(0, 5);
  const lastFive = [
    five.filter((g) => g.outcome === "won").length,
    five.filter((g) => g.outcome === "drew").length,
    five.filter((g) => g.outcome === "lost").length,
  ].join("-");

  return {
    played: scored.length,
    won,
    drawn,
    lost,
    winRate: scored.length ? round1((won / scored.length) * 100) : null,
    averageFor: withScores.length
      ? round1(withScores.reduce((n, g) => n + g.myScore!, 0) / withScores.length)
      : null,
    averageAgainst: withScores.length
      ? round1(withScores.reduce((n, g) => n + g.theirScore!, 0) / withScores.length)
      : null,
    streak,
    longestWin,
    lastFive,
    // Across those five, not across everything. A "last five" figure sitting
    // under a career win rate reads as the wrong number for the label.
    lastFiveWinRate: five.length
      ? round1((five.filter((g) => g.outcome === "won").length / five.length) * 100)
      : null,
  };
}

export type TrendPoint = { date: string; mine: number; theirs: number };

/**
 * The scored games, oldest first, for the trend line.
 *
 * Capped: a chart of two hundred points is a smear, and the question it answers
 * is "how am I doing lately".
 */
export function scoreTrend(games: StatGame[], limit = 12): TrendPoint[] {
  return byNewest(games)
    .filter((g) => typeof g.myScore === "number" && typeof g.theirScore === "number")
    .slice(0, limit)
    .reverse()
    .map((g) => ({ date: g.date, mine: g.myScore!, theirs: g.theirScore! }));
}

/** "Won 3 in a row" / "On a 2-game losing run" / null when there is no run. */
export function streakLabel(streak: MemberRecord["streak"]): string | null {
  if (!streak || streak.length === 0) return null;
  if (streak.kind === "won") return streak.length === 1 ? "Won the last one" : "Win streak";
  if (streak.kind === "lost") return streak.length === 1 ? "Lost the last one" : "Loss streak";
  return streak.length === 1 ? "Drew the last one" : "Drawing run";
}
