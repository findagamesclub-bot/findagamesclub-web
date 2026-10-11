import assert from "node:assert/strict";
import { pointsCapNote } from "../points-cap";

// The client's own case: Didcot Premium covers 10% of a bill, the booking is
// £4.50 after the tier discount, points are worth 5p, so nine of them fit.
assert.equal(
  pointsCapNote(1208, 9, 10),
  "You have 1,208. Up to 9 here, which is 10% of this bill.");

// The same tier on a bigger bill. The share is what changes the number, which
// is the thing the sentence has to make obvious.
assert.equal(
  pointsCapNote(1208, 95, 10),
  "You have 1,208. Up to 95 here, which is 10% of this bill.");

// A balance lower than the share allows. Naming the share here would be a
// reason that did not apply.
assert.equal(
  pointsCapNote(5, 5, 10),
  "You have 5, and all of them can go on this one.");

// A club that lets points cover everything says so in words rather than
// printing "which is 100% of this bill".
assert.equal(
  pointsCapNote(1208, 90, 100),
  "You have 1,208. Up to 90 here, which is the whole bill.");

// Over 100 is not a thing the editor allows, and it must not read as one.
assert.match(pointsCapNote(1208, 90, 140), /the whole bill\.$/);

// Thousands are grouped, because a balance is read at a glance.
assert.match(pointsCapNote(12083, 9, 10), /^You have 12,083\./);

// Nothing here can go negative or fractional.
assert.equal(pointsCapNote(0, 0, 10), "You have 0, and all of them can go on this one.");
assert.match(pointsCapNote(1208, 9.7, 10), /Up to 9 here/);

console.log("points-cap: all pass");
