import assert from "node:assert/strict";
import { filterAttendees, typeCounts, type Attendee } from "../attendee-filter";

const a = (id: number, fullName: string, email: string, reference: string,
           total: number, createdAt: string, types: string[]): Attendee =>
  ({ id, fullName, email, reference, total, currency: "GBP", createdAt,
     tickets: types.length, summary: types.join(", "), types });

const list = [
  a(1, "Gulnabi Afridi", "g@example.com", "FAGC-JU6GSF", 28.5, "2026-09-01T10:00:00Z", ["Standard entry"]),
  a(2, "Gulnabi Afridi", "g@example.com", "FAGC-8T6Y4Q", 20.53, "2026-09-02T10:00:00Z", ["Club member"]),
  a(3, "Joe Matthews", "joe@example.com", "FAGC-YH2ZCP", 42.75, "2026-09-03T10:00:00Z", ["Premium ringside"]),
];

// Name first, and one person's several bookings keep a stable order under it.
assert.deepEqual(filterAttendees(list, {}).map((x) => x.id), [2, 1, 3]);

// Newest first, for "did the booking I just made land".
assert.deepEqual(filterAttendees(list, { sort: "newest" }).map((x) => x.id), [3, 2, 1]);

// Highest value, for chasing the money.
assert.deepEqual(filterAttendees(list, { sort: "value" }).map((x) => x.id), [3, 1, 2]);

// The three things somebody at the door actually has to hand.
assert.deepEqual(filterAttendees(list, { query: "joe" }).map((x) => x.id), [3]);
assert.deepEqual(filterAttendees(list, { query: "8T6Y4Q" }).map((x) => x.id), [2],
  "reference match is what disambiguates one person's several bookings");
assert.deepEqual(filterAttendees(list, { query: "JOE@EXAMPLE" }).map((x) => x.id), [3]);
assert.deepEqual(filterAttendees(list, { query: "  " }).map((x) => x.id), [2, 1, 3]);
assert.deepEqual(filterAttendees(list, { query: "nobody" }), []);

// One ticket type at a time, which is the question at a door with brackets.
assert.deepEqual(filterAttendees(list, { type: "Club member" }).map((x) => x.id), [2]);
assert.deepEqual(filterAttendees(list, { type: "all" }).map((x) => x.id), [2, 1, 3]);

// Search and type together.
assert.deepEqual(filterAttendees(list, { query: "gulnabi", type: "Standard entry" })
  .map((x) => x.id), [1]);

// Counts drive the tabs, busiest first.
assert.deepEqual(typeCounts(list), [
  { label: "Club member", count: 1 },
  { label: "Premium ringside", count: 1 },
  { label: "Standard entry", count: 1 },
]);
assert.deepEqual(typeCounts([]), []);

// A booking with two types counts under both.
const mixed = [a(4, "Sam", "s@e.com", "FAGC-X", 50, "2026-09-04T10:00:00Z",
                 ["Standard entry", "Club member"])];
assert.deepEqual(typeCounts(mixed).map((t) => t.label), ["Club member", "Standard entry"]);
assert.equal(filterAttendees(mixed, { type: "Club member" }).length, 1);

console.log("attendee filter: all assertions passed");
