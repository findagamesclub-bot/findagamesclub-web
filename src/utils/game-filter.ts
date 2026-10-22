import type { MyGame } from "@/services/games.service";
import { monthLabel, type FacetOption } from "./booking-facets";
import { tableIsFree, tableIsPaid } from "./table-bookings";

export type GameFilter = "all" | "played" | "unrecorded" | "won";
export type GameSort = "recent" | "oldest" | "opponent";

/**
 * Where a game stands on money, from the member's side.
 *
 * The same three groups the club's Table payments screen uses, read through
 * the same rules: a table a tier waived is not an unpaid one, and counting it
 * as one is how somebody is chased for money their membership covered.
 */
export type GameMoney = "any" | "topay" | "paid" | "free";

const fold = (value: string) => value.trim().toLowerCase();

/** A booking's own month, which is the key the picker filters on. */
export const monthOf = (game: MyGame) => game.date.slice(0, 7);

const inMoney = (game: MyGame, money: GameMoney) => {
  if (money === "any") return true;
  // Built out rather than spread: a booking's own status and its payment
  // status are two different facts and `Payable` names them apart on purpose.
  // A booking on the member's own history is never a cancelled one, because
  // the read is keyed on the seats and cancelling gives the seat up.
  const row = {
    status: "booked",
    total: game.payment.total,
    paymentStatus: game.payment.status,
  };
  if (money === "free") return tableIsFree(row);
  if (money === "paid") return !tableIsFree(row) && tableIsPaid(row);
  return !tableIsFree(row) && !tableIsPaid(row);
};

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
  { query = "", filter = "all", sort = "recent", month = "", money = "any" }: {
    query?: string;
    filter?: GameFilter;
    sort?: GameSort;
    /** "YYYY-MM", or empty for every game they have played. */
    month?: string;
    money?: GameMoney;
  },
): MyGame[] {
  const needle = fold(query);
  const when = month.trim();

  const kept = games.filter((game) => {
    if (!inGroup(game, filter)) return false;
    if (when && monthOf(game) !== when) return false;
    if (!inMoney(game, money)) return false;
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

/**
 * The months this member has played in, newest first, with what each holds.
 *
 * Built from the games already in hand rather than asked for: their whole
 * history is on the page, which is the line this codebase draws between a
 * member's own handful and a club's thousands. Every option has games behind
 * it, the same rule the club's own pickers follow.
 */
export function gameMonths(games: MyGame[]): FacetOption[] {
  const held = new Map<string, number>();
  for (const game of games) {
    const month = monthOf(game);
    held.set(month, (held.get(month) ?? 0) + 1);
  }
  return [...held.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, count]) => ({
      value: month, label: `${monthLabel(month)} (${count})`,
    }));
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
