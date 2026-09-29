import assert from "node:assert/strict";
import { normaliseLines, refusalFor } from "../army-list";
import type { PricedUnit } from "../army-pricing";

const castigator: PricedUnit = {
  name: "Castigator", basePoints: 165,
  options: [{ label: "Default", modelCount: 1, points: "165" },
            { label: "Twin autocannon", modelCount: 1, points: "165" }],
  copyCostRules: [{ fromCopy: 3, toCopy: null,
                    options: [{ label: "Default", modelCount: 1, points: "175" },
                              { label: "Twin autocannon", modelCount: 1, points: "175" }] }],
};
const guard: PricedUnit = {
  name: "Custodian Guard", basePoints: 160,
  options: [{ label: "Default", modelCount: 4, points: "160" }],
};
const units = [castigator, guard];

// ------------------------------------------------------------ the four jobs
{
  // Merged on name::option, and the escalation carries across the two lines.
  const out = normaliseLines(units, [
    { unitName: "Castigator", optionLabel: "Default", quantity: 2 },
    { unitName: "Castigator", optionLabel: "Default", quantity: 1 },
  ]);
  assert.equal(out.lines.length, 1);
  assert.equal(out.lines[0].quantity, 3);
  assert.equal(out.lines[0].linePoints, 505);
  // Copies no longer agree, so there is no per-unit price to show.
  assert.equal(out.lines[0].unitPoints, 0);
  assert.equal(out.total, 505);
}
{
  // Different options are different lines, and still one escalation.
  const out = normaliseLines(units, [
    { unitName: "Castigator", optionLabel: "Default", quantity: 2 },
    { unitName: "Castigator", optionLabel: "Twin autocannon", quantity: 1 },
  ]);
  assert.equal(out.lines.length, 2);
  assert.equal(out.total, 505);
  const twin = out.lines.find((l) => l.optionLabel === "Twin autocannon");
  assert.equal(twin?.linePoints, 175);
  // One copy, all copies agree with themselves, so a price can be shown.
  assert.equal(twin?.unitPoints, 175);
}
{
  // Dropped in silence, and named so a screen can say what went.
  const out = normaliseLines(units, [
    { unitName: "Not A Unit", quantity: 2 },
    { unitName: "Custodian Guard", quantity: 0 },
    { unitName: "Custodian Guard", quantity: -3 },
    { unitName: "Custodian Guard", quantity: 1 },
  ]);
  assert.equal(out.lines.length, 1);
  assert.equal(out.total, 160);
  assert.deepEqual(out.dropped, ["Not A Unit"]);
}
{
  // Sorted by name::option, not by the order they were added.
  const out = normaliseLines(units, [
    { unitName: "Custodian Guard", quantity: 1 },
    { unitName: "Castigator", quantity: 1 },
  ]);
  assert.deepEqual(out.lines.map((l) => l.unitName), ["Castigator", "Custodian Guard"]);
}
{
  // Model count rides along from the option that priced it.
  const out = normaliseLines(units, [{ unitName: "Custodian Guard", quantity: 1 }]);
  assert.equal(out.lines[0].optionModelCount, 4);
  // A name typed with different case or padding is the same unit.
  assert.equal(normaliseLines(units, [
    { unitName: "  castigator ", quantity: 2 },
    { unitName: "CASTIGATOR", quantity: 1 },
  ]).total, 505);
}

// ------------------------------------------------------- legacy's refusals
{
  const known = { factionIds: ["adeptus-custodes"], pointsOptions: ["2000"] };
  const full = normaliseLines(units, [{ unitName: "Castigator", quantity: 1 }]);
  const empty = normaliseLines(units, []);
  const base = {
    name: "League list", listType: "army-list" as const, pointsLimit: "2000",
    factionId: "adeptus-custodes",
    detachments: [{ detachment: "Shield Host", disposition: "Auric Champions" }],
  };

  assert.equal(refusalFor(base, known, full), null);
  assert.equal(refusalFor({ ...base, name: "  " }, known, full),
    "Army list name is required.");
  assert.equal(refusalFor({ ...base, pointsLimit: "1750" }, known, full),
    "Choose a valid points value.");
  assert.equal(refusalFor({ ...base, factionId: "orks" }, known, full),
    "Choose a valid army faction.");
  assert.equal(refusalFor({ ...base, detachments: [] }, known, full),
    "Choose at least one detachment.");
  assert.equal(refusalFor(base, known, empty),
    "Add at least one unit to the army list.");

  const over = normaliseLines(units, [{ unitName: "Castigator", quantity: 13 }]);
  assert.equal(refusalFor(base, known, over),
    "Selected units exceed the chosen points limit.");

  // A collection has no limit and no detachments, so neither can refuse it.
  const collection = { ...base, listType: "collection" as const,
                       pointsLimit: "", detachments: [] };
  assert.equal(refusalFor(collection, known, over), null);
}

console.log("army-list: all pass");
