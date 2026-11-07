import assert from "node:assert/strict";
import { countNeedingAttention, filterMemberships } from "../membership-filter";
import type { MyClubMembership } from "@/services/myMemberships.service";

const make = (over: Partial<MyClubMembership> & { name: string }): MyClubMembership => ({
  membershipId: Math.round(Math.abs(over.name.length * 7)),
  status: "approved",
  club: { id: 1, slug: over.name.toLowerCase(), name: over.name, city: "Didcot", logoUrl: null },
  tierKey: null, tierLabel: null, joinedAt: "2026-01-01", requestedAt: "2026-01-01",
  declineReason: null, requestedTierKey: null, requestedTierLabel: null, requestedAtTier: null,
  payments: [], tiers: [],
  standing: { paidThrough: null, overdue: false, settledOneOff: false },
  ...over,
} as MyClubMembership);

const clubs = [
  make({ name: "Alpha", joinedAt: "2026-05-01" }),
  make({ name: "Bravo", status: "pending", joinedAt: null, requestedAt: "2026-06-01" }),
  make({ name: "Charlie", status: "cancelled", joinedAt: "2025-01-01" }),
  make({ name: "Delta", joinedAt: "2026-07-01",
         standing: { paidThrough: "2026-01-01", overdue: true, settledOneOff: false } }),
];

const names = (rows: MyClubMembership[]) => rows.map((r) => r.club.name);

// Status groups: "past" folds declined and cancelled together.
assert.deepEqual(names(filterMemberships(clubs, { filter: "approved" })), ["Delta", "Alpha"]);
assert.deepEqual(names(filterMemberships(clubs, { filter: "pending" })), ["Bravo"]);
assert.deepEqual(names(filterMemberships(clubs, { filter: "past" })), ["Charlie"]);

// Search matches the club, the town or the tier, and ignores case.
assert.deepEqual(names(filterMemberships(clubs, { query: "brav" })), ["Bravo"]);
assert.equal(filterMemberships(clubs, { query: "didcot" }).length, 4);
assert.deepEqual(filterMemberships(clubs, { query: "zzz" }), []);

// Default sort is newest first, by whichever date the row has.
assert.deepEqual(names(filterMemberships(clubs, {})), ["Delta", "Bravo", "Alpha", "Charlie"]);
assert.deepEqual(names(filterMemberships(clubs, { sort: "name" })),
  ["Alpha", "Bravo", "Charlie", "Delta"]);

// Attention sort puts an overdue payment above a pending application.
assert.deepEqual(names(filterMemberships(clubs, { sort: "attention" }))[0], "Delta");

// Only overdue money and an outstanding tier request count as needing you.
assert.equal(countNeedingAttention(clubs), 1);

console.log("membership-filter ok");

// ------------------------------------------------- a club shuts its door
//
// The client, item 26: "when you suspend a member, they then cannot see any of
// their memberships to other clubs in the dashboard and get the below error".
// 0212 made `suspended` a membership status and this union had four words in
// it, so the card's status map came back undefined and the whole page threw —
// taking every OTHER club they belong to down with it.
const shut = make({ name: "Echo", status: "suspended" });

// It is its own group, not "past": the membership is live and the tier is
// still theirs. The club has shut the door, which is a different thing from
// having left or been turned away.
assert.deepEqual(names(filterMemberships([shut], { filter: "suspended" })), ["Echo"]);
assert.deepEqual(filterMemberships([shut], { filter: "past" }), []);
assert.deepEqual(filterMemberships([shut], { filter: "approved" }), []);
assert.deepEqual(names(filterMemberships([shut], { filter: "all" })), ["Echo"]);

// And it sorts above everything under "Needs you first". Somebody who cannot
// get into a club wants to read why before they read that another club wants
// ten pounds.
const owing = make({ name: "Foxtrot",
  standing: { paidThrough: "2026-01-01", overdue: true, settledOneOff: false } });
assert.deepEqual(
  names(filterMemberships([owing, shut], { sort: "attention" })), ["Echo", "Foxtrot"]);

console.log("membership-filter: a suspension is its own group");
