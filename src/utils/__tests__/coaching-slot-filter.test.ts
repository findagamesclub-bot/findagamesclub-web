import assert from "node:assert/strict";
import { countCoachingSlots, filterCoachingSlots } from "../coaching-slot-filter";
import type { CoachingSlot } from "@/types/clubExtras";

const slot = (over: Partial<CoachingSlot>): CoachingSlot => ({
  id: 1, title: "List clinic", description: null, date: "2026-10-17",
  startTime: "13:00", endTime: "14:10", price: "£50", coachingType: "one-to-one",
  capacity: 1, taken: 1, spacesLeft: 0, status: "open", mine: null, attendees: [],
  ...over,
});

const slots = [
  slot({ id: 1, title: "Warhammer 40k teams coaching", date: "2026-10-03",
         startTime: "10:00", status: "open", spacesLeft: 4 }),
  slot({ id: 2, title: "Beginner 40k, learn to play", date: "2026-10-10",
         startTime: "16:00", status: "open", spacesLeft: 4,
         description: "Nothing to bring and no experience needed." }),
  slot({ id: 3, title: "List clinic, bring a draft", date: "2026-10-17",
         status: "closed" }),
  slot({ id: 4, title: "Painting evening", date: "2026-10-24", status: "cancelled" }),
];

// The three status groups add up to All, so nothing can hide between tabs.
const counts = countCoachingSlots(slots);
assert.deepEqual(counts,
  { all: 4, open: 2, closed: 1, cancelled: 1, mine: 0, topay: 0 });
assert.equal(counts.open + counts.closed + counts.cancelled, counts.all);

assert.deepEqual(filterCoachingSlots(slots, {}).map((s) => s.id), [1, 2, 3, 4]);
assert.deepEqual(filterCoachingSlots(slots, { sort: "latest" }).map((s) => s.id), [4, 3, 2, 1]);

assert.deepEqual(filterCoachingSlots(slots, { filter: "open" }).map((s) => s.id), [1, 2]);
assert.deepEqual(filterCoachingSlots(slots, { filter: "cancelled" }).map((s) => s.id), [4]);

// A full session is still open: it is the club's to close, not the tab's to hide.
assert.equal(filterCoachingSlots([slot({ id: 7, spacesLeft: 0, status: "open" })],
  { filter: "open" }).length, 1);

// The name, and what it says, because either is what somebody remembers.
assert.deepEqual(filterCoachingSlots(slots, { query: "beginner" }).map((s) => s.id), [2]);
assert.deepEqual(filterCoachingSlots(slots, { query: "no experience" }).map((s) => s.id), [2]);
assert.deepEqual(filterCoachingSlots(slots, { query: "  40K " }).map((s) => s.id), [1, 2]);
assert.deepEqual(filterCoachingSlots(slots, { query: "chess" }), []);

// Two on one day split by the time rather than by luck.
const sameDay = [
  slot({ id: 8, date: "2026-10-03", startTime: "16:00" }),
  slot({ id: 9, date: "2026-10-03", startTime: "09:00" }),
];
assert.deepEqual(filterCoachingSlots(sameDay, {}).map((s) => s.id), [9, 8]);

// The caller's list is its own.
const before = [...slots];
filterCoachingSlots(slots, { sort: "latest" });
assert.deepEqual(slots, before);

// The viewer's own places cut across the statuses rather than joining them:
// a place on a closed session is still a place.
const held = [
  slot({ id: 11, status: "open", mine: { id: 1, paid: true } }),
  slot({ id: 12, status: "closed", mine: { id: 2, paid: false }, date: "2026-11-01" }),
  slot({ id: 13, status: "open", mine: null, date: "2026-11-08" }),
];
const heldCounts = countCoachingSlots(held);
assert.equal(heldCounts.mine, 2);
assert.equal(heldCounts.topay, 1);
assert.deepEqual(filterCoachingSlots(held, { filter: "mine" }).map((s) => s.id), [11, 12]);
assert.deepEqual(filterCoachingSlots(held, { filter: "topay" }).map((s) => s.id), [12]);
// And they still obey the search, so "yours" plus a word narrows rather than resets.
assert.deepEqual(
  filterCoachingSlots(held, { filter: "mine", query: "clinic" }).map((s) => s.id), [11, 12]);
assert.deepEqual(filterCoachingSlots(held, { filter: "mine", query: "chess" }), []);

console.log("coaching-slot-filter: all assertions passed");
