import assert from "node:assert/strict";
import { searchSuggestions } from "../similar-events";
import type { EventSummary } from "@/types/eventList";

const at = (id: number, club: string, games: string[], lat?: number, date = "2026-09-01") =>
  ({ id, legacyId: `e${id}`, title: `E${id}`, startDate: date,
     featuredGames: games, club: { slug: club, name: club, city: "X", logoUrl: null },
     coordinates: lat === undefined ? null : { latitude: lat, longitude: 0 },
   } as unknown as EventSummary);

const a = at(1, "alpha", ["Warhammer 40,000"], 51);
const b = at(2, "beta", ["Warhammer 40,000"], 52);
const c = at(3, "gamma", ["Blood Bowl"], 51.1);
const sameClub = at(4, "alpha", ["Warhammer 40,000"], 51);

// The stated game filter wins over whatever the results happen to play.
let out = searchSuggestions({ results: [c], pool: [a, b, c], game: "warhammer 40k" });
assert.deepEqual(out.map((s) => s.event.id), [1, 2], "chosen game outranks result games");

// With no filter, the games in the results are the signal.
out = searchSuggestions({ results: [a], pool: [b, c] });
assert.equal(out[0].event.id, 2, "shares 40k, so it leads");
assert.deepEqual(out[0].sharedGames, ["Warhammer 40,000"]);

// Anything already on screen is never suggested back.
out = searchSuggestions({ results: [a, b], pool: [a, b, c] });
assert.deepEqual(out.map((s) => s.event.id), [3], "only the unseen one is left");

// Another night at a club you already liked is a good answer here.
out = searchSuggestions({ results: [a], pool: [sameClub, c] });
assert.equal(out[0].event.id, 4, "same club is allowed, unlike the map version");

// An empty search still suggests, ranked on the chosen game alone.
out = searchSuggestions({ results: [], pool: [a, b, c], game: "Blood Bowl" });
assert.equal(out[0].event.id, 3, "empty results still get a recommendation");

// Distance breaks a tie, measured from where they searched.
out = searchSuggestions({ results: [], pool: [b, a], game: "warhammer 40k",
                          origin: { latitude: 51, longitude: 0 } });
assert.deepEqual(out.map((s) => s.event.id), [1, 2], "nearest of the equal matches first");

// Nothing to be similar to, and nothing to measure from, still returns safely.
assert.deepEqual(searchSuggestions({ results: [], pool: [] }), []);
assert.equal(searchSuggestions({ results: [], pool: [a, b, c] }).length, 3);

console.log("searchSuggestions: all assertions passed");
