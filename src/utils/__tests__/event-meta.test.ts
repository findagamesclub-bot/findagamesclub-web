import assert from "node:assert/strict";
import { playsFortyK, eventRecordsArmies } from "../event-meta";

{
  // The client's own condition, and the spellings members actually type.
  assert.equal(playsFortyK(["Warhammer 40,000"]), true);
  assert.equal(playsFortyK(["warhammer 40k"]), true);
  assert.equal(playsFortyK(["Kill Team", "Warhammer 40k"]), true);

  assert.equal(playsFortyK(["Age of Sigmar"]), false);
  assert.equal(playsFortyK(["Kill Team"]), false);
  assert.equal(playsFortyK([]), false);
  assert.equal(playsFortyK(null), false);
}

console.log("event-meta: all pass");

// An event's own games decide whether the army fields apply, whatever the club
// plays the rest of the year. The date does not come into it: the club types
// these in while the event is still running.
{
  assert.equal(eventRecordsArmies(["Warhammer 40,000"]), true, "a 40k event");
  assert.equal(eventRecordsArmies(["warhammer 40k"]), true, "the short spelling folds");
  assert.equal(eventRecordsArmies(["Blood Bowl"]), false,
    "an event that names another game is not a 40k event");
  assert.equal(eventRecordsArmies(["Blood Bowl", "Warhammer 40,000"]), true,
    "one of the named games is enough");
  assert.equal(eventRecordsArmies([]), true,
    "every imported event names none, and the armies are the better evidence");
  assert.equal(eventRecordsArmies(null), true, "and so is a null column");
}

console.log("event-meta: army field gate passed");
