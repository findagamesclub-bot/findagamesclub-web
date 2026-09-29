import assert from "node:assert/strict";
import { copyPoints, copyRun, linePoints, priceList } from "../army-pricing";

// The real Castigator, copied from the legacy catalogue file: copies 1 and 2
// at 165, copy 3 and up at 175.
const castigator = {
  name: "Castigator",
  basePoints: 165,
  options: [{ label: "1 model", modelCount: 1, points: "165" }],
  copyCostRules: [
    { fromCopy: 1, toCopy: 2, options: [{ label: "1 model", modelCount: 1, points: "165" }] },
    { fromCopy: 3, toCopy: null, options: [{ label: "1 model", modelCount: 1, points: "175" }] },
  ],
};

const plain = { name: "Battle Sister Squad", basePoints: 105 };

// ------------------------------------------------------------ copy by copy
{
  assert.equal(copyPoints(castigator, 1), 165);
  assert.equal(copyPoints(castigator, 2), 165);
  assert.equal(copyPoints(castigator, 3), 175);
  // `toCopy: null` means every copy after, not just the third.
  assert.equal(copyPoints(castigator, 9), 175);
}
{
  // No rules at all: every copy is the base price.
  assert.equal(copyPoints(plain, 1), 105);
  assert.equal(copyPoints(plain, 4), 105);
}

// ------------------------------------------------------------- a whole line
{
  // The figure from the spec, which is the one worth being sure about.
  assert.equal(linePoints(castigator, 3), 505);
  assert.equal(linePoints(castigator, 2), 330);
  assert.equal(linePoints(castigator, 1), 165);
  assert.equal(linePoints(castigator, 0), 0);
  // Four is 165 + 165 + 175 + 175.
  assert.equal(linePoints(castigator, 4), 680);
}
{
  // A merged line of three escalates exactly as three separate copies do,
  // which is what legacy's own merge depends on.
  assert.equal(linePoints(castigator, 3), copyPoints(castigator, 1)
    + copyPoints(castigator, 2) + copyPoints(castigator, 3));
}
{
  assert.equal(linePoints(plain, 3), 315);
  // A fractional or negative count cannot make a price up.
  assert.equal(linePoints(plain, -2), 0);
  assert.equal(linePoints(plain, 2.7), 210);
}

// -------------------------------------------------------- refusing to guess
{
  // A points value that will not parse falls back to what the unit costs
  // rather than becoming free. `Number("")` is 0 and that is how a listing
  // price shipped as free in stage 5.
  const broken = { name: "Broken", basePoints: 90,
                   options: [{ label: "1 model", points: "" }] };
  assert.equal(copyPoints(broken, 1), 90);
  const nonsense = { name: "Nonsense", basePoints: 90,
                     options: [{ label: "1 model", points: "not a number" }] };
  assert.equal(copyPoints(nonsense, 1), 90);
}

// ------------------------------------------------------------- named options
{
  const withOptions = {
    name: "Squad", basePoints: 105,
    options: [
      { label: "5 models", modelCount: 5, points: "105" },
      { label: "10 models", modelCount: 10, points: "200" },
    ],
  };
  assert.equal(copyPoints(withOptions, 1, "10 models"), 200);
  assert.equal(copyPoints(withOptions, 1, "5 models"), 105);
  // An option nobody offers falls back to the first rather than to nothing.
  assert.equal(copyPoints(withOptions, 1, "7 models"), 105);
  assert.equal(linePoints(withOptions, 2, "10 models"), 400);
}

// --------------------------------------------------------------- whole list
{
  const priced = priceList([
    { unit: castigator, count: 3 },
    { unit: plain, count: 2 },
  ], 2000);
  assert.equal(priced.total, 505 + 210);
  assert.equal(priced.remaining, 2000 - 715);
  assert.equal(priced.over, false);
}
{
  const over = priceList([{ unit: castigator, count: 13 }], 2000);
  assert.equal(over.over, true);
  assert.ok(over.remaining < 0);
  // No limit means nothing can be over it: a collection is not an army list.
  assert.equal(priceList([{ unit: castigator, count: 13 }]).over, false);
}

console.log("army-pricing: all pass");

// ------------------------------------------- copies count across lines, not
// ------------------------------------------- per line
{
  // The bug this file shipped with. Two lines of the same unit are still one
  // unit as far as the escalation is concerned, or splitting a line would be
  // a way to pay less: 165 + 165 + 175, never 165 + 165 + 165.
  const split = priceList([
    { unit: castigator, count: 2 },
    { unit: castigator, count: 1, optionLabel: "Default" },
  ]);
  assert.equal(split.total, 505);
  assert.equal(split.total, priceList([{ unit: castigator, count: 3 }]).total);

  // Three lines of one each reach the same place.
  assert.equal(priceList([
    { unit: castigator, count: 1 },
    { unit: castigator, count: 1 },
    { unit: castigator, count: 1 },
  ]).total, 505);

  // A different unit has its own counter and is not dragged up by its neighbour.
  assert.equal(priceList([
    { unit: castigator, count: 3 },
    { unit: plain, count: 2 },
  ]).total, 505 + 210);

  // Case and padding in the name must not start a second counter.
  assert.equal(priceList([
    { unit: { ...castigator, name: " castigator " }, count: 2 },
    { unit: castigator, count: 1 },
  ]).total, 505);
}

{
  // The run, which is what a line needs to decide whether it can show a price
  // per unit at all.
  assert.deepEqual(copyRun(castigator, 1, 3), [165, 165, 175]);
  assert.deepEqual(copyRun(castigator, 3, 2), [175, 175]);
  assert.deepEqual(copyRun(castigator, 1, 0), []);
}

console.log("army-pricing: cross-line copies pass");
