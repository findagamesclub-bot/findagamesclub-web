import assert from "node:assert/strict";
import {
  countCoachingBookings, filterCoachingBookings, owesRefund, wasRefunded,
  type CoachingBookingRow,
} from "../coaching-bookings-filter";

const row = (over: Partial<CoachingBookingRow> = {}): CoachingBookingRow => ({
  id: 1, name: "Gulnabi Afridi", profileId: "p1", paid: false, cancelled: false,
  refundStatus: "not_due", cancelReason: "", paymentNote: "", slotId: 9,
  paymentStatus: "unpaid", paidAt: null, refundedAt: null,
  refundMethod: "", refundNote: "",
  title: "List clinic",
  date: "2026-10-10", time: "19:00", total: 18, pointsSpent: 0,
  priced: { subtotal: 20, tierLabel: "Premium Membership", tierPercent: 10,
            tierAmount: 2, points: 0, pointsAmount: 0, total: 18 },
  ...over,
});

const rows: CoachingBookingRow[] = [
  row({ id: 1, name: "Ann", paid: false }),
  row({ id: 2, name: "Ben", paid: true }),
  // Cancelled after paying: the club owes them, and this is the row the list
  // exists for. The session cards deliberately never show it.
  row({ id: 3, name: "Cat", paid: true, cancelled: true, refundStatus: "due",
        cancelReason: "Coach is ill" }),
  row({ id: 4, name: "Dee", cancelled: true, refundStatus: "not_due" }),
  row({ id: 5, name: "Eve", paid: true, cancelled: true, refundStatus: "refunded" }),
];

// ------------------------------------------------- a cancelled place is not owing
{
  const counts = countCoachingBookings(rows);
  assert.equal(counts.all, 5);
  // Ann only. Dee is cancelled, so chasing her for money would be chasing a
  // session that never happened.
  assert.equal(counts.unpaid, 1);
  assert.equal(counts.paid, 1, "Ben only; Cat and Eve are cancelled");
  assert.equal(counts.cancelled, 3);
  assert.equal(counts.refund, 1, "only Cat is still owed");
}

// --------------------------------------------------------------- each tab
{
  const ids = (filter: Parameters<typeof filterCoachingBookings>[1]["filter"]) =>
    filterCoachingBookings(rows, { filter }).map((r) => r.id);

  assert.deepEqual(ids("all"), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids("unpaid"), [1]);
  assert.deepEqual(ids("paid"), [2]);
  assert.deepEqual(ids("cancelled"), [3, 4, 5]);
  assert.deepEqual(ids("refund"), [3]);
}

// --------------------------------------------- settled is not still owed
{
  assert.equal(owesRefund(rows[2]!), true);
  assert.equal(owesRefund(rows[4]!), false, "refunded is done, not outstanding");
  assert.equal(owesRefund(rows[3]!), false, "nothing was paid, so nothing is owed");
}

// ------------------------------------------- the search reaches the reason
{
  // Three things somebody remembers about a row they are hunting for.
  assert.deepEqual(
    filterCoachingBookings(rows, { query: "coach is ill" }).map((r) => r.id), [3]);
  assert.deepEqual(
    filterCoachingBookings(rows, { query: "ANN" }).map((r) => r.id), [1]);
  assert.deepEqual(
    filterCoachingBookings(rows, { query: "list clinic" }).length, 5);
  assert.deepEqual(filterCoachingBookings(rows, { query: "nobody" }), []);
}

// ------------------------------------------------------------------ sorting
{
  const spread = [
    row({ id: 1, date: "2026-10-20", time: "19:00" }),
    row({ id: 2, date: "2026-10-10", time: "19:00" }),
    row({ id: 3, date: "2026-10-10", time: "09:00" }),
  ];
  assert.deepEqual(
    filterCoachingBookings(spread, { sort: "soonest" }).map((r) => r.id), [3, 2, 1]);
  assert.deepEqual(
    filterCoachingBookings(spread, { sort: "latest" }).map((r) => r.id), [1, 2, 3]);
}

console.log("coaching-bookings-filter: all pass");

// 21g: the other half of the money. Eve is cancelled AND refunded, which is
// the normal shape of a refund, so this tab must not be narrowed to live rows
// the way "To pay" and "Paid" are — that is 0230's rule and it is the one way
// this group can quietly count nothing.
{
  const counts = countCoachingBookings(rows);
  const ids = (filter: Parameters<typeof filterCoachingBookings>[1]["filter"]) =>
    filterCoachingBookings(rows, { filter }).map((one) => one.id);

  assert.equal(counts.refunded, 1, "Eve has been refunded");
  assert.deepEqual(ids("refunded"), [5], "the refunded tab finds the cancelled row");
  assert.equal(wasRefunded(rows[2]!), false, "still owed is not yet refunded");
  assert.equal(
    counts.refund + counts.refunded, 2,
    "the two money-back tabs between them hold every refund");
  console.log("ok   refunded is its own group, and keeps its cancelled rows");
}
