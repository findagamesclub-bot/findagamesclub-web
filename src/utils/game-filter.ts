import type { MyGame } from "@/services/games.service";

export type GameFilter = "all" | "played" | "unrecorded" | "won";
export type GameSort = "recent" | "oldest" | "opponent";

const fold = (value: string) => value.trim().toLowerCase();

const inGroup = (game: MyGame, filter: GameFilter) => {
  if (filter === "all") return true;
  // Recorded, whatever the outcome.
  if (filter === "played") return game.outcome !== null;
  // Played but nobody said what happened. This is the one worth acting on.
  if (filter === "unrecorded") return game.played && game.outcome === null;
  return game.outcome === "won";
};

/** Search, filter and sort a member's game history. */
export function filterGames(
  games: MyGame[],
  { query = "", filter = "all", sort = "recent" }: {
    query?: string;
    filter?: GameFilter;
    sort?: GameSort;
  },
): MyGame[] {
  const needle = fold(query);

  const kept = games.filter((game) => {
    if (!inGroup(game, filter)) return false;
    if (!needle) return true;
    return (
      fold(game.opponentName).includes(needle) ||
      fold(game.title).includes(needle) ||
      fold(game.club.name).includes(needle) ||
      fold(game.myArmy).includes(needle) ||
      fold(game.theirArmy).includes(needle)
    );
  });

  return kept.sort((a, b) => {
    if (sort === "oldest") return a.date.localeCompare(b.date);
    if (sort === "opponent") {
      return a.opponentName.localeCompare(b.opponentName) || b.date.localeCompare(a.date);
    }
    return b.date.localeCompare(a.date);
  });
}

/** Games that have happened and still have no score against them. */
export function countUnrecorded(games: MyGame[]): number {
  return games.filter((game) => game.played && game.outcome === null).length;
}

/** The member's overall record across everything shown. */
export function tally(games: MyGame[]): { played: number; won: number; drawn: number; lost: number } {
  return games.reduce(
    (total, game) => ({
      played: total.played + (game.outcome ? 1 : 0),
      won: total.won + (game.outcome === "won" ? 1 : 0),
      drawn: total.drawn + (game.outcome === "drew" ? 1 : 0),
      lost: total.lost + (game.outcome === "lost" ? 1 : 0),
    }),
    { played: 0, won: 0, drawn: 0, lost: 0 },
  );
}
