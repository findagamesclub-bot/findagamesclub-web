import assert from "node:assert/strict";
import { clampPage, pageCount, pageFrom, pageOf, rangeFor, showingLabel } from "../paging";

// Anything unusable in the query string is page 1, never a crash or page 0.
assert.equal(pageFrom(undefined), 1);
assert.equal(pageFrom("abc"), 1);
assert.equal(pageFrom("0"), 1);
assert.equal(pageFrom("-4"), 1);
assert.equal(pageFrom("3"), 3);
assert.equal(pageFrom(["2", "9"]), 2);
assert.equal(pageFrom("2.7"), 2);

// An empty list still has one page, so "page 1 of 0" cannot be printed.
assert.equal(pageCount(0, 10), 1);
assert.equal(pageCount(10, 10), 1);
assert.equal(pageCount(11, 10), 2);
assert.equal(pageCount(-5, 10), 1);

// A stale link to page 40 of a list that shrank lands on the last real page.
assert.equal(clampPage(40, 25, 10), 3);
assert.equal(clampPage(1, 0, 10), 1);

assert.deepEqual(rangeFor(1, 10), { from: 0, to: 9 });
assert.deepEqual(rangeFor(3, 10), { from: 20, to: 29 });

const items = Array.from({ length: 25 }, (_, i) => i);
assert.deepEqual(pageOf(items, 1, 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
assert.deepEqual(pageOf(items, 3, 10), [20, 21, 22, 23, 24]);
// Past the end shows the last page rather than nothing.
assert.deepEqual(pageOf(items, 9, 10), [20, 21, 22, 23, 24]);
assert.deepEqual(pageOf([], 1, 10), []);

assert.equal(showingLabel(1, 0, "orders", 10), "No orders");
assert.equal(showingLabel(1, 7, "orders", 10), "7 orders");
assert.equal(showingLabel(2, 25, "orders", 10), "Showing 11 to 20 of 25 orders");
assert.equal(showingLabel(3, 25, "orders", 10), "Showing 21 to 25 of 25 orders");
// The label agrees with what is on screen even when the page number is stale.
assert.equal(showingLabel(9, 25, "orders", 10), "Showing 21 to 25 of 25 orders");

console.log("paging: all assertions passed");
