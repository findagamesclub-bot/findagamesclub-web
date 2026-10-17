import type { MatchSetup } from "./result-meta";
import type { ResultArmy } from "@/types/event";

/**
 * What was played in a game, and how to read it.
 *
 * In a util and not beside the read, and that is load-bearing rather than
 * tidy: both rivalry lists are client components, so importing any of this
 * from `gameDetails.service` pulls `server-only` and `next/headers` into the
 * browser bundle and the page does not build at all. `MONEY_STREAMS` and
 * `MAX_NOTICES` each fell into the same hole; this one was found the same way,
 * by opening the page after every static check had passed.
 */

/** Which game, in the two columns `game_result_armies` is keyed on. */
export type GameRef = { source: string; id: number };

export type GameDetails = {
  /** Keyed `<source>:<id>:<side>`. */
  armies: Record<string, ResultArmy | null>;
  /** Keyed `<source>:<id>`. */
  setup: Record<string, MatchSetup>;
  /**
   * Who each side of each game was, keyed `<source>:<id>:<side>`.
   *
   * The rivalry lists write every figure from one person's side, and the army
   * rows are stored in the source's own order, so without this a list showing
   * "my score first" could pair my score with my opponent's army. Carried as
   * data rather than inferred from the order.
   */
  players: Record<string, { id: string | null; name: string }>;
};

export const NO_GAME_DETAILS: GameDetails = { armies: {}, setup: {}, players: {} };

export const gameKey = (ref: GameRef) => `${ref.source}:${ref.id}`;

/** Whether there is anything worth opening for this game. */
export function gameWasRecorded(details: GameDetails, ref: GameRef): boolean {
  const base = gameKey(ref);
  return Boolean(details.armies[`${base}:one`]
    || details.armies[`${base}:two`]
    || details.setup[base]);
}

export const armyOf = (details: GameDetails, ref: GameRef, side: "one" | "two") =>
  details.armies[`${gameKey(ref)}:${side}`] ?? null;

export const setupOf = (details: GameDetails, ref: GameRef) =>
  details.setup[gameKey(ref)] ?? null;

/**
 * Which side of a game somebody played.
 *
 * The account first, because it cannot be two people; then the name, which is
 * what a league round stores when nobody linked it; then the stored order,
 * which is a guess and is only reached when the game names neither.
 */
export function sideOf(
  details: GameDetails, ref: GameRef, who: { id?: string | null; name?: string },
): "one" | "two" {
  const base = gameKey(ref);
  const two = details.players[`${base}:two`];
  if (!two) return "one";
  if (who.id && two.id === who.id) return "two";
  const one = details.players[`${base}:one`];
  if (who.id && one?.id === who.id) return "one";
  const folded = (who.name ?? "").trim().toLowerCase();
  if (folded && two.name.toLowerCase() === folded) return "two";
  return "one";
}

/** What a reader's list calls a source, to what the table stores. */
export function storedSource(source: string): string {
  if (source === "booking") return "booking";
  if (source === "competition") return "competition_match";
  return "";
}

/** And back, so a row can be filed under the name the list used. */
export function readSource(stored: string): string {
  if (stored === "booking") return "booking";
  if (stored === "competition_match") return "competition";
  return "";
}
