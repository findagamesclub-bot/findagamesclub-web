import assert from "node:assert/strict";
import {
  clubPayments, slotIsPaid, PAYMENT_KIND_LABELS,
  type FeaturedSlotLike, type ListingPaymentLike,
} from "../club-payments";

const payment = (over: Partial<ListingPaymentLike> & { id: number }): ListingPaymentLike => ({
  amount_pence: 1500, currency: "GBP", paid_at: "2026-10-12T09:00:00Z",
  method: "bank_transfer", reference: "REF-1",
  period_start: "2026-10-12", period_end: "2026-11-11",
  ...over,
});

const slot = (over: Partial<FeaturedSlotLike> & { id: number }): FeaturedSlotLike => ({
  startsOn: "2026-10-16", endsOn: "2026-10-22", pricePence: 2000, currency: "GBP",
  paidAt: "2026-10-16T09:00:00Z", paymentMethod: "bank_transfer",
  paymentNote: "Invoice INV-0042.",
  ...over,
});

// Both sources, one list. The panel read only the first, so a club that was
// never charged for its listing and has paid for three homepage weeks was
// told "Nothing recorded yet" directly under a slot list saying PAID.
const both = clubPayments([payment({ id: 1 })], [slot({ id: 7 })]);
assert.equal(both.length, 2);
assert.deepEqual(both.map((p) => p.kind), ["featured", "listing"]);

// Newest first, by the day the money was recorded.
assert.deepEqual(both.map((p) => p.on), ["2026-10-16", "2026-10-12"]);

// Keys cannot collide, because the two tables number their rows separately
// and a React key that repeats drops a row from the list. The ids here are
// deliberately THE SAME: with different ids the assertion passes whatever the
// key is built from, which is a test agreeing with the code.
const clash = clubPayments(
  [payment({ id: 7 })], [slot({ id: 7, paidAt: "2026-10-18T09:00:00Z" })]);
assert.equal(clash.length, 2);
assert.equal(new Set(clash.map((p) => p.key)).size, 2);

// --- What counts as a payment ----------------------------------------------

// A slot nobody has settled is not a receipt. 0191 settled that a featured
// week is sold and settled offline, and the panel above this one already says
// NOT PAID YET; this list answers a different question.
assert.equal(slotIsPaid(slot({ id: 8, paidAt: null })), false);
assert.deepEqual(clubPayments([], [slot({ id: 8, paidAt: null })]), []);

// And a slot given away is not one either: there was nothing to settle, so a
// line here would be a receipt for nothing.
assert.equal(slotIsPaid(slot({ id: 9, pricePence: 0 })), false);
assert.deepEqual(clubPayments([], [slot({ id: 9, pricePence: 0 })]), []);

// A real one is, with the week it bought and the note the admin's own dialog
// promises the club will see.
const one = clubPayments([], [slot({ id: 10 })])[0]!;
assert.equal(one.amountPence, 2000);
assert.deepEqual(one.covers, { from: "2026-10-16", to: "2026-10-22" });
assert.equal(one.note, "Invoice INV-0042.");

// A subscription payment keeps the period it bought, and has no note: that
// column belongs to the admin's own ledger, not to the club.
const sub = clubPayments([payment({ id: 2 })], [])[0]!;
assert.deepEqual(sub.covers, { from: "2026-10-12", to: "2026-11-11" });
assert.equal(sub.note, "");
assert.equal(sub.reference, "REF-1");

// One with no period at all still shows, because the money was still paid.
assert.equal(clubPayments(
  [payment({ id: 3, period_start: null, period_end: null })], []).length, 1);
assert.equal(clubPayments(
  [payment({ id: 3, period_start: null, period_end: null })], [])[0]!.covers, null);

// --- The order is stable ----------------------------------------------------

// Two recorded on one day come back the same way every render. A sort with no
// tie-break is a list that reshuffles itself, which 0130 paid for once.
const sameDay = clubPayments(
  [payment({ id: 4, paid_at: "2026-10-16T08:00:00Z" })],
  [slot({ id: 11, paidAt: "2026-10-16T09:00:00Z" })],
);
assert.deepEqual(
  clubPayments(
    [payment({ id: 4, paid_at: "2026-10-16T08:00:00Z" })],
    [slot({ id: 11, paidAt: "2026-10-16T09:00:00Z" })],
  ).map((p) => p.key),
  sameDay.map((p) => p.key),
);

// Nothing at all is an empty list, not a crash.
assert.deepEqual(clubPayments([], []), []);

// Each line can say which it is, because a receipt list holding two kinds of
// thing has to.
assert.equal(PAYMENT_KIND_LABELS.listing, "Listing");
assert.equal(PAYMENT_KIND_LABELS.featured, "Homepage week");

console.log("club-payments: all pass");
