import assert from "node:assert/strict";
import { messageTime } from "../dates";

// Fixed "now" so the test does not drift. 26 Aug 2026, 15:00 London (BST = +1).
const now = new Date("2026-08-26T14:00:00Z");

assert.equal(messageTime("2026-08-26T13:02:00Z", now), "14:02", "same day gives the clock");
assert.equal(messageTime("2026-08-26T00:30:00Z", now), "01:30", "early morning is still today");
assert.equal(messageTime("2026-08-25T18:45:00Z", now), "Yesterday 19:45");
assert.equal(messageTime("2026-08-20T09:00:00Z", now), "20 Aug", "this year drops the year");
assert.equal(messageTime("2025-11-03T09:00:00Z", now), "3 Nov 2025");

// BST is the trap: 23:30 UTC on the 25th is 00:30 London on the 26th, so it
// is today, not yesterday.
assert.equal(messageTime("2026-08-25T23:30:00Z", now), "00:30");

// And in winter, when London is UTC, the same instant stays on its own day.
const winter = new Date("2026-01-15T12:00:00Z");
assert.equal(messageTime("2026-01-15T09:05:00Z", winter), "09:05");
assert.equal(messageTime("2026-01-14T23:30:00Z", winter), "Yesterday 23:30");

assert.equal(messageTime(null), null);
assert.equal(messageTime("not a date"), null);

console.log("all passing");
