import assert from "node:assert/strict";
import { listingsVersusClubs } from "../listing-reconcile";

// The client's own case: 8 clubs, 4 of them requested here.
{
  const said = listingsVersusClubs({ runs: 8, fromHere: 4 })!;
  assert.match(said, /You run 8 clubs and 4 of them started as a request here\./);
  assert.match(said, /The other 4 were set up another way/);
  assert.match(said, /All of them are on My clubs\./);
}

// Somebody who runs nothing gets no sentence: there is no second list for
// them to count against, and inventing one invents the confusion.
assert.equal(listingsVersusClubs({ runs: 0, fromHere: 0 }), null);

// Every count has a singular. "1 clubs" and "The other 1 were" are the
// mistakes this codebase has shipped before.
assert.match(listingsVersusClubs({ runs: 1, fromHere: 0 })!, /You run 1 club,/);
assert.doesNotMatch(listingsVersusClubs({ runs: 1, fromHere: 0 })!, /1 clubs/);
assert.match(listingsVersusClubs({ runs: 2, fromHere: 1 })!, /The other one was/);
assert.doesNotMatch(listingsVersusClubs({ runs: 2, fromHere: 1 })!, /The other 1 were/);

// Nothing missing: say so plainly rather than explaining an absence that is
// not there.
assert.match(listingsVersusClubs({ runs: 3, fromHere: 3 })!,
  /all of them started as a request here/);
assert.match(listingsVersusClubs({ runs: 1, fromHere: 1 })!,
  /You run 1 club, and it started as a request here\./);

// And none from here, which is the imported-club case the client guessed at.
// The first draft of this read "none of them not start as a request here",
// and the assertion pinned the broken sentence rather than the right one.
assert.match(listingsVersusClubs({ runs: 5, fromHere: 0 })!,
  /You run 5 clubs, and none of them started as a request here,/);
assert.match(listingsVersusClubs({ runs: 1, fromHere: 0 })!,
  /You run 1 club, and it did not start as a request here,/);
// The bug was the plural branch specifically: "none of them NOT START".
// "it did not start" is correct English and must survive the guard.
for (const runs of [2, 5]) {
  assert.doesNotMatch(listingsVersusClubs({ runs, fromHere: 0 })!, /them not start/);
}

// The sum never goes negative, however odd the inputs.
assert.doesNotMatch(listingsVersusClubs({ runs: 2, fromHere: 5 })!, /-/);

console.log("listing-reconcile: both numbers, and every one has a singular");
