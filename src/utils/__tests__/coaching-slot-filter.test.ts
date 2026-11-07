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

// Every tab answers one question; they are not a partition and are not meant
// to be. With no day in hand nothing is past, so `active` is every open
// session, which is exactly what the club page shows: it is only ever handed
// sessions still to come.
const counts = countCoachingSlots(slots);
assert.deepEqual(counts,
  { all: 4, past: 0, active: 2, closed: 1, cancelled: 1, mine: 0, topay: 0 });

assert.deepEqual(filterCoachingSlots(slots, {}).map((s) => s.id), [1, 2, 3, 4]);
assert.deepEqual(filterCoachingSlots(slots, { sort: "latest" }).map((s) => s.id), [4, 3, 2, 1]);

assert.deepEqual(filterCoachingSlots(slots, { filter: "active" }).map((s) => s.id), [1, 2]);
assert.deepEqual(filterCoachingSlots(slots, { filter: "cancelled" }).map((s) => s.id), [4]);

// A full session is still active: it is the club's to close, not the tab's to
// hide, and a club looking at what it is running wants the full one in front
// of it rather than filed away.
assert.equal(filterCoachingSlots([slot({ id: 7, spacesLeft: 0, status: "open" })],
  { filter: "active" }).length, 1);

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

// Time is its own axis. A date going by is not something the club DID to a
// session, so Past cuts across the statuses the way `mine` does, and today
// itself is not past.
const past = countCoachingSlots(slots, "2026-10-17");
assert.equal(past.past, 2);
assert.deepEqual(
  filterCoachingSlots(slots, { filter: "past", today: "2026-10-17" }).map((s) => s.id),
  [1, 2]);

// It really does cut across them: once every date is behind us, the closed one
// and the called-off one are in Past as well.
const allBehind = countCoachingSlots(slots, "2026-10-25");
assert.equal(allBehind.past, 4);
assert.deepEqual(
  filterCoachingSlots(slots, { filter: "past", today: "2026-10-25" }).map((s) => s.id),
  [1, 2, 3, 4]);

// And with no day in hand it answers nothing rather than guessing one, which
// is what keeps the tab off a screen that cannot say what today is. This pins
// the behaviour and not the `Boolean(today)` guard: every real date sorts
// after "", so the comparison alone already answers false and removing the
// guard leaves this green. It is there to say the intent out loud.
assert.equal(countCoachingSlots(slots).past, 0);
assert.deepEqual(filterCoachingSlots(slots, { filter: "past" }), []);

// ------------------------------------------------- what can still be booked
//
// The client's own report: seven sessions, "Open 7", and three cards on screen
// dated weeks ago. Status and date are two facts and the tabs only read the
// first, so a session that is open and over sat in the tab for things members
// can book.
const yearBehind = [
  slot({ id: 21, date: "2026-08-25", status: "open" }),
  slot({ id: 22, date: "2026-09-05", status: "open" }),
  slot({ id: 23, date: "2026-12-12", status: "open" }),
  slot({ id: 24, date: "2026-12-20", status: "closed" }),
];
const today = "2026-11-06";

// One of the four is bookable. Reading the status alone answers three, which
// is the number the client was shown.
assert.equal(countCoachingSlots(yearBehind, today).active, 1);
assert.deepEqual(
  filterCoachingSlots(yearBehind, { filter: "active", today }).map((s) => s.id), [23]);

// And the ones it leaves out are not lost: Past holds both, and All holds
// everything, so no session is in no tab.
assert.equal(countCoachingSlots(yearBehind, today).past, 2);
assert.deepEqual(
  filterCoachingSlots(yearBehind, { filter: "past", today }).map((s) => s.id), [21, 22]);
assert.equal(countCoachingSlots(yearBehind, today).all, 4);

// A session the club closed and that has also happened is in both, because
// those are two different facts about it and the club may want either.
const closedAndOver = [slot({ id: 25, date: "2026-08-01", status: "closed" })];
assert.equal(countCoachingSlots(closedAndOver, today).closed, 1);
assert.equal(countCoachingSlots(closedAndOver, today).past, 1);
assert.equal(countCoachingSlots(closedAndOver, today).active, 0);

// Today is not past, so a session running this evening is still bookable.
assert.equal(
  countCoachingSlots([slot({ id: 26, date: today, status: "open" })], today).active, 1);
assert.equal(
  countCoachingSlots([slot({ id: 26, date: today, status: "open" })], today).past, 0);

console.log("coaching-slot-filter: all assertions passed");
