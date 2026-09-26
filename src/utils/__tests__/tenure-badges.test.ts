import assert from "node:assert/strict";

import { tenureBadge, yearsSince } from "../tenure-badges";

{
  // Legacy's bands, unchanged (club_store.py:22992).
  assert.equal(tenureBadge("2015-06-01", "2026-06-01")?.label, "10+ years");
  assert.equal(tenureBadge("2021-06-01", "2026-06-01")?.label, "5 years");
  assert.equal(tenureBadge("2023-06-01", "2026-06-01")?.label, "3 years");
  assert.equal(tenureBadge("2024-06-01", "2026-06-01")?.label, "2 years");
  assert.equal(tenureBadge("2025-06-01", "2026-06-01")?.label, "1 year");
  assert.equal(tenureBadge("2026-01-01", "2026-06-01"), null, "under a year is no badge");
}

{
  // The anniversary is the day it turns over, not a day either side of it.
  assert.equal(yearsSince("2025-06-02", "2026-06-01"), 0, "one day short");
  assert.equal(yearsSince("2025-06-01", "2026-06-01"), 1, "on the day");
  assert.equal(yearsSince("2025-05-31", "2026-06-01"), 1, "a day past");
}

{
  // 365 days is wrong across a leap year, which is why this counts by
  // anniversary. 2024 is a leap year: 2024-03-01 to 2025-03-01 is 365 days
  // and is one year; 2023-03-01 to 2024-03-01 is 366 days and is also one.
  assert.equal(yearsSince("2023-03-01", "2024-03-01"), 1);
  assert.equal(yearsSince("2024-03-01", "2025-03-01"), 1);

  // And somebody who joined on 29 February is not a year older on the 28th.
  assert.equal(yearsSince("2024-02-29", "2025-02-28"), 0);
  assert.equal(yearsSince("2024-02-29", "2025-03-01"), 1);
}

{
  // A join date is a calendar date, so it is read with UTC getters. This file
  // runs under TZ=America/New_York precisely to catch a local-time read, which
  // would make somebody a year older a day early.
  assert.equal(yearsSince("2025-01-01", "2026-01-01"), 1);
  assert.equal(yearsSince("2025-01-01T00:00:00Z", "2026-01-01"), 1);
  assert.equal(yearsSince("2025-01-02", "2026-01-01"), 0);
}

{
  // Nothing to count is no badge, never a crash or a negative.
  assert.equal(yearsSince(null, "2026-06-01"), 0);
  assert.equal(yearsSince(undefined, "2026-06-01"), 0);
  assert.equal(yearsSince("", "2026-06-01"), 0);
  assert.equal(yearsSince("not a date", "2026-06-01"), 0);
  assert.equal(tenureBadge(null, "2026-06-01"), null);

  // A join date in the future is nought years, not minus one.
  assert.equal(yearsSince("2030-01-01", "2026-06-01"), 0);
  assert.equal(tenureBadge("2030-01-01", "2026-06-01"), null);
}

{
  // One band, never two, and the highest one somebody qualifies for.
  const badge = tenureBadge("2010-06-01", "2026-06-01");
  assert.equal(badge?.label, "10+ years");
  assert.equal(badge?.key, "tenure::10");
  // The key is stable per band, so it cannot collide with a competition badge.
  assert.ok(badge?.key.startsWith("tenure::"));
  assert.match(badge?.context ?? "", /Member since 2010/);
}

console.log("tenure-badges: all assertions passed");
