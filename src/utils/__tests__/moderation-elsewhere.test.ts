import assert from "node:assert/strict";
import { countLine } from "../moderation-elsewhere";

// One report is one report. The stage 5 singular slip has now appeared on a
// tile, a list header, a unit count and a disposition picker, so this one gets
// a test before it ships rather than after a client reads "1 are with one".
const TAIL = " None of these are counted in the tabs above.";
assert.equal(countLine({ waiting: 1, answered: 0 }),
  `1 of those is with a site admin now.${TAIL}`);
assert.equal(countLine({ waiting: 3, answered: 0 }),
  `3 of those are with a site admin now.${TAIL}`);
assert.equal(countLine({ waiting: 0, answered: 1 }),
  `1 of those has been answered by a site admin.${TAIL}`);
assert.equal(countLine({ waiting: 0, answered: 4 }),
  `4 of those have been answered by a site admin.${TAIL}`);

// Both halves, which is the ordinary state of a club a few months in: one
// still open and some already ruled on.
assert.equal(countLine({ waiting: 1, answered: 2 }),
  `1 of those is with a site admin now, and 2 more have been answered there.${TAIL}`);
assert.equal(countLine({ waiting: 2, answered: 1 }),
  `2 of those are with a site admin now, and 1 more has been answered there.${TAIL}`);

// The whole of the client's second complaint: "the below text mentions 13
// reports, 5 answered, however only 12 are showing and 6 answered in the
// filters?" Both counts were right and neither said which list it was about,
// so every form of this line has to say so in words.
for (const counts of [{ waiting: 1, answered: 0 }, { waiting: 0, answered: 1 },
                      { waiting: 2, answered: 3 }]) {
  assert.ok(countLine(counts).includes("counted in the tabs above"),
    `the line did not say which list it counts: ${countLine(counts)}`);
  assert.ok(countLine(counts).includes("site admin"),
    `the line did not say who has them: ${countLine(counts)}`);
}

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
