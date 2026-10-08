import assert from "node:assert/strict";

import { formatPence, formatPounds, pricePence } from "../format";

/**
 * The two were one function called `formatPence` that took pounds, and every
 * Stage 5 screen handed it a `*_pence` column. Every figure came out a hundred
 * times too big, a featured slot booked at £20 read £2000, and the receipt
 * email said the same. These assertions are here so that cannot come back.
 */

// Pence in, pounds on screen.
assert.equal(formatPence(1500), "£15.00");
assert.equal(formatPence(2000), "£20.00");
assert.equal(formatPence(15000), "£150.00");
assert.equal(formatPence(1), "£0.01");
assert.equal(formatPence(0), "£0.00");
assert.equal(formatPence(199, "EUR"), "EUR 1.99");

// Pounds in, pounds on screen, always to the penny so a column lines up.
assert.equal(formatPounds(15), "£15.00");
assert.equal(formatPounds(13.5), "£13.50");
assert.equal(formatPounds(0), "£0.00");

// Nothing sensible in means nothing alarming out.
assert.equal(formatPence(Number.NaN), "£0.00");
assert.equal(formatPounds(Number.NaN), "£0.00");

// The one that started it: the two must never agree about the same number.
assert.notEqual(formatPence(2000), formatPounds(2000));

// A price list, not a receipt: whole pounds lose the decimals and real pence
// keep them. `listingCostLine` used to carry its own copy of this.
assert.equal(pricePence(2000), "\u00a320");
assert.equal(pricePence(1500), "\u00a315");
assert.equal(pricePence(1250), "\u00a312.50");
assert.equal(pricePence(0), "\u00a30");
// And it is pence, like every other helper whose name says so, so the two can
// never be swapped without the figure moving by a hundred.
assert.notEqual(pricePence(2000), formatPence(20));

console.log("money-format: all assertions passed");
