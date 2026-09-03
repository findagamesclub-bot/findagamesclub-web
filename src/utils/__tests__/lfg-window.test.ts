import assert from "node:assert/strict";
import { postingWindow } from "../lfg-window";

// The first N of the nights offered, in order.
assert.deepEqual(
  postingWindow(["2026-09-10", "2026-09-17", "2026-09-24"], 2),
  ["2026-09-10", "2026-09-17"],
);

// A full night never reaches this list, so the window slides past it to the
// next night with a table free. This is the bug the client reported: with the
// first two evenings full, the advert was offered on no night at all.
assert.deepEqual(
  postingWindow(["2026-09-24", "2026-10-01", "2026-10-08"], 2),
  ["2026-09-24", "2026-10-01"],
);

// Two sessions on one evening are one night, not two.
assert.deepEqual(
  postingWindow(["2026-09-10", "2026-09-10", "2026-09-17"], 2),
  ["2026-09-10", "2026-09-17"],
);

// Zero is no limit, not none. Reading it as none would silently switch the
// feature off for any club that left the field blank.
assert.deepEqual(
  postingWindow(["2026-09-10", "2026-09-17"], 0),
  ["2026-09-10", "2026-09-17"],
);

// Fewer nights than the window allows is not an error.
assert.deepEqual(postingWindow(["2026-09-10"], 5), ["2026-09-10"]);

// Nothing bookable means nothing postable, rather than everything.
assert.deepEqual(postingWindow([], 2), []);

console.log("lfg-window: all assertions passed");
