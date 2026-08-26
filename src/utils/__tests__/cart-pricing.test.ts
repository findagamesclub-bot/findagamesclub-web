import assert from "node:assert/strict";
import { amountOf, priceCart } from "../cart-pricing";
import { checkoutError } from "../checkout-errors";
import type { CartLine } from "@/types/ticket";

const line = (quantity: number, unit: number): CartLine => ({
  ticketTypeId: 1, label: "Standard", price: `£${unit}`,
  unitAmount: unit, quantity, lineTotal: unit * quantity,
});

// amountOf
assert.equal(amountOf("£30"), 30);
assert.equal(amountOf("GBP 15.50"), 15.5);
assert.equal(amountOf("Free"), 0, "a word with no digits is nothing to charge");
assert.equal(amountOf(null), 0);
assert.equal(amountOf(undefined), 0);

// priceCart
const plain = priceCart({ lines: [line(2, 30)], discountPercent: 0, tierLabel: null });
assert.equal(plain.subtotal, 60);
assert.equal(plain.discountAmount, 0);
assert.equal(plain.total, 60);

const discounted = priceCart({ lines: [line(2, 30)], discountPercent: 5, tierLabel: "Premium" });
assert.equal(discounted.discountAmount, 3, "5% of £60");
assert.equal(discounted.total, 57);
assert.equal(discounted.tierLabel, "Premium");

// Matches round(x, 2) in SQL rather than leaving a repeating fraction.
const thirds = priceCart({ lines: [line(1, 10)], discountPercent: 33, tierLabel: null });
assert.equal(thirds.discountAmount, 3.3);
assert.equal(thirds.total, 6.7);

// A club could type anything into the benefits object.
assert.equal(priceCart({ lines: [line(1, 10)], discountPercent: 400, tierLabel: null }).total, 0);
assert.equal(priceCart({ lines: [line(1, 10)], discountPercent: -20, tierLabel: null }).total, 10);

assert.equal(priceCart({ lines: [], discountPercent: 10, tierLabel: null }).total, 0);

// Several lines add up.
const many = priceCart({
  lines: [line(2, 30), { ...line(1, 24), ticketTypeId: 2, label: "Member" }],
  discountPercent: 0, tierLabel: null,
});
assert.equal(many.subtotal, 84);

// checkoutError
assert.match(checkoutError("TICKETS_SOLD_OUT"), /last of those/);
assert.match(checkoutError('ERROR: 42501: TICKET_NOT_ELIGIBLE'), /not open to you/);
assert.match(checkoutError("something nobody planned for"), /Try again/);

console.log("all passing");
