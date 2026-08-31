import { haversineMiles } from "./geo";
import { gameKey } from "./similar-clubs";
import type { EventSummary } from "@/types/eventList";

export type SimilarEvent = {
  event: EventSummary;
  sharedGames: string[];
  miles: number | null;
};

/**
 * Events like this one, from the set already on screen.
 *
 * Same ranking as similarClubs, for the same reason: an event two towns away
 * playing your game beats one down the road playing nothing you own. Shared
 * games first, distance breaks the tie.
 *
 * One extra rule the club version does not need. Another event at the same club
 * is not a recommendation, it is the same pin, so the club's own events are
 * left out.
 */
export function similarEvents(
  to: EventSummary,
  pool: EventSummary[],
  limit = 3,
): SimilarEvent[] {
  const mine = new Set((to.featuredGames ?? []).map(gameKey));

  return pool
    .filter((e) => e.id !== to.id && e.club.slug !== to.club.slug)
    .map((event) => {
      const shared = (event.featuredGames ?? []).filter((g) => mine.has(gameKey(g)));

      const miles =
        to.coordinates && event.coordinates
          ? haversineMiles(
              to.coordinates.latitude, to.coordinates.longitude,
              event.coordinates.latitude, event.coordinates.longitude,
            )
          : null;

      return { event, sharedGames: shared, miles };
    })
    .sort((a, b) => {
      if (b.sharedGames.length !== a.sharedGames.length) {
        return b.sharedGames.length - a.sharedGames.length;
      }
      // Unplaced events sort last rather than first: null is not "nearby".
      if ((a.miles ?? Infinity) !== (b.miles ?? Infinity)) {
        return (a.miles ?? Infinity) - (b.miles ?? Infinity);
      }
      // Soonest last, so two equal matches resolve to the one you can still go to.
      return (a.event.startDate ?? "").localeCompare(b.event.startDate ?? "");
    })
    .slice(0, limit);
}
