import assert from "node:assert/strict";

import {
  crossesMidnight, formatTimeRange, isHalfRange, parseTimeRange,
} from "../time-range";

// --- every shape the client's real data actually holds --------------------

{
  // All twenty rows in clubs.json are exactly this, so this is the path that
  // matters and it has to round-trip without changing a character.
  for (const value of ["18:30 - 22:30", "19:00 - 22:00", "13:00 - 18:00", "18:00 - 23:00"]) {
    const range = parseTimeRange(value);
    assert.ok(range, `${value} did not parse`);
    assert.equal(formatTimeRange(range!.from, range!.to), value,
      `${value} did not survive the round trip`);
  }
}

{
  // Spacing, dashes and the word "to", because a club editing by hand will
  // produce all of them.
  assert.deepEqual(parseTimeRange("18:30-22:30"), { from: "18:30", to: "22:30" });
  assert.deepEqual(parseTimeRange("  18:30  –  22:30 "), { from: "18:30", to: "22:30" });
  assert.deepEqual(parseTimeRange("18:30 to 22:30"), { from: "18:30", to: "22:30" });
  // A single digit hour comes back padded, because that is what an input wants.
  assert.deepEqual(parseTimeRange("9:30 - 17:00"), { from: "09:30", to: "17:00" });
}

// --- words, which must never be silently replaced -------------------------

{
  // A club that has written something true in words has said something. Null
  // is the caller's signal to keep it rather than to blank it.
  for (const value of ["first Sunday, afternoon", "7-11 pm", "evenings", "TBC", ""]) {
    assert.equal(parseTimeRange(value), null, `${value} should not parse as a range`);
  }
  assert.equal(parseTimeRange(null), null);
  assert.equal(parseTimeRange(undefined), null);
}

{
  // Out of range digits are words wearing a colon, not times an input accepts.
  assert.equal(parseTimeRange("25:00 - 26:00"), null);
  assert.equal(parseTimeRange("18:75 - 22:30"), null);
}

// --- putting them back together -------------------------------------------

{
  assert.equal(formatTimeRange("18:30", "22:30"), "18:30 - 22:30");
  assert.equal(formatTimeRange(" 18:30 ", " 22:30 "), "18:30 - 22:30");
  assert.equal(formatTimeRange("", ""), "", "two empties is empty, not a dash");

  // Half a range is not a range. The step's own validation refuses the night by
  // name; what must not happen is saving "18:30 - " as though it were hours.
  assert.equal(formatTimeRange("18:30", ""), "18:30");
  assert.equal(formatTimeRange("", "22:30"), "22:30");
}

// --- a night that runs past midnight --------------------------------------

{
  // Real, and not an error: a Friday starting at 20:00 and ending at 01:00.
  assert.equal(crossesMidnight({ from: "20:00", to: "01:00" }), true);
  assert.equal(crossesMidnight({ from: "18:30", to: "22:30" }), false);
  assert.equal(crossesMidnight({ from: "18:30", to: "18:30" }), false);

  // And it survives the round trip like any other.
  assert.deepEqual(parseTimeRange("20:00 - 01:00"), { from: "20:00", to: "01:00" });
}


// --- half a range ---------------------------------------------------------

{
  // Picking a start and forgetting the end. It would otherwise save as the
  // club's hours and say nothing about when the night finishes.
  assert.equal(isHalfRange("18:38"), true);
  assert.equal(isHalfRange(" 9:00 "), true);

  // A whole range is not half of one.
  assert.equal(isHalfRange("18:30 - 22:30"), false);

  // And neither are words. A club that wrote "first Sunday, afternoon" has told
  // the truth in the only way it can, and the form must not refuse it.
  assert.equal(isHalfRange("first Sunday, afternoon"), false);
  assert.equal(isHalfRange("evenings"), false);
  assert.equal(isHalfRange(""), false);
  assert.equal(isHalfRange(null), false);
}

console.log("time-range: all assertions passed");
