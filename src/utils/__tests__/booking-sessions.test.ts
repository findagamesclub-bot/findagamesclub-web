/**
 * Session generation.
 *
 * Run with: npx tsx src/utils/__tests__/booking-sessions.test.ts
 * The BST cases are the point of this file — every date here is a club-night
 * wall-clock date, and getting one wrong moves somebody's game by a day.
 */

import { generateSessions, bookableSessions, addDays, weekdayOf } from "../booking-sessions";
import { monthYear, shortDate, nightLabel } from "../dates";
import type { ClubScheduleSlot } from "@/types/booking";

let failed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` +
    (ok ? "" : `\n        got ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`));
}

const slot = (id: number, day: string, position: number, time = "19:00 - 22:30"): ClubScheduleSlot =>
  ({ id, day, time, label: null, position });

// Didcot: Thursdays only.
const didcot = [slot(1, "Thursday", 0)];
// Iron Dice: two nights, deliberately out of position order.
const ironDice = [slot(11, "Saturday", 1, "11:00 - 17:00"), slot(10, "Tuesday", 0, "18:00 - 22:00")];

check("weekday of a known Thursday", weekdayOf("2026-08-20"), "Thursday");
check("addDays crosses a month end", addDays("2026-08-31", 1), "2026-09-01");
check("addDays crosses a year end", addDays("2026-12-31", 1), "2027-01-01");

// --- BST: the clocks go back at 02:00 on 25 Oct 2026 ---
check("day arithmetic survives the BST->GMT change", addDays("2026-10-24", 2), "2026-10-26");
check("weekday survives the BST->GMT change", weekdayOf("2026-10-26"), "Monday");
// And forward, 29 March 2026.
check("day arithmetic survives GMT->BST", addDays("2026-03-28", 2), "2026-03-30");

// --- generation ---
const fourWeeks = generateSessions(didcot, "2026-08-20", 28);
check("a weekly club yields 4 nights in 28 days", fourWeeks.length, 4);
check("first is the start date itself", fourWeeks[0]!.date, "2026-08-20");
check("nights are 7 days apart", fourWeeks.map((s) => s.date),
  ["2026-08-20", "2026-08-27", "2026-09-03", "2026-09-10"]);
check("legacy key keeps the schedule position", fourWeeks[0]!.legacyKey, "2026-08-20__0");
check("session id is the stable club_sessions id", fourWeeks[0]!.clubSessionId, 1);

const twoNights = generateSessions(ironDice, "2026-08-20", 7);
check("a two-night club yields both", twoNights.map((s) => s.day),
  ["Saturday", "Tuesday"]);
check("ordered by date, not by schedule position", twoNights.map((s) => s.date),
  ["2026-08-22", "2026-08-25"]);

check("no schedule yields nothing", generateSessions([], "2026-08-20", 28), []);
check("zero horizon yields nothing", generateSessions(didcot, "2026-08-20", 0), []);

// --- advanceBookingDates counts NIGHTS, not days ---
const horizon = generateSessions(didcot, "2026-08-20", 90);
check("13 Thursdays in 90 days", horizon.length, 13);
check("Didcot's 4 lets you reach 4 nights", bookableSessions(horizon, 4).length, 4);
check("...which is a whole month out",
  bookableSessions(horizon, 4).at(-1)!.date, "2026-09-10");

const monthly = generateSessions([slot(1, "Thursday", 0)], "2026-08-20", 365);
check("the same 4 at a weekly club is ~1 month",
  bookableSessions(monthly, 4).at(-1)!.date, "2026-09-10");

// A club with two nights a week: 4 nights is only a fortnight.
const twiceWeekly = generateSessions(ironDice, "2026-08-20", 90);
check("4 nights at a twice-weekly club is a fortnight",
  bookableSessions(twiceWeekly, 4).at(-1)!.date, "2026-09-01");

check("0 means no restriction", bookableSessions(horizon, 0).length, 13);

// Two slots on the SAME night both stay inside one allowed date.
const doubleUp = generateSessions(
  [slot(1, "Thursday", 0, "18:00"), slot(2, "Thursday", 1, "20:30")], "2026-08-20", 28);
check("two slots on one night are 2 sessions", doubleUp.length, 8);
check("but count as one night against the limit",
  bookableSessions(doubleUp, 2).map((s) => s.date),
  ["2026-08-20", "2026-08-20", "2026-08-27", "2026-08-27"]);

// --- date labels must not move with the reader's timezone ---
// "2026-09-03" parses as UTC midnight. Read with local getters, anyone behind
// UTC sees 2 Sep and the month label says August — server and client then
// disagree and React throws the tree away.
check("month label of the 1st is its own month", monthYear("2026-09-01"), "Sep 2026");
check("month label of the 3rd", monthYear("2026-09-03"), "Sep 2026");
check("month label at a year boundary", monthYear("2027-01-01"), "Jan 2027");
check("short date of the 1st", shortDate("2026-09-01"), "1 Sep 2026");
check("night label of the 1st", nightLabel("2026-09-01"), "Tue 1 Sep");
check("night label at a year boundary", nightLabel("2027-01-01"), "Fri 1 Jan");

console.log(failed ? `\n${failed} FAILING` : "\nall passing");
process.exit(failed ? 1 : 0);
