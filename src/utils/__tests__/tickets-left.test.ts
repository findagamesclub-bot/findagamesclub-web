import assert from "node:assert/strict";
import { ticketsLeft } from "../tickets-left";

// The bug: 0 and null are both falsy, and only one of them means sold out.
assert.deepEqual(ticketsLeft(0), { label: "Sold out", soldOut: true });
assert.equal(ticketsLeft(null), null, "a club that never said should show nothing");
assert.equal(ticketsLeft(undefined), null);

assert.deepEqual(ticketsLeft(60), { label: "60 left", soldOut: false });
assert.deepEqual(ticketsLeft(60, true), { label: "60 tickets left", soldOut: false });
assert.deepEqual(ticketsLeft(1), { label: "1 left", soldOut: false });

// Negative should never happen, but it must not read as "-3 left".
assert.deepEqual(ticketsLeft(-3), { label: "Sold out", soldOut: true });

console.log("tickets-left ok");
