import assert from "node:assert/strict";
import { similarEvents } from "../similar-events";
import type { EventSummary } from "@/types/eventList";

const at = (id: number, club: string, games: string[], lat = 51.6, lon = -1.2): EventSummary => ({
  id, legacyId: `e${id}`, title: `Event ${id}`, summary: null,
  startDate: "2026-09-01", startTime: null, endDate: null, endTime: null, eventType: null,
  price: null, fromPrice: null, roundCount: null, ticketsAvailable: null, venueName: null,
  venue: { name: null, address: null, postcode: null },
  featuredGames: games, eventTypes: [], formats: [], facilities: [], weekday: null,
  hasEnded: false, club: { slug: club, name: club, city: "Didcot", logoUrl: null },
  coordinates: { latitude: lat, longitude: lon },
  distanceMiles: null, clubFormats: [], image: null, winner: null,
});

const base = at(1, "home", ["Warhammer 40,000", "Kill Team"]);

// Another event at the same club is the same pin, not a recommendation.
{
  const out = similarEvents(base, [base, at(2, "home", ["Warhammer 40,000"]), at(3, "away", [])]);
  assert.deepEqual(out.map((s) => s.event.id), [3]);
}

// Shared games outrank distance, however far away. "warhammer 40000" and
// "Warhammer 40,000" are the same game to gameKey; "warhammer 40k" is not,
// which is why the directory still lists it as its own filter.
{
  const near = at(2, "near", ["Bolt Action"], 51.61, -1.2);
  const far = at(3, "far", ["warhammer 40000"], 55.8, -4.2);
  const out = similarEvents(base, [near, far]);
  assert.equal(out[0].event.id, 3, "the far club sharing a game should lead");
  assert.deepEqual(out[0].sharedGames, ["warhammer 40000"]);
}

// Distance breaks a tie when neither shares a game.
{
  const near = at(2, "near", [], 51.61, -1.2);
  const far = at(3, "far", [], 55.8, -4.2);
  assert.deepEqual(similarEvents(base, [far, near]).map((s) => s.event.id), [2, 3]);
}

console.log("similar-events ok");
