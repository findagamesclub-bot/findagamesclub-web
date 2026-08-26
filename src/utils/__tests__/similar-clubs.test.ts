/**
 * Which clubs get recommended, and in what order.
 *
 * Run with: npx tsx src/utils/__tests__/similar-clubs.test.ts
 */

import { similarClubs } from "../similar-clubs";
import type { ClubSummary } from "@/types/club";

let failed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` +
    (ok ? "" : `\n        got ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`));
}

const club = (
  slug: string, lat: number | null, lon: number | null, games: string[],
): ClubSummary => ({
  slug, name: slug, city: "", schedule: [], formats: [], facilities: [],
  featuredGames: games,
  coordinates: lat !== null && lon !== null ? { latitude: lat, longitude: lon } : null,
});

// Didcot, and three candidates.
const me = club("didcot", 51.61, -1.24, ["Warhammer 40,000", "Age of Sigmar"]);
const nearNoGames = club("abingdon", 51.67, -1.28, ["Bolt Action"]);          // ~5 mi
const farSameGame = club("glasgow", 55.86, -4.25, ["Warhammer 40,000"]);      // ~350 mi
const nearSameGame = club("oxford", 51.75, -1.26, ["Warhammer 40,000"]);      // ~10 mi

const ranked = similarClubs(me, [nearNoGames, farSameGame, nearSameGame]);
check("a shared game outranks being closer",
  ranked.map((r) => r.club.slug), ["oxford", "glasgow", "abingdon"]);
check("shared games are named", ranked[0]!.sharedGames, ["Warhammer 40,000"]);
check("distance is measured", Math.round(ranked[0]!.miles!), 10);

check("never recommends itself",
  similarClubs(me, [me, nearSameGame]).map((r) => r.club.slug), ["oxford"]);

check("game matching ignores case and punctuation",
  similarClubs(club("a", 0, 0, ["warhammer 40000"]), [club("b", 0, 1, ["Warhammer 40,000"])])[0]!
    .sharedGames.length, 1);

// An unplaced club is not "nearby", so it must not win the tie-break.
const unplaced = club("nowhere", null, null, []);
check("clubs with no coordinates sort last",
  similarClubs(me, [unplaced, nearNoGames]).map((r) => r.club.slug), ["abingdon", "nowhere"]);

check("limit is honoured",
  similarClubs(me, [nearNoGames, farSameGame, nearSameGame], 2).length, 2);
check("an empty pool is empty, not an error", similarClubs(me, []), []);

console.log(failed ? `\n${failed} FAILING` : "\nall passing");
process.exit(failed ? 1 : 0);
