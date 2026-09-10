import assert from "node:assert/strict";
import { byWeekday, changeOnLastMonth, countByMonth, runningTotal, tierMix } from "../club-pulse";

// Twelve buckets ending on the month today falls in, gaps included.
{
  const months = countByMonth([], "2026-09-10");
  assert.equal(months.length, 12);
  assert.equal(months[0]!.key, "2025-10");
  assert.equal(months[11]!.key, "2026-09");
  assert.equal(months.every((m) => m.value === 0), true);
}

// January carries the year, so a run that turns over is still readable.
{
  const months = countByMonth([], "2026-09-10");
  assert.equal(months.find((m) => m.key === "2026-01")!.label, "Jan 26");
  assert.equal(months.find((m) => m.key === "2026-02")!.label, "Feb");
}

// Dates land in their own month, and anything outside the run is ignored
// rather than piled onto the nearest edge.
{
  const months = countByMonth(
    ["2026-09-01", "2026-09-30", "2026-08-15", "2020-01-01", null, "", undefined],
    "2026-09-10",
  );
  assert.equal(months.find((m) => m.key === "2026-09")!.value, 2);
  assert.equal(months.find((m) => m.key === "2026-08")!.value, 1);
  assert.equal(months.reduce((n, m) => n + m.value, 0), 3);
}

// A short run is still a run.
assert.equal(countByMonth([], "2026-09-10", 3).length, 3);

// An unreadable date gives no buckets rather than twelve wrong ones.
assert.deepEqual(countByMonth([], "not-a-date"), []);

// Monday leads, nights nobody booked are dropped, busiest first.
{
  // 2026-09-10 is a Thursday, 2026-09-12 a Saturday.
  const nights = byWeekday(["2026-09-10", "2026-09-17", "2026-09-12", "junk", null]);
  assert.deepEqual(nights.map((n) => [n.label, n.value]),
    [["Thursday", 2], ["Saturday", 1]]);
  assert.equal(nights[0]!.short, "Thu");
}

// A Sunday is the last day of the week here, not the first.
assert.equal(byWeekday(["2026-09-13"])[0]!.label, "Sunday");

// The club's own tier order, kept whole so an empty tier still shows.
{
  const mix = tierMix(
    [{ tierKey: "basic" }, { tierKey: "basic" }, { tierKey: "premium" }],
    [{ tierKey: "basic", label: "Basic" }, { tierKey: "premium", label: "Premium" },
     { tierKey: "elite", label: "Elite" }],
  );
  assert.deepEqual(mix.map((s) => [s.label, s.value]),
    [["Basic", 2], ["Premium", 1], ["Elite", 0]]);
}

// Somebody left on a tier the club has since deleted is still a member.
{
  const mix = tierMix(
    [{ tierKey: "gone" }, { tierKey: null }],
    [{ tierKey: "basic", label: "Basic" }],
  );
  assert.deepEqual(mix.map((s) => [s.label, s.value]), [["Basic", 0], ["No tier", 2]]);
}

// This month against last, including the empty case.
{
  const months = countByMonth(["2026-09-01", "2026-08-01", "2026-08-02"], "2026-09-10");
  assert.deepEqual(changeOnLastMonth(months), { now: 1, before: 2, delta: -1 });
  assert.deepEqual(changeOnLastMonth([]), { now: 0, before: 0, delta: 0 });
}

// A running total carries forward, and starts from what was already there.
{
  const months = countByMonth(["2026-09-01", "2026-08-01", "2026-08-02"], "2026-09-10", 3);
  assert.deepEqual(runningTotal(months).map((m) => m.value), [0, 2, 3]);
  assert.deepEqual(runningTotal(months, 10).map((m) => m.value), [10, 12, 13]);
  // The labels come through untouched, so the axis still reads.
  assert.deepEqual(runningTotal(months).map((m) => m.key), months.map((m) => m.key));
}

console.log("club-pulse: all assertions passed");
