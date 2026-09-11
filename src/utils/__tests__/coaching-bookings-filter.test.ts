import assert from "node:assert/strict";
import {
  countCoachingBookings, filterCoachingBookings, type CoachingBookingRow,
} from "../coaching-bookings-filter";

const row = (over: Partial<CoachingBookingRow>): CoachingBookingRow => ({
  id: 1, name: "Joe Matthews", paid: false, slotId: 1, title: "List clinic",
  date: "2026-10-17", time: "13:00", price: "£50", cancelled: false, ...over,
});

const rows = [
  row({ id: 1, name: "Joe Matthews", paid: true, title: "Warhammer 40k teams coaching",
        date: "2026-10-03", time: "10:00" }),
  row({ id: 2, name: "Gulnabi Afridi", paid: false, title: "List clinic, bring a draft",
        date: "2026-10-17", time: "13:00" }),
  row({ id: 3, name: "Sara Khan", paid: false, title: "Beginner 40k, learn to play",
        date: "2026-10-10", time: "16:00", cancelled: true }),
];

assert.deepEqual(countCoachingBookings(rows), { all: 3, unpaid: 2, paid: 1 });

// Soonest first, which is the order a club works through them in.
assert.deepEqual(filterCoachingBookings(rows, {}).map((r) => r.id), [1, 3, 2]);
assert.deepEqual(filterCoachingBookings(rows, { sort: "latest" }).map((r) => r.id), [2, 3, 1]);

// The question the list exists to answer.
assert.deepEqual(filterCoachingBookings(rows, { filter: "unpaid" }).map((r) => r.id), [3, 2]);
assert.deepEqual(filterCoachingBookings(rows, { filter: "paid" }).map((r) => r.id), [1]);

// A club searches for whichever of the two it has in front of it.
assert.deepEqual(filterCoachingBookings(rows, { query: "gulnabi" }).map((r) => r.id), [2]);
assert.deepEqual(filterCoachingBookings(rows, { query: "beginner" }).map((r) => r.id), [3]);
assert.deepEqual(filterCoachingBookings(rows, { query: "  MATTHEWS " }).map((r) => r.id), [1]);
assert.deepEqual(filterCoachingBookings(rows, { query: "nobody" }), []);

// A called-off session still owes somebody their money back, so it stays.
assert.equal(filterCoachingBookings(rows, { filter: "unpaid" })[0]?.cancelled, true);

// Two on the same day are split by the time rather than left to chance.
const sameDay = [
  row({ id: 8, date: "2026-10-03", time: "16:00" }),
  row({ id: 9, date: "2026-10-03", time: "09:00" }),
];
assert.deepEqual(filterCoachingBookings(sameDay, {}).map((r) => r.id), [9, 8]);

// The input is never reordered in place: the caller's list is its own.
const original = [...rows];
filterCoachingBookings(rows, { sort: "latest" });
assert.deepEqual(rows, original);

// Narrowed to one session, the counts describe what is on screen rather than
// the whole club. The page does the narrowing; this pins what it should give.
const oneSession = rows.filter((r) => r.slotId === rows[0]!.slotId);
assert.deepEqual(countCoachingBookings(oneSession),
  { all: oneSession.length,
    unpaid: oneSession.filter((r) => !r.paid).length,
    paid: oneSession.filter((r) => r.paid).length });

console.log("coaching-bookings-filter: all assertions passed");
