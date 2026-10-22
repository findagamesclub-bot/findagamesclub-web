import assert from "node:assert/strict";
import { armySummary } from "../army-snapshot";
import {
  armyLabel, detachmentLine, leadDetachment, readDetachments,
} from "../result-army";
import { readFieldDetachments } from "../result-form";

/**
 * Several detachments on a result, and one disposition for all of them.
 *
 * `npx tsx src/utils/__tests__/result-detachments.test.ts`
 */

// -------------------------------------------------- reading what is stored

// 0217's column.
assert.deepEqual(
  readDetachments({ detachments: ["Army of Faith", "Hallowed Martyrs"] }),
  ["Army of Faith", "Hallowed Martyrs"]);

// The column that came before it. Every army recorded before the migration
// has this and nothing else, so a reader that only knew the list would empty
// the lot.
assert.deepEqual(readDetachments({ detachment: "Shield Host" }), ["Shield Host"]);

// The list wins where both are there, which is what the writer guarantees.
assert.deepEqual(
  readDetachments({ detachment: "Shield Host", detachments: ["Shield Host", "Auric Champions"] }),
  ["Shield Host", "Auric Champions"]);

// Nothing said. Not [""], which would draw an empty detachment line.
assert.deepEqual(readDetachments({}), []);
assert.deepEqual(readDetachments({ detachment: "  " }), []);
assert.deepEqual(readDetachments({ detachments: ["", "  "] }), []);

// Trimmed, because a form field is a claim.
assert.deepEqual(readDetachments({ detachments: [" Shield Host "] }), ["Shield Host"]);

// The one the column holds and the Meta Tracker groups on.
assert.equal(leadDetachment(["Army of Faith", "Hallowed Martyrs"]), "Army of Faith");
assert.equal(leadDetachment([]), "");

// ------------------------------------------------------------- one line

// A comma inside the group, never a third dot: the dots divide the KINDS of
// fact, so "Faction · A · B · Take and Hold" reads as four things of one kind
// and a reader cannot tell the second detachment from the disposition.
assert.equal(
  armySummary({ factionLabel: "Adepta Sororitas",
                detachments: ["Army of Faith", "Hallowed Martyrs"],
                disposition: "Priority Assets" }),
  "Adepta Sororitas · Army of Faith, Hallowed Martyrs · Priority Assets");

// The same shape with one, which is every result recorded before 0217.
assert.equal(
  armySummary({ factionLabel: "Aeldari", detachment: "Armoured Warhost",
                disposition: "Reconnaissance" }),
  "Aeldari · Armoured Warhost · Reconnaissance");

// A faction and nothing else still reads as itself.
assert.equal(armySummary({ factionLabel: "Adeptus Custodes" }), "Adeptus Custodes");
assert.equal(armySummary(null), "");

// `armyLabel` is the booking's own line and `result_army_label` in SQL is the
// same rule. No disposition on this one: the column it writes never had one.
assert.equal(
  armyLabel({ factionLabel: "Orks", detachments: ["Green Tide", "War Horde"] }),
  "Orks · Green Tide, War Horde");
assert.equal(detachmentLine({ detachments: [] }), "");

// ------------------------------------------------- what a form posted

const form = (entries: Record<string, string>) => ({
  get: (name: string) => (name in entries ? entries[name] : null),
});

// The cascade posts JSON.
assert.deepEqual(
  readFieldDetachments(form({ detachments: '["Army of Faith","Hallowed Martyrs"]' })),
  ["Army of Faith", "Hallowed Martyrs"]);

// The plain box a club with no catalogue gets posts one string, and that is
// the same field name the dialog used before this change: a tab left open
// across a deploy still saves rather than losing the army.
assert.deepEqual(readFieldDetachments(form({ detachment: "Shield Host" })),
  ["Shield Host"]);

// Anything that is not a list of strings is nobody's typing, so it reads as
// none rather than refusing a result over a shape nobody chose.
assert.deepEqual(readFieldDetachments(form({ detachments: "not json" })), []);
assert.deepEqual(readFieldDetachments(form({ detachments: '{"a":1}' })), []);
assert.deepEqual(readFieldDetachments(form({ detachments: "[1,2]" })), []);
assert.deepEqual(readFieldDetachments(form({})), []);

// The list wins over the single box when both are posted, which is what the
// dialog does while a club has a catalogue.
assert.deepEqual(
  readFieldDetachments(form({ detachments: '["Auric Champions"]', detachment: "Shield Host" })),
  ["Auric Champions"]);

console.log("result detachments: all pass");
