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
