/**
 * Who to play next.
 *
 * Legacy's scoring, ported unchanged (members.js:177), so the same club gets
 * the same suggestions it did before:
 *
 *   played before        +24, and +4 a game up to +18
 *   shared play style    +14, and +6 for each style in common
 *   shared games         +10, and +4 each up to +12
 *   similar win rate     +22 minus the gap, when both have played
 *   priority placement   +12 for a tier that pays for it
 *
 * Somebody with no reason at all is left out rather than shown with a zero:
 * "we have nothing in common" is not a recommendation.
 */
export type Candidate = {
  id: string;
  name: string;
  games: string[];
  playStyle: string[];
  /** Their record at this club. */
  played: number;
  wins: number;
  /** Their tier buys a place at the top of the list. */
  priority?: boolean;
};

export type Viewer = {
  id: string;
  games: string[];
  playStyle: string[];
  played: number;
  wins: number;
  /** Games already played against each candidate, by their id. */
  history: Map<string, number>;
};

export type Suggestion = {
  id: string;
  name: string;
  score: number;
  sharedGames: string[];
  sharedStyles: string[];
  playedBefore: number;
  winRate: number;
  reasons: string[];
};

const fold = (values: string[]) =>
  new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));

/** Percentage, or zero when they have never played. Legacy's definition. */
export function winRate(played: number, wins: number): number {
  return played > 0 ? (wins / played) * 100 : 0;
}

const both = (a: Set<string>, b: Set<string>) =>
  [...a].filter((value) => b.has(value)).sort();

export function suggestOpponents(
  viewer: Viewer,
  candidates: Candidate[],
  limit = 4,
): Suggestion[] {
  const viewerGames = fold(viewer.games);
  const viewerStyles = fold(viewer.playStyle);
  const viewerRate = winRate(viewer.played, viewer.wins);

  return candidates
    .filter((candidate) => candidate.id && candidate.id !== viewer.id)
    .map((candidate) => {
      const sharedGames = both(viewerGames, fold(candidate.games));
      const sharedStyles = both(viewerStyles, fold(candidate.playStyle));
      const playedBefore = viewer.history.get(candidate.id) ?? 0;
      const rate = winRate(candidate.played, candidate.wins);
      const gap = Math.abs(viewerRate - rate);

      let score = 0;
      const reasons: string[] = [];

      if (playedBefore > 0) {
        score += 24 + Math.min(playedBefore * 4, 18);
        reasons.push(
          `You have played ${playedBefore} time${playedBefore === 1 ? "" : "s"} before`,
        );
      }

      if (sharedStyles.length) {
        score += 14 + 6 * sharedStyles.length;
        reasons.push(sharedStyles.length === 2
          ? "You both enjoy casual and competitive games"
          : `Shared ${sharedStyles.join(" and ")} preference`);
      }

      if (sharedGames.length) {
        score += 10 + Math.min(sharedGames.length * 4, 12);
        reasons.push(`Shared games: ${sharedGames.slice(0, 2).join(", ")}`);
      }

      if (viewer.played > 0 && candidate.played > 0) {
        score += Math.max(0, 22 - gap);
        if (gap <= 10) {
          reasons.push(
            `Similar win rates: ${viewerRate.toFixed(1)}% vs ${rate.toFixed(1)}%`,
          );
        }
      }

      if (candidate.priority) {
        score += 12;
        reasons.push("Their tier gets priority placement");
      }

      return {
        id: candidate.id,
        name: candidate.name || "Club member",
        score,
        sharedGames,
        sharedStyles,
        playedBefore,
        winRate: rate,
        reasons: reasons.slice(0, 3),
      };
    })
    .filter((suggestion) => suggestion.reasons.length > 0)
    .sort((a, b) =>
      b.score - a.score
      || b.playedBefore - a.playedBefore
      || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .slice(0, limit);
}
