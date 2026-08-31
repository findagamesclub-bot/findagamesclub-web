import assert from "node:assert/strict";
import { countUnpaid, filterCoaching } from "../coaching-filter";
import type { MyCoaching } from "@/services/myActivity.service";

const make = (over: Partial<MyCoaching> & { title: string; date: string }): MyCoaching => ({
  id: over.title.length + over.date.length,
  club: { slug: "didcot", name: "Didcot Wargames", logoUrl: null },
  description: "", startTime: "18:30", endTime: "20:00", price: "£30",
  kind: "1:1", status: "booked", paid: false, cancelled: false, past: false,
  ...over,
} as MyCoaching);

const sessions = [
  make({ title: "Kill Team", date: "2026-09-20" }),
  make({ title: "Warhammer 40k", date: "2026-09-08", paid: true }),
  make({ title: "Old one", date: "2026-01-05", past: true, paid: true }),
  make({ title: "Dropped", date: "2026-09-12", cancelled: true }),
];

const titles = (rows: MyCoaching[]) => rows.map((r) => r.title);

// Soonest puts what is still to come in order, then history behind it.
assert.deepEqual(titles(filterCoaching(sessions, {})),
  ["Warhammer 40k", "Kill Team", "Dropped", "Old one"]);

// A cancelled session is history even though its date has not passed.
assert.deepEqual(titles(filterCoaching(sessions, { filter: "upcoming" })),
  ["Warhammer 40k", "Kill Team"]);
assert.deepEqual(titles(filterCoaching(sessions, { filter: "past" })), ["Dropped", "Old one"]);

// Unpaid means still to come and not paid: a past unpaid one is not actionable.
assert.deepEqual(titles(filterCoaching(sessions, { filter: "unpaid" })), ["Kill Team"]);
assert.equal(countUnpaid(sessions), 1);

// Search covers the session, the club and the kind.
assert.deepEqual(titles(filterCoaching(sessions, { query: "kill" })), ["Kill Team"]);
assert.equal(filterCoaching(sessions, { query: "didcot" }).length, 4);
assert.deepEqual(filterCoaching(sessions, { query: "zzz" }), []);

// Other orders.
assert.deepEqual(titles(filterCoaching(sessions, { sort: "recent" }))[0], "Kill Team");
assert.equal(titles(filterCoaching(sessions, { sort: "club" })).length, 4);

console.log("coaching-filter ok");
