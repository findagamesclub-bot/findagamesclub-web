import assert from "node:assert/strict";
import { namedUnits, pruneUnknownUnits } from "../ai-prune";

/**
 * The client's item 7: a list coach that worked, gave good feedback, and then
 * announced that three suggestions "named units this catalogue does not
 * have" — naming units that were all in it. Every one of them was a CHOICE
 * between real units, and the whole string was being matched as if it were
 * one unit name.
 */

const CATALOGUE = [
  "Mortifiers", "Paragon Warsuits", "Immolator", "Penitent Engines",
  "Dialogus", "Ministorum Priest", "Imagifier", "Castigator",
  // One real unit whose own name carries a slash, so the split can never be
  // the first thing tried.
  "Sisters Repentia / Arco-flagellants",
];

const run = (names: string[]) => pruneUnknownUnits(
  { unitChangeSuggestions: names.map((unitName) => ({ unitName })) },
  CATALOGUE,
);

const kept = (out: ReturnType<typeof run>) =>
  (out.json as { unitChangeSuggestions: { unitName: string }[] })
    .unitChangeSuggestions.map((one) => one.unitName);

let failed = 0;
const check = (what: string, go: () => void) => {
  try { go(); console.log(`ok   ${what}`); }
  catch (error) { failed += 1; console.log(`FAIL ${what}\n     ${error}`); }
};

check("a choice between real units is kept", () => {
  const out = run([
    "Mortifiers / Paragon Warsuits / Immolator (choose based on availability)",
    "Mortifiers / Penitent Engines",
    "Dialogus / Ministorum Priest / Imagifier",
  ]);
  assert.deepEqual(out.dropped, [], "nothing should have been left out");
  assert.equal(kept(out).length, 3);
});

check("a plain unit still matches, capitals or not", () => {
  const out = run(["castigator", "Immolator"]);
  assert.deepEqual(out.dropped, []);
});

check("an invented unit is still dropped", () => {
  const out = run(["Castigator", "Battle Sister Megatank"]);
  assert.deepEqual(out.dropped, ["Battle Sister Megatank"]);
  assert.deepEqual(kept(out), ["Castigator"]);
});

check("a choice is dropped when any one of them is invented", () => {
  // Two real and one not. Keeping it would put a made-up datasheet in front
  // of somebody, which is the whole reason this check exists.
  const out = run(["Mortifiers / Imagifier / Battle Sister Megatank"]);
  assert.equal(out.dropped.length, 1);
  assert.equal(kept(out).length, 0);
});

check("a unit whose own name has a slash matches before any split", () => {
  const out = run(["Sisters Repentia / Arco-flagellants"]);
  assert.deepEqual(out.dropped, []);
  assert.deepEqual(
    namedUnits("Sisters Repentia / Arco-flagellants",
      new Set(CATALOGUE.map((one) => one.toLowerCase()))),
    ["Sisters Repentia / Arco-flagellants"]);
});

check("an aside in brackets is not part of the name", () => {
  const out = run(["Immolator (choose based on availability)"]);
  assert.deepEqual(out.dropped, []);
});

check("an empty name is left alone rather than dropped", () => {
  const out = run([""]);
  assert.deepEqual(out.dropped, []);
  assert.equal(kept(out).length, 1);
});

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nai-prune: all pass");
