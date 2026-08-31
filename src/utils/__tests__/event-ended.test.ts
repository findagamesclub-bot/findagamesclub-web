import assert from "node:assert/strict";
import { hasEnded } from "../event-summary";
import { londonNow } from "../dates";

const now = { date: "2026-08-28", time: "14:30" };

// Plain dates.
assert.equal(hasEnded(null, "2026-08-27", null, now), true, "yesterday is over");
assert.equal(hasEnded(null, "2026-08-29", null, now), false, "tomorrow is not");
assert.equal(hasEnded("2026-08-30", "2026-08-27", null, now), false,
  "a multi-day event running now is not over");

// On the day, with no end time, it runs to midnight.
assert.equal(hasEnded(null, "2026-08-28", null, now), false);

// On the day, an end time decides it. This is the legacy rule we were missing.
assert.equal(hasEnded(null, "2026-08-28", "17:00", now), false, "ends later today");
assert.equal(hasEnded(null, "2026-08-28", "14:30", now), false, "ending this minute is not past");
assert.equal(hasEnded(null, "2026-08-28", "12:00", now), true, "finished at lunchtime");

// An end time on a different day must not override the date.
assert.equal(hasEnded(null, "2026-08-29", "09:00", now), false, "tomorrow morning is not over");
assert.equal(hasEnded(null, "2026-08-27", "23:59", now), true, "late finish yesterday is over");

// Undated events count as over, matching legacy. This was the disagreement:
// the club page said upcoming, the directory said past.
assert.equal(hasEnded(null, null, null, now), true);
assert.equal(hasEnded(null, null, "17:00", now), true);

// London wall clock, not the viewer's. Midnight UTC in summer is 01:00 in
// London, so a UTC-based reading would roll the date over an hour early.
{
  const at = new Date("2026-06-15T23:30:00Z");   // 00:30 on the 16th in London
  const l = londonNow(at);
  assert.equal(l.date, "2026-06-16", `expected the London date, got ${l.date}`);
  assert.equal(l.time, "00:30");
}
{
  const at = new Date("2026-01-15T23:30:00Z");   // GMT, so no shift
  assert.deepEqual(londonNow(at), { date: "2026-01-15", time: "23:30" });
}

console.log("event-ended ok");
