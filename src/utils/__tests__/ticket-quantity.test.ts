import assert from "node:assert/strict";

import { allowedQuantity, canAddMore, MAX_PER_LINE } from "../ticket-quantity";

// --- within what is left --------------------------------------------------

{
  assert.deepEqual(allowedQuantity(1, 5), { quantity: 1, refusal: null });
  assert.deepEqual(allowedQuantity(5, 5), { quantity: 5, refusal: null },
    "taking the last of them is allowed");
  assert.deepEqual(allowedQuantity(3, null), { quantity: 3, refusal: null },
    "a club that capped nothing caps nothing");
}

// --- past it --------------------------------------------------------------

{
  const one = allowedQuantity(3, 1, "Last minute entry");
  assert.equal(one.quantity, 1, "trimmed rather than refused outright");
  assert.equal(one.refusal, "Only one Last minute entry is left, so that is what you have.");

  const few = allowedQuantity(9, 4, "Standard entry");
  assert.equal(few.quantity, 4);
  assert.ok(few.refusal?.includes("Only 4 of Standard entry are left"));
}

{
  const gone = allowedQuantity(2, 0, "Standard entry");
  assert.deepEqual(gone, { quantity: 0, refusal: "Standard entry has sold out." });
}

// --- the ceiling ----------------------------------------------------------

{
  const lots = allowedQuantity(50, null);
  assert.equal(lots.quantity, MAX_PER_LINE);
  assert.ok(lots.refusal?.includes("20 is the most"));

  assert.equal(allowedQuantity(MAX_PER_LINE, null).refusal, null, "exactly 20 is fine");
  // What is left wins over the ceiling when it is the smaller of the two.
  assert.equal(allowedQuantity(50, 3).quantity, 3);
}

// --- taking it out --------------------------------------------------------

{
  assert.deepEqual(allowedQuantity(0, 5), { quantity: 0, refusal: null },
    "zero is how a stepper says remove, not a refusal");
  assert.deepEqual(allowedQuantity(-2, 5), { quantity: 0, refusal: null });
  assert.deepEqual(allowedQuantity(0, 0), { quantity: 0, refusal: null },
    "and removing something already sold out is still just removing it");
}

// --- rubbish in ------------------------------------------------------------

{
  assert.equal(allowedQuantity(2.7, 5).quantity, 2, "no half tickets");
  assert.equal(allowedQuantity(Number.NaN, 5).quantity, 0);
}

// --- what the plus button asks --------------------------------------------

{
  assert.equal(canAddMore(0, 1), true);
  assert.equal(canAddMore(1, 1), false, "the one place left is already held");
  assert.equal(canAddMore(0, 0), false, "sold out");
  assert.equal(canAddMore(3, null), true, "no cap, keep going");
  assert.equal(canAddMore(MAX_PER_LINE, null), false, "until the ceiling");
}

console.log("ticket-quantity: all assertions passed");
