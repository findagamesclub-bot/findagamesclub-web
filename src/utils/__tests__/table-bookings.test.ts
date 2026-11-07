import assert from "node:assert/strict";
import {
  isTableSort, isTableTab, tableBookingTag, tableIsFree, tableIsLive, tableIsPaid,
  TABLE_PAYMENT_LABELS, TABLE_SORTS, TABLE_TABS, type TableBookingRow,
} from "../table-bookings";

const row = (over: Partial<TableBookingRow> = {}): TableBookingRow => ({
  bookingId: 1, sessionDate: "2026-10-15", sessionLabel: "Club session",
  sessionTime: "18:30 - 22:30", tableIndex: 0, gameTitle: "Warhammer 40,000",
  bookedById: null, bookedName: "Gulnabi Afridi", opponentName: "Joe Matthews",
  side: "booker", status: "booked", paymentStatus: "unpaid",
  paymentMethod: "", paymentNote: "",
  paidAt: null, total: 5,
  priced: { subtotal: 5, tierLabel: null, tierPercent: 0, tierAmount: 0,
            points: 0, pointsAmount: 0, total: 5 },
  bookedAt: "2026-10-01T10:00:00Z", ...over,
});

// A free table is not an unpaid one. The client's own sentence asks for this:
// "a fee that each member pays for the table booking, IF they do not have a
// membership tier that enables game bookings for free". Counting a waived fee
// as owed is how a club chases somebody for money their membership covered.
{
  const waived = row({ total: 0, priced: { ...row().priced, total: 0 } });
  assert.equal(tableIsFree(waived), true);
  assert.equal(tableIsPaid(waived), false);
  assert.deepEqual(tableBookingTag(waived), { label: "Nothing to pay", tone: "kept" });
}

// And an ordinary unpaid one is owed, in the word the club reads.
assert.deepEqual(tableBookingTag(row()), { label: "Unpaid", tone: "waiting" });

// Paid says how it was paid, in the door list's own vocabulary rather than a
// second set of words for the same three states.
assert.deepEqual(tableBookingTag(row({ paymentStatus: "paid_on_the_door" })),
  { label: "Paid on the door", tone: "kept" });
assert.deepEqual(tableBookingTag(row({ paymentStatus: "paid_in_advance" })),
  { label: "Paid in advance", tone: "kept" });

// A cancelled table is a cancelled table whatever was paid on it, because it
// is no longer somebody who owes you and it is not somebody who has settled.
{
  const off = row({ status: "cancelled", paymentStatus: "paid_on_the_door" });
  assert.equal(tableIsLive(off), false);
  assert.deepEqual(tableBookingTag(off), { label: "Cancelled", tone: "down" });
}
// Cancelled wins over free as well, or a called-off table a tier covered would
// read "Nothing to pay" as though it were still on.
assert.deepEqual(tableBookingTag(row({ status: "cancelled", total: 0 })),
  { label: "Cancelled", tone: "down" });

// The guards are what stop a hand-typed address reaching SQL. Anything the
// address can carry has to be answered, not assumed.
assert.equal(isTableTab("topay"), true);
assert.equal(isTableTab("TOPAY"), false);
assert.equal(isTableTab("'; drop table club_bookings; --"), false);
assert.equal(isTableSort("value"), true);
assert.equal(isTableSort("random"), false);

// The tabs and the SQL groups are two readings of one rule, so the names have
// to match what `club_table_bookings` branches on. Spelled out here because
// the function takes the tab as a string and a typo is a tab that silently
// answers All.
assert.deepEqual(TABLE_TABS.map((tab) => tab.value),
  ["all", "topay", "paid", "free", "cancelled"]);
assert.deepEqual(TABLE_SORTS.map((sort) => sort.value),
  ["newest", "oldest", "name", "value"]);

// One vocabulary with the event door list, not two. Rule 11.
assert.deepEqual(Object.keys(TABLE_PAYMENT_LABELS),
  ["unpaid", "paid_on_the_door", "paid_in_advance"]);

console.log("table-bookings: all pass");
