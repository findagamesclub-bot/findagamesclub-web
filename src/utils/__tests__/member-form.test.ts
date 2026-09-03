import assert from "node:assert/strict";
import { gamesByMonth, formGuide } from "../member-form";

// Twelve buckets ending on the month today falls in, gaps included.
{
  const months = gamesByMonth([], "2026-09-03");
  assert.equal(months.length, 12);
  assert.equal(months[0]!.key, "2025-10");
  assert.equal(months[11]!.key, "2026-09");
  assert.equal(months.every((m) => m.played === 0), true);
}

// January carries the year, so a run that turns over is still readable.
assert.equal(gamesByMonth([], "2026-09-03").find((m) => m.key === "2026-01")!.label, "Jan 26");
assert.equal(gamesByMonth([], "2026-09-03").find((m) => m.key === "2026-02")!.label, "Feb");

// Outcomes land in the right month and unscored games are counted apart.
{
  const months = gamesByMonth([
    { date: "2026-09-01", outcome: "won" },
    { date: "2026-09-30", outcome: "lost" },
    { date: "2026-08-15", outcome: null },
    { date: "2026-08-16", outcome: "drew" },
  ], "2026-09-03");
  const sep = months.find((m) => m.key === "2026-09")!;
  const aug = months.find((m) => m.key === "2026-08")!;
  assert.deepEqual([sep.played, sep.won, sep.lost], [2, 1, 1]);
  assert.deepEqual([aug.played, aug.drawn, aug.unscored], [2, 1, 1]);
}

// Anything older than the window is dropped rather than piled onto the edge.
assert.equal(
  gamesByMonth([{ date: "2024-01-01", outcome: "won" }], "2026-09-03")
    .reduce((n, m) => n + m.played, 0),
  0,
);

// A date is read as the calendar day it says, not as the viewer's timezone.
// This is why the file uses UTC getters: run under TZ=America/New_York, a
// naive getMonth() puts 1 Sep into August.
assert.equal(
  gamesByMonth([{ date: "2026-09-01", outcome: "won" }], "2026-09-03")
    .find((m) => m.key === "2026-09")!.played,
  1,
);

// --- formGuide --------------------------------------------------------------

// Oldest first, so the run reads left to right the way a league table prints.
assert.deepEqual(
  formGuide([
    { date: "2026-03-01", outcome: "won" },
    { date: "2026-01-01", outcome: "lost" },
    { date: "2026-02-01", outcome: "drew" },
  ]),
  ["lost", "drew", "won"],
);

// Unscored games are left out: a form guide is a run of results.
assert.deepEqual(
  formGuide([
    { date: "2026-01-01", outcome: "won" },
    { date: "2026-02-01", outcome: null },
  ]),
  ["won"],
);

// Capped to the most recent, not the earliest.
assert.deepEqual(
  formGuide([
    { date: "2026-01-01", outcome: "lost" },
    { date: "2026-02-01", outcome: "won" },
    { date: "2026-03-01", outcome: "drew" },
  ], 2),
  ["won", "drew"],
);

console.log("member-form: all assertions passed");

// --- winRuns ----------------------------------------------------------------
import { winRuns } from "../member-form";

// Every run, oldest first, with the run still going counted at the end.
assert.deepEqual(
  winRuns([
    { date: "2026-01-01", outcome: "won" },
    { date: "2026-01-02", outcome: "lost" },
    { date: "2026-01-03", outcome: "won" },
    { date: "2026-01-04", outcome: "won" },
  ]),
  [1, 2],
);

// A draw breaks a run rather than extending it.
assert.deepEqual(
  winRuns([
    { date: "2026-01-01", outcome: "won" },
    { date: "2026-01-02", outcome: "drew" },
    { date: "2026-01-03", outcome: "won" },
  ]),
  [1, 1],
);

// An unscored game is skipped, not treated as a break: nobody filling a score
// in should not cut a winning run in half.
assert.deepEqual(
  winRuns([
    { date: "2026-01-01", outcome: "won" },
    { date: "2026-01-02", outcome: null },
    { date: "2026-01-03", outcome: "won" },
  ]),
  [2],
);

// Never won anything, so there are no runs rather than a run of zero.
assert.deepEqual(winRuns([{ date: "2026-01-01", outcome: "lost" }]), []);

console.log("member-form: win run assertions passed");
