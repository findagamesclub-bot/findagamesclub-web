import assert from "node:assert/strict";
import { eventWhen } from "../event-when";

const ev = (startDate: string | null, startTime: string | null,
            endDate: string | null, endTime: string | null) =>
  ({ startDate, startTime, endDate, endTime });

// One evening, both ends known.
assert.deepEqual(eventWhen(ev("2026-09-26", "09:30", "2026-09-26", "18:00")),
  { starts: "Sat 26 Sep · 09:30", ends: "Sat 26 Sep · 18:00" });

// A weekend. The end carries its own day, which is the whole point.
assert.deepEqual(eventWhen(ev("2026-04-04", "09:00", "2026-04-05", "16:00")),
  { starts: "Sat 4 Apr · 09:00", ends: "Sun 5 Apr · 16:00" });

// Spans days but the club never gave a finishing time.
assert.deepEqual(eventWhen(ev("2026-04-04", "09:00", "2026-04-05", null)),
  { starts: "Sat 4 Apr · 09:00", ends: "Sun 5 Apr" });

// Nothing to add: same day, no end time. No empty "ENDS" line.
assert.deepEqual(eventWhen(ev("2026-09-26", "09:30", "2026-09-26", null)),
  { starts: "Sat 26 Sep · 09:30", ends: null });
assert.deepEqual(eventWhen(ev("2026-09-26", null, null, null)),
  { starts: "Sat 26 Sep", ends: null });

// An end time with no end date still belongs to the start day.
assert.deepEqual(eventWhen(ev("2026-09-26", "09:30", null, "18:00")),
  { starts: "Sat 26 Sep · 09:30", ends: "Sat 26 Sep · 18:00" });

// An undated event renders no line at all rather than "Invalid Date".
assert.deepEqual(eventWhen(ev(null, null, null, null)), { starts: null, ends: null });

console.log("eventWhen: all assertions passed");
