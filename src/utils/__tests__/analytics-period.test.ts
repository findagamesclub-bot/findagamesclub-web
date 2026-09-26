import assert from "node:assert/strict";

import {
  DEFAULT_PERIOD, PERIODS, isPeriod, periodLabel, periodMonths, periodRange, readPeriod,
} from "../analytics-period";

assert.equal(PERIODS.length, 5);
assert.equal(isPeriod("3m"), true);
assert.equal(isPeriod("fortnight"), false);

// A period nobody offers falls back rather than filtering to nothing.
assert.equal(readPeriod(undefined), DEFAULT_PERIOD);
assert.equal(readPeriod("nonsense"), DEFAULT_PERIOD);
assert.equal(readPeriod("12m"), "12m");
assert.equal(readPeriod(["6m", "3m"]), "6m");

assert.equal(periodLabel("month"), "This month");
assert.equal(periodMonths("12m"), 12);

// "This month" is the first of the month to today, which is what it means.
assert.deepEqual(periodRange("month", "2026-09-23"),
  { from: "2026-09-01", to: "2026-09-23" });

// And the rest count back a fixed number of days, so 6m really is twice 3m.
assert.deepEqual(periodRange("3m", "2026-09-23"), { from: "2026-06-25", to: "2026-09-23" });
assert.deepEqual(periodRange("12m", "2026-09-23"), { from: "2025-09-23", to: "2026-09-23" });

// Across a year boundary, and across a leap day, with UTC getters so a reader
// behind UTC does not get a window a day out.
assert.deepEqual(periodRange("month", "2027-01-04"), { from: "2027-01-01", to: "2027-01-04" });
assert.deepEqual(periodRange("3m", "2028-03-01").from, "2027-12-02");

console.log("analytics-period: all assertions passed");

// --- the date tile ---------------------------------------------------------

import { dateParts } from "../dates";

{
  // A club date is a calendar date. Read in the viewer's zone, a Thursday
  // night lands on Wednesday for anybody west of Greenwich, and this file runs
  // under TZ=America/New_York precisely to catch that.
  // en-GB abbreviates September to "Sept", not "Sep". Pinned because the tile
  // is sized for it, and a locale data change that shortened it would go
  // unnoticed until a date tile looked wrong.
  assert.deepEqual(dateParts("2026-09-26"), { day: "26", month: "SEPT", weekday: "SAT" });
  assert.deepEqual(dateParts("2026-01-01"), { day: "1", month: "JAN", weekday: "THU" });
  // Midnight UTC is the edge the naive version got wrong.
  assert.equal(dateParts("2026-03-01T00:00:00Z")?.day, "1");

  assert.equal(dateParts(null), null);
  assert.equal(dateParts(undefined), null);
  assert.equal(dateParts(""), null);
  assert.equal(dateParts("not a date"), null);
}

console.log("dateParts: all assertions passed");
