import assert from "node:assert/strict";
import { countLine } from "../moderation-elsewhere";

// One report is one report. The stage 5 singular slip has now appeared on a
// tile, a list header, a unit count and a disposition picker, so this one gets
// a test before it ships rather than after a client reads "1 are with one".
assert.equal(countLine({ waiting: 1, answered: 0 }), "1 at your club is with one now.");
assert.equal(countLine({ waiting: 3, answered: 0 }), "3 at your club are with one now.");
assert.equal(countLine({ waiting: 0, answered: 1 }),
  "1 at your club has been answered by one.");
assert.equal(countLine({ waiting: 0, answered: 4 }),
  "4 at your club have been answered by one.");

// Both halves, which is the ordinary state of a club a few months in: one
// still open and some already ruled on.
assert.equal(countLine({ waiting: 1, answered: 2 }),
  "1 at your club is with one now, and 2 have been answered.");
assert.equal(countLine({ waiting: 2, answered: 1 }),
  "2 at your club are with one now, and 1 has been answered.");

// It says nothing when there is nothing, rather than "0 are with one", which
// is the page answering a question nobody asked and is the ordinary case.
assert.equal(countLine({ waiting: 0, answered: 0 }), "");

// And it never names a kind, a reporter or an author. The whole design is a
// count: 0128 hides the content from the club on purpose and this must not be
// the hole in it.
for (const counts of [{ waiting: 1, answered: 0 }, { waiting: 2, answered: 3 }]) {
  const line = countLine(counts);
  for (const leak of ["reply", "post", "review", "message", "by "]) {
    assert.ok(!line.toLowerCase().includes(leak),
      `the line leaked "${leak}": ${line}`);
  }
}

console.log("moderation-elsewhere: all pass");
