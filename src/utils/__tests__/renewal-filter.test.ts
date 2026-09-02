import assert from "node:assert/strict";
import {
  countRenewals, filterRenewals, toRenewalRow, type RenewalRow,
} from "../renewal-filter";
import type { ClubMember } from "@/types/membership";
import type { MembershipPayment } from "@/types/payment";

const NOW = Date.parse("2026-08-30T12:00:00Z");
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

const member = (over: Partial<ClubMember> & { membershipId: number }): ClubMember => ({
  profileId: `p${over.membershipId}`, fullName: `Member ${over.membershipId}`,
  status: "approved", tierKey: "premium", tierAssignedAt: "2026-01-01T00:00:00Z",
  joinedAt: "2026-01-01", requestedAt: "2026-01-01", games: [], armies: [],
  playStyle: [], tenureYears: 0, ...over,
});

const payment = (over: Partial<MembershipPayment> = {}): MembershipPayment => ({
  id: 1, tierKey: "premium", tierLabel: "Premium", billingOptionLabel: "Monthly",
  price: "£10", priceDuration: "month", periodStart: "2026-01-01",
  periodEnd: day(20), note: null, recordedAt: "2026-01-01T00:00:00Z", ...over,
});

const row = (id: number, payments: MembershipPayment[], free = false) =>
  toRenewalRow({ member: member({ membershipId: id }), payments,
                 tierLabel: "Premium", free, today: NOW });

// --- one membership at a time ------------------------------------------------
const paidUp = row(1, [payment({ periodEnd: day(200) })]);
assert.equal(paidUp.overdue, false);
assert.equal(paidUp.daysLeft, 200);

const soon = row(2, [payment({ periodEnd: day(10) })]);
assert.equal(soon.daysLeft, 10);
assert.equal(soon.overdue, false);

const lapsed = row(3, [payment({ periodEnd: day(-5) })]);
assert.equal(lapsed.overdue, true);
assert.equal(lapsed.daysLeft, -5);

const neverPaid = row(4, []);
assert.equal(neverPaid.paidThrough, null);
assert.equal(neverPaid.overdue, false, "no payment is not the same as a lapsed one");

// A one-off is bought outright, so a period end in the past is not a lapse.
const oneOff = row(5, [payment({ priceDuration: "one-off", periodEnd: day(-90) })]);
assert.equal(oneOff.overdue, false);
assert.equal(oneOff.cadence, "one-off");
assert.equal(oneOff.settled, true);

// The real shape in the database: a one-off with no period end at all. Without
// `settled` this is indistinguishable from somebody who has never paid, and it
// sat in the club's chase list forever. Found on live data, not invented.
const oneOffNoEnd = row(7, [payment({ priceDuration: "one-off", periodEnd: null })]);
assert.equal(oneOffNoEnd.paidThrough, null);
assert.equal(oneOffNoEnd.settled, true);
assert.equal(oneOffNoEnd.overdue, false);

// A free tier can never be overdue, whatever the ledger says.
assert.equal(row(6, [payment({ periodEnd: day(-30) })], true).overdue, false);

// Money taken before the member was moved to this tier does not count, and must
// not be shown on the row either: it read "ONE-OFF · £500 ... Never paid".
const movedTier = toRenewalRow({
  member: member({ membershipId: 8, tierAssignedAt: "2026-08-29T00:00:00Z" }),
  payments: [payment({ priceDuration: "one-off", periodEnd: null, price: "£500",
                       recordedAt: "2026-08-26T00:00:00Z" })],
  tierLabel: "Premium", free: false, today: NOW,
});
assert.equal(movedTier.settled, false, "an older tier's payment does not settle this one");
assert.equal(movedTier.paidThrough, null);
assert.equal(movedTier.lastPrice, "", "and it is not shown on the row either");
assert.equal(movedTier.cadence, "");

// --- the tabs ----------------------------------------------------------------
const rows: RenewalRow[] = [paidUp, soon, lapsed, neverPaid, oneOff, row(6, [], true), oneOffNoEnd];
const counts = countRenewals(rows);
assert.equal(counts.all, 7);
assert.equal(counts.overdue, 1, "only the lapsed one");
assert.equal(counts.expiring, 1, "only the one inside 30 days");
assert.equal(counts.due, 2,
  "lapsed plus never paid. The dateless one-off is settled, not owing");
// Deliberately overlapping views, not exclusive buckets: somebody expiring in
// ten days is still paid up, and legacy's filters overlap the same way. Only a
// status-based tab set has to sum to All.
assert.equal(counts.paid, 5, "paid up, expiring soon, both one-offs, and the free tier");
assert.equal(counts.due + counts.paid, 7, "every membership is either owing or not");

const ids = (r: RenewalRow[]) => r.map((x) => x.member.membershipId);
assert.deepEqual(ids(filterRenewals(rows, { filter: "overdue" })), [3]);
assert.deepEqual(ids(filterRenewals(rows, { filter: "expiring" })), [2]);
assert.deepEqual(ids(filterRenewals(rows, { billing: "one-off" })), [5, 7]);
assert.deepEqual(ids(filterRenewals(rows, { billing: "free" })), [6]);

// The two axes are independent, which is the whole point of splitting them:
// "who on a monthly plan has lapsed" was unaskable while one control did both.
assert.deepEqual(ids(filterRenewals(rows, { filter: "overdue", billing: "monthly" })), [3]);
assert.deepEqual(ids(filterRenewals(rows, { filter: "overdue", billing: "yearly" })), []);
// A free tier is never a cadence, however the ledger reads.
assert.deepEqual(ids(filterRenewals(rows, { billing: "monthly" })).includes(6), false);

// Counts follow the billing choice, or a tab says 3 over an empty list.
assert.equal(countRenewals(rows, "free").all, 1);
assert.equal(countRenewals(rows, "free").overdue, 0);

// Soonest puts whoever needs chasing first: never paid, then lapsed, then by
// how little time is left, and free tiers last.
assert.deepEqual(ids(filterRenewals(rows, { filter: "all", sort: "soonest" })),
  [4, 3, 2, 1, 5, 7, 6]);

// --- search ------------------------------------------------------------------
assert.deepEqual(ids(filterRenewals(rows, { query: "Member 3" })), [3]);
assert.deepEqual(ids(filterRenewals(rows, { query: "overdue" })), [3],
  "searching the word finds the state, not just the name");
assert.deepEqual(ids(filterRenewals(rows, { query: "one-off" })), [5, 7]);
assert.equal(filterRenewals(rows, { query: "nobody" }).length, 0);

console.log("renewal-filter ok");
