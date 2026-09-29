import assert from "node:assert/strict";
import {
  readLens, lensWindow, previousWindow, lensLabel, DEFAULT_LENS,
} from "../meta-lens";
import {
  isEarlySignal, winRate, byStrength, EARLY_SIGNAL_BELOW,
} from "../meta-signal";

// ------------------------------------------------------------- the lens
{
  assert.equal(readLens("30d"), "30d");
  assert.equal(readLens("all"), "all");
  // Anything else is the default, so a hand-typed URL cannot break the page.
  assert.equal(readLens("last tuesday"), DEFAULT_LENS);
  assert.equal(readLens(undefined), DEFAULT_LENS);
  assert.equal(readLens(42), DEFAULT_LENS);
  assert.equal(lensLabel("3m"), "Last 3 months");
}

{
  const today = "2026-09-27";
  assert.deepEqual(lensWindow("30d", today), { from: "2026-08-28", to: today });
  assert.deepEqual(lensWindow("3m", today), { from: "2026-06-27", to: today });
  assert.deepEqual(lensWindow("6m", today), { from: "2026-03-27", to: today });
  assert.deepEqual(lensWindow("12m", today), { from: "2025-09-27", to: today });
  // All time is two nulls, not a very wide window.
  assert.deepEqual(lensWindow("all", today), { from: null, to: null });
}

{
  // Month arithmetic across a year boundary, and across a short month.
  assert.deepEqual(lensWindow("3m", "2026-01-15"), { from: "2025-10-15", to: "2026-01-15" });
  // 29 February has no anniversary. The window clamps to the last day that
  // exists rather than rolling forward into March, which would make "last 12
  // months" a day short and drop games out of it.
  assert.equal(lensWindow("12m", "2024-02-29").from, "2023-02-28");
  assert.equal(lensWindow("3m", "2026-05-31").from, "2026-02-28");
  assert.equal(lensWindow("6m", "2026-08-31").from, "2026-02-28");
}

{
  // The window before this one ends the day this one starts.
  const today = "2026-09-27";
  const now = lensWindow("30d", today);
  const before = previousWindow("30d", today);
  assert.equal(before.to, "2026-08-27");
  assert.equal(before.from, "2026-07-28");
  assert.ok(before.to! < now.from!, "the two windows overlap");

  assert.deepEqual(previousWindow("all", today), { from: null, to: null });
}

// ---------------------------------------------------------- the signal
{
  assert.equal(EARLY_SIGNAL_BELOW, 2);
  assert.equal(isEarlySignal(0), true);
  assert.equal(isEarlySignal(1), true);
  assert.equal(isEarlySignal(2), false);
  assert.equal(isEarlySignal(40), false);
}

{
  // Null, not zero: a faction nobody has scored with has no win rate, and 0%
  // reads as "it always loses".
  assert.equal(winRate(0, 0), null);
  assert.equal(winRate(4, 1), 25);
  assert.equal(winRate(3, 1), 33.3);
  assert.equal(winRate(3, 3), 100);
}

{
  const rows = [
    { label: "Aeldari", games: 9, winRate: 40 },
    { label: "Death Guard", games: 4, winRate: 75 },
    { label: "Orks", games: 9, winRate: 40 },
    { label: "Necrons", games: 2, winRate: null },
  ];
  assert.deepEqual(byStrength(rows).map((r) => r.label),
    ["Death Guard", "Aeldari", "Orks", "Necrons"]);
}

console.log("meta-lens: all pass");
