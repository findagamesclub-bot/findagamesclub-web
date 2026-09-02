import assert from "node:assert/strict";
import { milesLabel } from "../geo";

// Anything you would walk reads the same, rather than as a false precision.
assert.equal(milesLabel(0), "under a mile");
assert.equal(milesLabel(0.4), "under a mile");
assert.equal(milesLabel(0.99), "under a mile");

// Near enough that a decimal changes the decision.
assert.equal(milesLabel(1), "1.0 mi away");
assert.equal(milesLabel(3.44), "3.4 mi away");
assert.equal(milesLabel(9.96), "10.0 mi away");

// Far enough that it does not.
assert.equal(milesLabel(10), "10 mi away");
assert.equal(milesLabel(61.3), "61 mi away");
assert.equal(milesLabel(61.7), "62 mi away");

// Never renders "NaN mi away" into the page.
assert.equal(milesLabel(NaN), "");
assert.equal(milesLabel(-3), "");

console.log("milesLabel: all assertions passed");
