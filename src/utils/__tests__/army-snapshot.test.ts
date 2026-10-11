import assert from "node:assert/strict";
import { armySummary, listFromSnapshot, unitsFromSnapshot } from "../army-snapshot";

// A snapshot as 0145 writes one: units, totalPoints, catalogueVersion.
const snapshot = {
  totalPoints: 1985,
  catalogueVersion: "11th-test-2026-07-27",
  units: [
    { unitName: "Castigator", quantity: 1, unitPoints: 175, linePoints: 175 },
    { unitName: "Battle Sisters Squad", quantity: 3, unitPoints: 105, linePoints: 315 },
    { unitName: "Canoness", quantity: 1, unitPoints: 50 },
  ],
};

const units = unitsFromSnapshot(snapshot);
assert.equal(units.length, 3);

// The line total, not the unit price. Three squads at 105 cost 315, and a
// reader checking a list against its limit is checking the line.
assert.deepEqual(units[1], { name: "Battle Sisters Squad", quantity: 3, points: 315 });

// No linePoints on an older snapshot, so the unit price stands in.
assert.deepEqual(units[2], { name: "Canoness", quantity: 1, points: 50 });

// Anything that is not a snapshot is no units, never a throw: this runs on a
// public page over a jsonb column nothing validates on the way out.
for (const bad of [null, undefined, {}, [], "units", 7, { units: "nope" }]) {
  assert.deepEqual(unitsFromSnapshot(bad), [], `unitsFromSnapshot(${JSON.stringify(bad)})`);
}

// A unit with no name is dropped rather than drawn as a blank row.
assert.deepEqual(unitsFromSnapshot({ units: [{ unitName: "", unitPoints: 10 }] }), []);

const list = listFromSnapshot(snapshot, { id: 12, name: "Autumn League List" });
assert.ok(list);
assert.equal(list.id, 12);
assert.equal(list.name, "Autumn League List");
assert.equal(list.totalPoints, 1985);
assert.equal(list.units.length, 3);

// 0145 clears a link by writing `{}`. A heading over no units reads as a list
// that would not load, so there is no list at all.
assert.equal(listFromSnapshot({}, { id: null, name: "" }), null);
assert.equal(listFromSnapshot(null, { id: null, name: "Named but empty" }), null);

// An empty name is null rather than "", so a caller can fall back without
// having to know that "" and absent mean the same thing here.
const unnamed = listFromSnapshot(snapshot, { id: null, name: "" });
assert.ok(unnamed);
assert.equal(unnamed.name, null);

// pointsLimit rides along where a snapshot carries one, and is absent on the
// shape 0145 writes for a draw.
assert.equal(unnamed.pointsLimit, null);
assert.equal(
  listFromSnapshot({ ...snapshot, pointsLimit: "2000" }, { id: 1, name: "x" })!.pointsLimit,
  "2000",
);

// The one-line reading, in the order a player says it.
assert.equal(
  armySummary({ factionLabel: "Chaos Knights", detachment: "Traitoris Lance",
                disposition: "Purge the Foe" }),
  "Chaos Knights · Traitoris Lance · Purge the Foe",
);

// A faction on its own is the common case at a club that records only that.
assert.equal(armySummary({ factionLabel: "Adeptus Custodes" }), "Adeptus Custodes");

// A gap in the middle closes up rather than leaving a stray separator, which
// is what a naive join produces and what a reader sees as a missing word.
assert.equal(
  armySummary({ factionLabel: "Aeldari", detachment: "", disposition: "Priority Assets" }),
  "Aeldari · Priority Assets",
);

// Nothing recorded is an empty string, so a caller can test it directly
// rather than rendering a line made of separators.
assert.equal(armySummary(null), "");
assert.equal(armySummary(undefined), "");
assert.equal(armySummary({}), "");
assert.equal(armySummary({ factionLabel: "   " }), "");

console.log("army-snapshot: all pass");
