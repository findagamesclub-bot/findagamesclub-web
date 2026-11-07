import assert from "node:assert/strict";
import { stampDate } from "../dates";


// ------------------------------------------------- a stamp is a London day
//
// `shortDate` reads a CALENDAR date with UTC getters, which is right: it is
// parsed as UTC midnight. A TIMESTAMP is a different thing, and reading one
// the same way puts a refund recorded at half past midnight in London on the
// day before it happened. That is the TS half of the rule 0123 wrote for SQL.

// 00:30 on 7 November, London. In UTC that is 6 November.
assert.equal(stampDate("2026-11-07T00:30:00+00:00"), "7 Nov 2026");
assert.equal(stampDate("2026-11-06T23:30:00Z"), "6 Nov 2026");

// And through British Summer Time, where London is an hour ahead: 00:30 on
// 1 July London is 23:30 on 30 June UTC, and the club's own day is 1 July.
assert.equal(stampDate("2026-06-30T23:30:00Z"), "1 Jul 2026");

assert.equal(stampDate(null), null);
assert.equal(stampDate("not a date"), null);

console.log("dates: a stamp reads as its London day");
