import assert from "node:assert/strict";
import { trendRows, trendNote, STEADY_WITHIN } from "../meta-trend";

const now = [
  { factionId: "a", label: "Aeldari", winRate: 70, games: 10 },
  { factionId: "b", label: "Blood Angels", winRate: 30, games: 10 },
  { factionId: "c", label: "Chaos Daemons", winRate: 51, games: 10 },
  { factionId: "d", label: "Death Guard", winRate: 60, games: 1 },
];
const before = [
  { factionId: "a", label: "Aeldari", winRate: 40, games: 8 },
  { factionId: "b", label: "Blood Angels", winRate: 65, games: 8 },
  { factionId: "c", label: "Chaos Daemons", winRate: 50, games: 8 },
];

{
  const rows = trendRows(now, before);

  const aeldari = rows.find((r) => r.factionId === "a")!;
  assert.equal(aeldari.direction, "rising");
  assert.equal(aeldari.delta, 30);

  const blood = rows.find((r) => r.factionId === "b")!;
  assert.equal(blood.direction, "falling");
  assert.equal(blood.delta, -35);

  // One point is noise, not a direction. Two games can swing fifty.
  const chaos = rows.find((r) => r.factionId === "c")!;
  assert.equal(chaos.direction, "steady");
  assert.equal(chaos.delta, 1);
  assert.ok(STEADY_WITHIN > 1);

  // Nothing before it is new, not a rise from nought: saying it climbed from
  // 0% invents a past it never had.
  const death = rows.find((r) => r.factionId === "d")!;
  assert.equal(death.direction, "new");
  assert.equal(death.delta, null);
  assert.equal(death.earlySignal, true, "one game is still an early signal");
}

{
  // Biggest movers first, in either direction, then the ones that held still.
  const rows = trendRows(now, before);
  assert.deepEqual(rows.slice(0, 2).map((r) => r.factionId), ["b", "a"]);
  assert.ok(rows.slice(2).every((r) => r.direction === "steady" || r.direction === "new"));
}

{
  // A faction with no rate cannot move.
  const rows = trendRows(
    [{ factionId: "x", label: "X", winRate: null, games: 0 }],
    [{ factionId: "x", label: "X", winRate: 50, games: 4 }]);
  assert.equal(rows[0]!.direction, "new");
}

{
  const rows = trendRows(now, before);
  const said = rows.map((r) => trendNote(r, "Last 3 months"));
  assert.ok(said.some((s) => s === "Up 30.0 points on the window before"));
  assert.ok(said.some((s) => s === "Down 35.0 points on the window before"));
  assert.ok(said.some((s) => s.startsWith("Holding, within")));
  assert.ok(said.some((s) => s === "First seen in last 3 months"));
  // No em dashes in anything a member reads.
  assert.ok(said.every((s) => !s.includes("—")));
}

console.log("meta-trend: all pass");
