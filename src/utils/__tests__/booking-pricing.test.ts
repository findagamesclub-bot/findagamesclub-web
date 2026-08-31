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
