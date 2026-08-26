import { haversineMiles } from "./geo";
import { fold } from "./text";
import type { ClubSummary } from "@/types/club";

export type SimilarClub = { club: ClubSummary; sharedGames: string[]; miles: number | null };

/**
 * Game names come from clubs' own free text, so the same game appears as
 * "Warhammer 40,000", "warhammer 40k" and "warhammer 40000" across the
 * directory. fold() alone leaves a space where the comma was, so it misses
 * those; collapsing spaces too closes it. Deliberately local — fold() itself
 * backs the whole search and must not get looser.
 */
export function gameKey(name: string): string {
  return fold(name).replace(/\s+/g, "");
}

/**
 * Clubs like this one, from the set already on screen.
 *
 * Legacy words it "based on nearby listings and featured games in this search",
 * and that ordering is the right one: a club two towns away that plays your
 * game beats one next door that plays nothing you own. Shared games rank first,
 * distance breaks the tie.
 *
 * Drawn from the current results rather than the whole directory, so a filtered
 * search recommends inside its own filter instead of ignoring it.
 */
export function similarClubs(
  to: ClubSummary,
  pool: ClubSummary[],
  limit = 3,
): SimilarClub[] {
  const mine = new Set((to.featuredGames ?? []).map(gameKey));

  return pool
    .filter((c) => c.slug !== to.slug)
    .map((club) => {
      const shared = (club.featuredGames ?? []).filter((g) => mine.has(gameKey(g)));

      const miles =
        to.coordinates && club.coordinates
          ? haversineMiles(
              to.coordinates.latitude, to.coordinates.longitude,
              club.coordinates.latitude, club.coordinates.longitude,
            )
          : null;

      return { club, sharedGames: shared, miles };
    })
    .sort((a, b) => {
      if (b.sharedGames.length !== a.sharedGames.length) {
        return b.sharedGames.length - a.sharedGames.length;
      }
      // Unplaced clubs sort last rather than first: null is not "nearby".
      return (a.miles ?? Infinity) - (b.miles ?? Infinity);
    })
    .slice(0, limit);
}
