import assert from "node:assert/strict";
import { canonicalPayload, wouldMakeVersion, type SignatureInput } from "../army-signature";
import { describeChange, diffUnits, type VersionShape } from "../army-diff";
import { armyBuilderBlockedReason } from "../army-access";
import { isLegends } from "../army-catalogue";

const base: SignatureInput = {
  editionId: "warhammer-40k-11th", catalogueVersion: "11th-test-2026-07-27",
  listType: "army-list", systemId: "warhammer-40k", pointsLimit: "2000",
  factionId: "adeptus-custodes",
  detachments: [{ detachment: "Shield Host", disposition: "Auric Champions" }],
  units: [{ unitName: "Castigator", optionLabel: "Default", quantity: 3 }],
};

// ------------------------------------------------------------- signature
{
  // Key order in the object must not reach the string, or reordering a field
  // in this file would silently make everybody's list a new version.
  const shuffled: SignatureInput = {
    units: base.units, factionId: base.factionId, detachments: base.detachments,
    pointsLimit: base.pointsLimit, systemId: base.systemId,
    listType: base.listType, catalogueVersion: base.catalogueVersion,
    editionId: base.editionId,
  };
  assert.equal(canonicalPayload(shuffled), canonicalPayload(base));
  // Pinned exactly, because the database hashes this same string and the two
  // can only be checked against each other if one of them is written down.
  assert.equal(canonicalPayload(base),
    '{"catalogueVersion":"11th-test-2026-07-27",'
    + '"detachmentSelections":[{"detachment":"shield host","disposition":"auric champions"}],'
    + '"editionId":"warhammer-40k-11th","factionId":"adeptus-custodes",'
    + '"listType":"army-list","pointsLimit":"2000","systemId":"warhammer-40k",'
    + '"units":[{"optionLabel":"default","quantity":3,"unitName":"castigator"}]}');
}
{
  // Case and padding are folded, so retyping a faction is not a new version.
  assert.equal(wouldMakeVersion({ ...base, factionId: " Adeptus-Custodes " }, base), false);
  assert.equal(wouldMakeVersion(
    { ...base, units: [{ unitName: "CASTIGATOR", optionLabel: "default", quantity: 3 }] },
    base), false);
}
{
  // The name is not in the input at all, which is the point: renaming saves in
  // place. Everything that IS in it moves the signature.
  assert.equal(wouldMakeVersion({ ...base, pointsLimit: "1500" }, base), true);
  assert.equal(wouldMakeVersion({ ...base, listType: "collection" }, base), true);
  assert.equal(wouldMakeVersion({ ...base, catalogueVersion: "11th-2" }, base), true);
  assert.equal(wouldMakeVersion(
    { ...base, units: [{ unitName: "Castigator", optionLabel: "Default", quantity: 2 }] },
    base), true);
  assert.equal(wouldMakeVersion(
    { ...base, detachments: [{ detachment: "Shield Host", disposition: "Lions of the Emperor" }] },
    base), true);
  // Order within the units array DOES count. Arrays are not re-sorted here on
  // purpose: `normaliseLines` has already sorted them, so two different orders
  // mean one of them did not come from it and is not to be trusted as equal.
  const pair = [base.units[0],
                { unitName: "Blade Champion", optionLabel: "Default", quantity: 1 }];
  assert.equal(wouldMakeVersion(
    { ...base, units: [...pair].reverse() }, { ...base, units: pair }), true);
}

// ---------------------------------------------------------------- the diff
const shape = (over: Partial<VersionShape> = {}): VersionShape => ({
  factionLabel: "Adeptus Custodes", detachment: "Shield Host",
  disposition: "Auric Champions", pointsLimit: "2000",
  units: [{ unitName: "Castigator", optionLabel: "Default", quantity: 3 }],
  ...over,
});

{
  assert.equal(describeChange(null, shape()), "Initial version");

  // A faction change returns alone, suppressing the three unit changes under it.
  assert.equal(describeChange(shape(), shape({
    factionLabel: "Aeldari", detachment: "Battle Host", units: [],
  })), "Changed faction to Aeldari");

  assert.equal(describeChange(shape(), shape()), "Edited list details");
}
{
  const one = { unitName: "Blade Champion", optionLabel: "Default", quantity: 1 };
  assert.equal(describeChange(shape(), shape({ units: [...shape().units, one] })),
    "Added Blade Champion");
  assert.equal(describeChange(shape({ units: [...shape().units, one] }), shape()),
    "Removed Blade Champion");
  assert.equal(describeChange(shape(), shape({
    units: [{ unitName: "Castigator", optionLabel: "Default", quantity: 2 }],
  })), "Adjusted Castigator");

  // More than one change collapses to a count, and the whole line caps at two
  // parts however much moved.
  const many = describeChange(shape(), shape({
    detachment: "Auric Champions", disposition: "Lions of the Emperor",
    pointsLimit: "1500", units: [one],
  }));
  assert.equal(many, "Detachment to Auric Champions · Disposition to Lions of the Emperor");
  assert.equal(many.split(" · ").length, 2);

  assert.equal(describeChange(shape(), shape({
    units: [one, { unitName: "Custodian Guard", optionLabel: "Default", quantity: 1 }],
  })), "Updated 3 unit entries");
}
{
  const d = diffUnits(shape(), shape({
    units: [{ unitName: "Castigator", optionLabel: "Default", quantity: 5 },
            { unitName: "Blade Champion", optionLabel: "Default", quantity: 1 }],
  }));
  assert.equal(d.added.length, 1);
  assert.equal(d.removed.length, 0);
  assert.deepEqual(d.adjusted.map((a) => [a.from, a.to]), [[3, 5]]);
}

// ------------------------------------------------------------ the ladder
{
  const open = { enabled: true, signedIn: true, canManageClub: false,
                 isApprovedMember: true, tierAllows: true };
  assert.equal(armyBuilderBlockedReason(open), null);

  // The order is the whole rule: a signed-out visitor at a club with it turned
  // off is told about the club, not about signing in.
  assert.equal(armyBuilderBlockedReason({ ...open, enabled: false, signedIn: false }),
    "Army builder is not enabled for this club.");
  assert.equal(armyBuilderBlockedReason({ ...open, signedIn: false }),
    "Sign in to access the army builder.");
  assert.equal(armyBuilderBlockedReason({ ...open, isApprovedMember: false }),
    "Only approved club members can use the army builder.");
  assert.equal(armyBuilderBlockedReason({ ...open, tierAllows: false }),
    "Your current membership tier does not include army builder access.");

  // A manager passes rung three, so neither membership nor tier is asked.
  assert.equal(armyBuilderBlockedReason({
    ...open, canManageClub: true, isApprovedMember: false, tierAllows: false }), null);
  // But not past rung one: a club that turned it off turned it off for its own team.
  assert.equal(armyBuilderBlockedReason({ ...open, canManageClub: true, enabled: false }),
    "Army builder is not enabled for this club.");
}

// ---------------------------------------------------------------- legends
{
  assert.equal(isLegends("Vindicator (Legends)"), true);
  assert.equal(isLegends("Vindicator (legends)"), true);
  assert.equal(isLegends("Castigator"), false);
  assert.equal(isLegends(""), false);
}

console.log("army-versions: all pass");
