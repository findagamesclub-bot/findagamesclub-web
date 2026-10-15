import assert from "node:assert/strict";

import { change, changeWords, GROWTH_SERIES, SITE_REVENUE } from "../site-growth";

// --- the comparison ------------------------------------------------------

{
  assert.deepEqual(change(12, 8), { direction: "up", percent: 50, before: 8 });
  assert.deepEqual(change(8, 12), { direction: "down", percent: 33, before: 12 });
  assert.deepEqual(change(7, 7), { direction: "flat", percent: 0, before: 7 });

  // Growth from nothing has no percentage. 0 to 4 is not "400% up", it is four
  // where there were none, and a dashboard that prints Infinity got here by
  // not deciding this.
  assert.deepEqual(change(4, 0), { direction: "up", percent: null, before: 0 });
  // And nothing to nothing is flat, not a division by zero.
  assert.deepEqual(change(0, 0), { direction: "flat", percent: 0, before: 0 });

  // Down to nothing is a real fall and keeps its percentage.
  assert.deepEqual(change(0, 5), { direction: "down", percent: 100, before: 5 });
}

// --- and what it says out loud -------------------------------------------

{
  // Colour never carries it alone, so every state has words.
  assert.equal(changeWords(change(12, 8), "quarter"), "up 50% on the quarter before");
  assert.equal(changeWords(change(8, 12), "quarter"), "down 33% on the quarter before");
  assert.equal(changeWords(change(7, 7), "month"), "the same as the month before");
  assert.equal(changeWords(change(4, 0), "month"), "up from none the month before");
}

// --- the two lists --------------------------------------------------------

{
  // Every series names a column, and no two name the same one: a copied entry
  // would draw one series twice under two labels.
  const columns = [...GROWTH_SERIES, ...SITE_REVENUE].map((s) => s.column);
  assert.equal(new Set(columns).size, columns.length, "two series share a column");

  const keys = [...GROWTH_SERIES, ...SITE_REVENUE].map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, "two series share a key");

  // Exactly one of the two revenue streams is money actually received. The
  // screen's whole caveat rests on that, so it is asserted rather than
  // assumed: a second `received: true` would make the page claim a receipt
  // for a slot nobody has banked.
  assert.equal(SITE_REVENUE.filter((s) => s.received).length, 1);
  assert.equal(SITE_REVENUE.find((s) => s.received)?.key, "listingPence");
}

console.log("site-growth: all assertions passed");
