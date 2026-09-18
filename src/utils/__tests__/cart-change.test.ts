import assert from "node:assert/strict";

import { changeCartLine, priceCart } from "../cart-pricing";
import type { EventCart } from "@/types/ticket";

const standard = { ticketTypeId: 1, label: "Standard entry", price: "GBP 30", unitAmount: 30 };
const member = { ticketTypeId: 2, label: "Club member", price: "GBP 28", unitAmount: 28 };

const cart = (): EventCart => priceCart({
  lines: [{ ...standard, quantity: 2, lineTotal: 60 }],
  discountPercent: 5, tierLabel: "Premium Membership",
});

// --- changing what is there ----------------------------------------------

{
  const next = changeCartLine(cart(), standard, 3);
  assert.equal(next.lines.length, 1);
  assert.equal(next.lines[0]!.quantity, 3);
  assert.equal(next.lines[0]!.lineTotal, 90);
  assert.equal(next.subtotal, 90);
  assert.equal(next.discountAmount, 4.5, "the tier discount follows the new subtotal");
  assert.equal(next.total, 85.5);
  assert.equal(next.tierLabel, "Premium Membership", "and the tier travels with it");
}

{
  const next = changeCartLine(cart(), standard, 1);
  assert.equal(next.lines[0]!.quantity, 1);
  assert.equal(next.total, 28.5);
}

// --- taking one out -------------------------------------------------------

{
  for (const gone of [0, -1]) {
    const next = changeCartLine(cart(), standard, gone);
    assert.deepEqual(next.lines, [], `quantity ${gone} removes the line`);
    assert.equal(next.subtotal, 0);
    assert.equal(next.total, 0);
    assert.equal(next.discountAmount, 0, "and nothing is discounted off nothing");
  }
}

// --- adding one that is not there yet ------------------------------------

{
  const next = changeCartLine(cart(), member, 2);
  assert.equal(next.lines.length, 2);
  assert.deepEqual(next.lines.map((l) => l.ticketTypeId), [1, 2],
    "a new line goes on the end, where the server puts it");
  assert.equal(next.lines[1]!.lineTotal, 56);
  assert.equal(next.subtotal, 116);
}

{
  // The very first ticket, with no cart at all behind it.
  const next = changeCartLine(null, standard, 1);
  assert.equal(next.lines.length, 1);
  assert.equal(next.total, 30);
  assert.equal(next.currency, "GBP");
  assert.equal(next.discountPercent, 0, "no cart means no tier is known yet");
}

// --- it agrees with the server's own arithmetic ---------------------------

{
  // Same rounding as priceCart, which mirrors checkout_event_cart in SQL. A
  // browser that rounds differently shows one figure and charges another.
  const optimistic = changeCartLine(cart(), standard, 3);
  const fromServer = priceCart({
    lines: [{ ...standard, quantity: 3, lineTotal: 90 }],
    discountPercent: 5, tierLabel: "Premium Membership",
  });
  assert.deepEqual(optimistic, fromServer);
}

{
  // A third of a penny is where the two ends drift apart if one of them
  // subtracts before rounding.
  const odd = priceCart({ lines: [{ ...standard, unitAmount: 33.33, quantity: 1,
                                    lineTotal: 33.33 }],
                          discountPercent: 7, tierLabel: null });
  const next = changeCartLine(odd, { ...standard, unitAmount: 33.33 }, 3);
  assert.equal(next.subtotal, 99.99);
  assert.equal(next.discountAmount, 7);
  assert.equal(next.total, 92.99);
}

console.log("cart-change: all assertions passed");
