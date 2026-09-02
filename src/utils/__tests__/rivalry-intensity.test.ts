import assert from "node:assert/strict";
import { intensityOf, rivalryScore } from "../rivalry-intensity";

const today = new Date("2026-09-02T00:00:00Z");

// Nobody has played: legacy calls that New, not Emerging.
assert.equal(rivalryScore(0, 0, null, today), 0);
assert.equal(intensityOf(0, 0, null, today), "New");

// One game, wide margin, long ago: 10 + 0 + 0.
assert.equal(rivalryScore(1, 30, "2025-01-01", today), 10);
assert.equal(intensityOf(1, 30, "2025-01-01", today), "Emerging");

// Two games, level on points, played last month: 20 + 12 + 8.
assert.equal(rivalryScore(2, 0, "2026-08-20", today), 40);
assert.equal(intensityOf(2, 0, "2026-08-20", today), "High");

// The same pair a year later, with nothing since: 20 + 12.
assert.equal(rivalryScore(2, 0, "2025-08-20", today), 32);
assert.equal(intensityOf(2, 0, "2025-08-20", today), "Medium");

// Exactly on the ninety-day edge still counts as recent.
assert.equal(rivalryScore(1, 12, "2026-06-04", today), 18);

// Sign does not matter: being 24 behind is as wide as being 24 ahead.
assert.equal(rivalryScore(2, -24, null, today), rivalryScore(2, 24, null, today));

console.log("rivalry-intensity ok");
