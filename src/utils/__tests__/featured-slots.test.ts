import assert from "node:assert/strict";

import { slotWindow, splitSlots } from "../featured-slots";

/**
 * Both ends of a slot are inclusive, which is what `featured_clubs()` and
 * `findLiveFeaturedClubIds` already say in SQL (`starts_on <= today` and
 * `ends_on >= today`). A split that disagreed with them would take a club off
 * its own billing page on the last day of a slot it was still leading the
 * homepage with.
 */
const slot = (startsOn: string, endsOn: string) => ({ startsOn, endsOn });

assert.equal(slotWindow(slot("2026-10-12", "2026-10-18"), "2026-10-17"), "live");
assert.equal(slotWindow(slot("2026-10-17", "2026-10-23"), "2026-10-17"), "live");
assert.equal(slotWindow(slot("2026-10-11", "2026-10-17"), "2026-10-17"), "live");
assert.equal(slotWindow(slot("2026-10-18", "2026-10-24"), "2026-10-17"), "upcoming");
assert.equal(slotWindow(slot("2026-10-04", "2026-10-16"), "2026-10-17"), "past");

// The order each group reads in, which is the whole reason this is not three
// filters at the call site.
const split = splitSlots([
  slot("2026-12-07", "2026-12-13"),
  slot("2026-09-23", "2026-09-29"),
  slot("2026-10-12", "2026-10-18"),
  slot("2026-11-02", "2026-11-08"),
  slot("2026-08-03", "2026-08-09"),
], "2026-10-17");

assert.deepEqual(split.live.map((s) => s.startsOn), ["2026-10-12"]);
// Soonest first: the next one is the one being waited on.
assert.deepEqual(split.upcoming.map((s) => s.startsOn), ["2026-11-02", "2026-12-07"]);
// Newest first: the last one held is the one worth reading.
assert.deepEqual(split.past.map((s) => s.startsOn), ["2026-09-23", "2026-08-03"]);

// Nothing at all is three empty lists rather than anything to guard against.
assert.deepEqual(splitSlots([], "2026-10-17"), { live: [], upcoming: [], past: [] });

console.log("featured-slots: all assertions passed");
