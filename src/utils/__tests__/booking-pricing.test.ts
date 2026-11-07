import assert from "node:assert/strict";
import { priceBooking, priceSummary, type BookingStanding } from "../booking-pricing";

const standing = (over: Partial<BookingStanding> = {}): BookingStanding => ({
  basePrice: 5, currency: "GBP", discountPercent: 10, tierLabel: "Premium Membership",
  points: 385, pointValue: 0.01, redemptionCapPercent: 10, earnPerBooking: 5, ...over,
});

// Didcot: £5 a table, Premium takes 10%, which is what the trigger already stores.
const didcot = priceBooking(standing());
assert.equal(didcot.discountAmount, 0.5);
assert.equal(didcot.payable, 4.5);
assert.equal(didcot.total, 4.5);
assert.equal(didcot.free, false);

// 10% of £4.50 is £0.45, so 45 points at a penny each. The balance of 385 does
// not bind here; the cap does.
assert.equal(didcot.maxPoints, 45);
const spent = priceBooking(standing(), 45);
assert.equal(spent.pointsOff, 0.45);
assert.equal(spent.total, 4.05);

// Asking for more than the cap allows is clamped, never charged.
assert.equal(priceBooking(standing(), 9999).total, 4.05);

// waiveGameBookingFee comes through as 100%, which is the client's "pay as you
// play does not apply to members".
const waived = priceBooking(standing({ discountPercent: 100 }));
assert.equal(waived.payable, 0);
assert.equal(waived.free, true);
assert.equal(waived.maxPoints, 0, "nothing left to spend points on");
assert.equal(priceBooking(standing({ discountPercent: 100 }), 100).total, 0);

// A club that does not let points be spent.
assert.equal(priceBooking(standing({ redemptionCapPercent: 0 }), 50).maxPoints, 0);
assert.equal(priceBooking(standing({ redemptionCapPercent: 0 }), 50).total, 4.5);

// No membership at all: the headline price, undiscounted.
const guest = priceBooking(standing({ discountPercent: 0, tierLabel: null }));
assert.equal(guest.total, 5);

// Pennies, mirroring round(x, 2) in SQL. 33% of £5 is £1.65.
assert.equal(priceBooking(standing({ discountPercent: 33 })).payable, 3.35);

// --- the sentence -----------------------------------------------------------
// One list item, no full stops: it sits between the time and the table count
// in a strip separated by middots.
assert.equal(priceSummary(standing(), didcot), "£4.50 a table, usually £5.00");
assert.equal(priceSummary(standing({ discountPercent: 100 }), waived),
  "free with Premium Membership, usually £5.00");
assert.equal(priceSummary(standing({ discountPercent: 0, tierLabel: null }), guest),
  "£5.00 a table");
// A full stop followed by a space is a sentence break; "£4.50" is not.
assert.ok(!/\.\s/.test(priceSummary(standing(), didcot)),
  "no sentence punctuation inside a middot-separated item");

console.log("booking-pricing ok");

// ------------------------------------------------- a table split two ways
//
// The client, item gg: "if a table cost is £5, usually it would be £2.50 per
// person to pay." One member's tier may waive their half while the other's
// does not, which is the case the old single-price booking could not express.

import { priceShare, splitTable, tierBookingDiscount } from "../booking-pricing";

assert.deepEqual(splitTable(5, true), { home: 2.5, away: 2.5 });

// A table nobody else is on is the booker's whole table. It is what they are
// reserving, and it is the figure every booking made before 0221 carries.
assert.deepEqual(splitTable(5, false), { home: 5, away: 0 });

// The odd penny falls to whoever booked it, and the halves add back to the
// table's own price exactly: a club charging £5.01 collects £5.01, never £5.02.
assert.deepEqual(splitTable(5.01, true), { home: 2.51, away: 2.5 });
assert.equal(splitTable(5.01, true).home + splitTable(5.01, true).away, 5.01);
assert.deepEqual(splitTable(0, true), { home: 0, away: 0 });
assert.deepEqual(splitTable(0.01, true), { home: 0.01, away: 0 });

// Each half is then priced off that person's own tier, which is the whole of
// the client's example: the Life Member pays nothing and the Basic member
// still owes their £2.50.
const halves = splitTable(5, true);
assert.equal(priceShare(halves.home, 100).payable, 0);
assert.equal(priceShare(halves.away, 0).payable, 2.5);
assert.equal(priceShare(halves.away, 10).payable, 2.25);
assert.equal(priceShare(halves.away, 10).discountAmount, 0.25);

// A nonsense percent cannot make a club owe a member money.
assert.equal(priceShare(2.5, -50).payable, 2.5);
assert.equal(priceShare(2.5, 999).payable, 0);

// The mirror of booking_discount_percent (0014). A waiver wins outright, and
// the importer's empty-array default reads as no benefits rather than throwing.
assert.equal(tierBookingDiscount({ waiveGameBookingFee: true }), 100);
assert.equal(tierBookingDiscount({ waiveGameBookingFee: true, bookingDiscountPercent: 10 }), 100);
assert.equal(tierBookingDiscount({ bookingDiscountPercent: 25 }), 25);
assert.equal(tierBookingDiscount({ bookingDiscountPercent: 250 }), 100);
assert.equal(tierBookingDiscount([]), 0);
assert.equal(tierBookingDiscount(null), 0);
assert.equal(tierBookingDiscount(undefined), 0);
assert.equal(tierBookingDiscount({ waiveGameBookingFee: "true" }), 0,
  "a string is not the boolean the SQL casts, so it is not a waiver");

// And the booker's own price follows the same split. The points cap is a
// share of what is payable, so a halved table halves what points can cover.
const shared = {
  basePrice: 5, currency: "GBP", discountPercent: 0, tierLabel: null,
  points: 500, pointValue: 0.05, redemptionCapPercent: 100, earnPerBooking: 0,
};
assert.equal(priceBooking(shared, 0, false).basePrice, 5);
assert.equal(priceBooking(shared, 0, true).basePrice, 2.5);
assert.equal(priceBooking(shared, 1000, true).total, 0);
assert.equal(priceBooking(shared, 1000, true).pointsOff, 2.5,
  "points cannot take more off a half than the half costs");

console.log("booking-pricing: the split holds");
