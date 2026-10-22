import assert from "node:assert/strict";
import {
  heldDisposition, mixedDispositions, oneDisposition, withDisposition,
} from "../army-disposition";
import { dispositionsForAll } from "../army-catalogue";

const row = (detachment: string, disposition = "") => ({ detachment, disposition });

// --- One disposition for the whole army ------------------------------------

// The builder asked for one per detachment, so a list with three detachments
// could carry three, which is not a thing the game allows.
assert.equal(oneDisposition([]), "");
assert.equal(oneDisposition([row("Army of Faith")]), "");
assert.equal(
  oneDisposition([row("Army of Faith", "Take and Hold")]), "Take and Hold");

// The first that carries one. Rows written together agree; a list saved
// before this change can disagree, and answering with the first beats
// answering with nothing on a list somebody is halfway through editing.
assert.equal(
  oneDisposition([row("A"), row("B", "Purge the Foe"), row("C", "Disruption")]),
  "Purge the Foe");

// Which is exactly the list that has to be noticed, so the step can say so.
assert.equal(mixedDispositions([row("A", "Take and Hold")]), false);
assert.equal(mixedDispositions([row("A", "Take and Hold"), row("B", "Take and Hold")]), false);
assert.equal(mixedDispositions([row("A", "Take and Hold"), row("B", "Disruption")]), true);
// A blank is not a second disposition, it is a row nobody has answered.
assert.equal(mixedDispositions([row("A", "Take and Hold"), row("B")]), false);
assert.equal(mixedDispositions([]), false);

// Writing it puts it on every row, including ones added after it was chosen.
assert.deepEqual(
  withDisposition([row("A", "Old"), row("B")], "Take and Hold"),
  [row("A", "Take and Hold"), row("B", "Take and Hold")]);
// And clearing it clears all of them, or a row keeps a disposition the army
// no longer has.
assert.deepEqual(withDisposition([row("A", "Take and Hold")], ""), [row("A")]);

// --- What the detachments offer between them -------------------------------

const catalogue = {
  editionId: "warhammer-40k-11th",
  catalogueVersion: "test",
  systems: [{
    id: "40k", label: "Warhammer 40,000", pointsOptions: ["2000"],
    factions: [{
      id: "sororitas", label: "Adepta Sororitas",
      detachmentOptions: [
        { id: "faith", label: "Army of Faith",
          dispositions: ["Take and Hold", "Purge the Foe"] },
        { id: "champions", label: "Champions of Faith",
          dispositions: ["Purge the Foe", "Disruption"] },
        { id: "lone", label: "Lone Wolf", dispositions: [] },
      ],
      units: [],
    }],
  }],
} as Parameters<typeof dispositionsForAll>[0];

// A union, not an intersection: a disposition one of the chosen detachments
// can play is one the army can play. An intersection would hide a legal
// choice the moment somebody added a second detachment.
assert.deepEqual(
  dispositionsForAll(catalogue, "sororitas", ["Army of Faith", "Champions of Faith"]),
  ["Take and Hold", "Purge the Foe", "Disruption"]);

// Deduplicated on the fold, because the same disposition under two
// detachments is one option in one dropdown.
assert.equal(
  dispositionsForAll(catalogue, "sororitas",
    ["Army of Faith", "Champions of Faith"]).filter((x) => x === "Purge the Foe").length,
  1);

// Nothing chosen offers nothing, which is what keeps the step from showing an
// empty dropdown over an army with no detachments in it.
assert.deepEqual(dispositionsForAll(catalogue, "sororitas", []), []);
// And a detachment the catalogue records none for contributes none.
assert.deepEqual(dispositionsForAll(catalogue, "sororitas", ["Lone Wolf"]), []);

// --- Keeping a choice the detachments still offer ---------------------------

const offered = ["Take and Hold", "Purge the Foe"];

assert.equal(heldDisposition("Take and Hold", offered), "Take and Hold");
// Matched on the fold, so a value typed with other capitals resolves to the
// spelling the dropdown carries rather than reading as missing.
assert.equal(heldDisposition("take and hold", offered), "Take and Hold");

// Dropping a detachment can take the only one that offered the chosen
// disposition with it. Empty rather than wrong: a list pointing at something
// nothing offers is one the picker cannot show and the database refuses.
assert.equal(heldDisposition("Disruption", offered), "");
assert.equal(heldDisposition("Take and Hold", []), "");
assert.equal(heldDisposition("", offered), "");

console.log("army-disposition: all pass");
