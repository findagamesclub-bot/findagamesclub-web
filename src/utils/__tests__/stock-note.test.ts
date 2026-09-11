import assert from "node:assert/strict";
import { stockNote, MAX_PER_LINE } from "../merch-bag";

// Room to spare: a plain count, quietly.
assert.deepEqual(stockNote(2, 10), { text: "10 left", warn: false });

// The plus is dead because the club has no more. Say which.
assert.deepEqual(stockNote(10, 10), { text: "10 left", warn: true });
// And if a bag somehow holds more than there is, it still reads as the limit.
assert.deepEqual(stockNote(12, 10), { text: "10 left", warn: true });

// Dead for the other reason: plenty in stock, twenty at a time.
assert.deepEqual(stockNote(MAX_PER_LINE, 50), { text: "20 at a time", warn: true });
assert.deepEqual(stockNote(19, 50), { text: "50 left", warn: false });

// A size that has gone while the bag sat there.
assert.deepEqual(stockNote(1, 0), { text: "0 left", warn: true });

console.log("stock-note: all assertions passed");
