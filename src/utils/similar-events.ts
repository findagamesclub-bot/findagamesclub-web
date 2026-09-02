import { haversineMiles } from "./geo";
import { gameKey } from "./similar-clubs";
import type { EventSummary } from "@/types/eventList";

export type SimilarEvent = {
  event: EventSummary;
  sharedGames: string[];
  miles: number | null;
};

/**
 * Events like the search somebody just ran.
 *
 * There is no single event to be similar to at the bottom of a search, so the
 * thing to be similar to is the search itself: the game they filtered by, or
 * failing that the games their results happen to play, and how far each
 * candidate is from where they were looking.
 *
 * Anything already in the results is excluded, because a recommendation that
 * repeats what is directly above it is not a recommendation. Another night at
 * a club the results already cover is fair game though: somebody who liked two
 * nights at a club will often like the third.
 */
export function searchSuggestions(params: {
  /** What the search returned. Their games are the fallback signal. */
  results: EventSummary[];
  /** Everything we could suggest, already narrowed to upcoming or past. */
  pool: EventSummary[];
  /** The game chip, when one is set. A stated preference beats an inferred one. */
  game?: string | null;
  /** Where they searched from, when they named a place. */
  origin?: { latitude: number; longitude: number } | null;
  limit?: number;
}): SimilarEvent[] {
  const { results, pool, game, origin, limit = 3 } = params;

  // A game they chose outranks games we inferred from the results, and when
  // the results are empty the chosen game is the only signal there is.
  const wanted = new Set(
    game
      ? [gameKey(game)]
      : results.flatMap((e) => (e.featuredGames ?? []).map(gameKey)),
  );

  const shown = new Set(results.map((e) => e.id));

  // Distance from where they searched, or failing that from the results they
  // did get. Neither means we simply cannot say, and rank on games alone.
  const from = origin
    ?? results.find((e) => e.coordinates)?.coordinates
    ?? null;

  return pool
    .filter((e) => !shown.has(e.id))
    .map((event) => {
      const shared = (event.featuredGames ?? []).filter((g) => wanted.has(gameKey(g)));
      const miles =
        from && event.coordinates
          ? haversineMiles(
              from.latitude, from.longitude,
              event.coordinates.latitude, event.coordinates.longitude,
            )
          : null;
      return { event, sharedGames: shared, miles };
    })
    .sort((a, b) => {
      if (b.sharedGames.length !== a.sharedGames.length) {
        return b.sharedGames.length - a.sharedGames.length;
      }
      if ((a.miles ?? Infinity) !== (b.miles ?? Infinity)) {
        return (a.miles ?? Infinity) - (b.miles ?? Infinity);
      }
      return (a.event.startDate ?? "").localeCompare(b.event.startDate ?? "");
    })
    .slice(0, limit);
}
