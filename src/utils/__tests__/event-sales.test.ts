import assert from "node:assert/strict";
import { publishedSales, RANKED_EVENTS, type SoldEvent } from "../event-sales";

const sold = (over: Partial<SoldEvent> = {}): SoldEvent => ({
  bookings: 1, tickets: 1, due: 0, title: "An event", status: "published", ...over,
});

// The client's own report, with the numbers they counted. Five events, one of
// them taken down and still holding a place: the header said 29 and the five
// bars on the chart said 28, and both were adding up something real.
const didcot = new Map<number, SoldEvent>([
  [1, sold({ title: "Autumn Open", tickets: 17, bookings: 15, due: 298 })],
  [2, sold({ title: "Oxford Onslaught 5", tickets: 6, bookings: 6, due: 77.75 })],
  [3, sold({ title: "Warhammer 40k RTT", tickets: 4, bookings: 4 })],
  [4, sold({ title: "Warhammer 40k Teams", tickets: 1, bookings: 1, due: 50 })],
  [5, sold({ title: "Saturday Painting Day", tickets: 1, status: "unlisted" })],
]);

const { totals, ranked } = publishedSales(didcot);
assert.equal(totals?.tickets, 28, "the taken-down event's place is not in the header");
assert.equal(totals?.bookings, 26);
assert.equal(Math.round((totals?.due ?? 0) * 100) / 100, 425.75);

// And the bars add up to exactly that figure, which is the property the header
// never had: a reader can check one against the other.
assert.equal(ranked.reduce((n, row) => n + row.value, 0), totals?.tickets);
assert.deepEqual(ranked.map((row) => row.label),
  ["Autumn Open", "Oxford Onslaught 5", "Warhammer 40k RTT", "Warhammer 40k Teams"]);

// A draft is not on sale either, and neither is an event called off.
const hidden = publishedSales(new Map<number, SoldEvent>([
  [1, sold({ tickets: 4 })],
  [2, sold({ tickets: 9, status: "draft" })],
  [3, sold({ tickets: 3, status: "cancelled" })],
]));
assert.equal(hidden.totals?.tickets, 4);
assert.equal(hidden.ranked.length, 1);

// A row of zeroes is a list, not a ranking, so an event nobody booked has no
// bar — while still being counted, at nothing, in the total.
const quiet = publishedSales(new Map<number, SoldEvent>([
  [1, sold({ title: "Painting night", tickets: 0, bookings: 0 })],
  [2, sold({ title: "Open day", tickets: 2, bookings: 2 })],
]));
assert.equal(quiet.totals?.tickets, 2);
assert.equal(quiet.totals?.bookings, 2);
assert.deepEqual(quiet.ranked.map((r) => r.label), ["Open day"]);

// Ranked by what sold, and a tie broken by name rather than by whichever the
// map happened to hand over first: two events on four tickets must come back
// in the same order every render.
const tied = publishedSales(new Map<number, SoldEvent>([
  [1, sold({ title: "Zeta Open", tickets: 4 })],
  [2, sold({ title: "Alpha Open", tickets: 4 })],
  [3, sold({ title: "Mega Open", tickets: 9 })],
]));
assert.deepEqual(tied.ranked.map((r) => r.label), ["Mega Open", "Alpha Open", "Zeta Open"]);

// A club a few seasons in has more events than a chart can carry. The total
// still counts all of them, which is the half that must not be capped.
const many = new Map<number, SoldEvent>();
for (let i = 0; i < 20; i += 1) {
  many.set(i, sold({ title: `Event ${i}`, tickets: i + 1, bookings: 1 }));
}
const long = publishedSales(many);
assert.equal(long.ranked.length, RANKED_EVENTS);
assert.equal(long.totals?.tickets, 210);
assert.equal(long.ranked[0].value, 20, "best first");

// Nobody who may not read the sales gets a total, which is different from
// getting a zero: the header prints a figure it is given and "0 tickets sold"
// on a club's public page would be a claim nobody made.
const none = publishedSales(undefined);
assert.equal(none.totals, null);
assert.deepEqual(none.ranked, []);

// An empty map is a club with no bookings at all, which IS zero.
const empty = publishedSales(new Map());
assert.deepEqual(empty.totals, { bookings: 0, tickets: 0, due: 0 });

console.log("event-sales: all assertions passed");
