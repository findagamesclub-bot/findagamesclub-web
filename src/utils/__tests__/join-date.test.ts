import assert from "node:assert/strict";
import { joinDateProblem, yearsBetween, JOIN_DATE_MESSAGES } from "../join-date";

const TODAY = "2026-10-10";

assert.equal(joinDateProblem("2015-06-01", TODAY), null);
assert.equal(joinDateProblem(TODAY, TODAY), null, "today is a date somebody can join on");

assert.equal(joinDateProblem("", TODAY), "empty");
assert.equal(joinDateProblem("   ", TODAY), "empty");
assert.equal(joinDateProblem("last Tuesday", TODAY), "unreadable");
assert.equal(joinDateProblem("2026-13-40", TODAY), "unreadable");
assert.equal(joinDateProblem("2026-10-11", TODAY), "future");
assert.equal(joinDateProblem("0202-06-01", TODAY), "tooOld");

// Every problem has words, or the field would refuse in silence.
for (const key of Object.keys(JOIN_DATE_MESSAGES)) {
  assert.ok(JOIN_DATE_MESSAGES[key as keyof typeof JOIN_DATE_MESSAGES]);
}

// Counted by anniversary, the way `age()` counts in SQL. The day before the
// anniversary is still the year before.
assert.equal(yearsBetween("2024-08-18", "2026-08-17"), 1);
assert.equal(yearsBetween("2024-08-18", "2026-08-18"), 2);
assert.equal(yearsBetween("2016-02-29", "2026-02-28"), 9, "29 February is not a year early");
assert.equal(yearsBetween("2016-02-29", "2026-03-01"), 10);
assert.equal(yearsBetween("2026-10-10", "2026-10-10"), 0);
// Never negative, whatever a caller hands it.
assert.equal(yearsBetween("2030-01-01", TODAY), 0);
assert.equal(yearsBetween("nonsense", TODAY), 0);

console.log("join-date: all pass");
