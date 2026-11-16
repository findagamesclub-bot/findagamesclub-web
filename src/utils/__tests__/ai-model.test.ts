import assert from "node:assert/strict";
import { modelFor, providerName } from "../ai-provider";

/**
 * A provider and a model are not two independent switches.
 *
 * This is item 6, which took three rounds. `AI_PROVIDER=openai` moved the
 * endpoint and left the model list on Anthropic ids, so production asked
 * OpenAI for `claude-sonnet-5` and every screen said "The coaching service did
 * not answer". It worked on a developer machine throughout, because
 * `.env.local` sets all four `AI_MODEL_*` and a hosting dashboard did not.
 *
 * Imported, not copied. The previous test of this area transcribed the rules
 * into itself, which is the reason a wrong rule could pass.
 */

const FEATURES = ["coach", "matchup", "scouting", "season"] as const;
const KEYS = ["AI_PROVIDER", "AI_MODEL_COACH", "AI_MODEL_MATCHUP",
              "AI_MODEL_SCOUTING", "AI_MODEL_SEASON"];
const held = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const reset = () => { for (const k of KEYS) delete process.env[k]; };

let failed = 0;
const check = (what: string, run: () => void) => {
  try { run(); console.log(`ok   ${what}`); }
  catch (error) { failed += 1; console.log(`FAIL ${what}\n     ${error}`); }
};

const model = (feature: (typeof FEATURES)[number]) =>
  modelFor(feature, process.env[`AI_MODEL_${feature.toUpperCase()}`]);

check("openai never asks for an Anthropic model", () => {
  reset();
  process.env.AI_PROVIDER = "openai";
  assert.equal(providerName(), "openai");
  for (const feature of FEATURES) {
    const name = model(feature);
    assert.ok(!/claude/i.test(name), `${feature} would ask OpenAI for "${name}"`);
    assert.ok(name.startsWith("gpt-"), `${feature} is "${name}", not a gpt id`);
  }
});

check("anthropic never asks for an OpenAI model", () => {
  reset();
  process.env.AI_PROVIDER = "anthropic";
  for (const feature of FEATURES) {
    const name = model(feature);
    assert.ok(!name.startsWith("gpt-"),
      `${feature} would ask Anthropic for "${name}"`);
  }
});

check("an unset provider is anthropic, exactly as before", () => {
  reset();
  assert.equal(providerName(), "anthropic");
  assert.match(model("matchup"), /claude/i);
});

check("a pasted trailing space still reads as openai", () => {
  reset();
  process.env.AI_PROVIDER = " OpenAI ";
  assert.equal(providerName(), "openai");
  assert.ok(model("matchup").startsWith("gpt-"));
});

check("an explicit AI_MODEL_* wins, and does not leak to the others", () => {
  reset();
  process.env.AI_PROVIDER = "openai";
  process.env.AI_MODEL_MATCHUP = "gpt-5-mini";
  assert.equal(model("matchup"), "gpt-5-mini");
  assert.equal(model("season"), "gpt-5.5");
});

check("the list coach gets the small model, the way legacy splits it", () => {
  reset();
  process.env.AI_PROVIDER = "openai";
  assert.equal(model("coach"), "gpt-5-mini");
  assert.notEqual(model("coach"), model("matchup"));
});

for (const [k, v] of Object.entries(held)) {
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nai-model: all pass");
