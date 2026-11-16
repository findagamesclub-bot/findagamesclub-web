import assert from "node:assert/strict";
import { deploymentState } from "../ai-provider";
import type { AiFeature } from "../ai-access";

// ------------------------------------------- which env turns coaching on
//
// The client has reported "Written coaching is not available on this site
// yet" three times, and each time the key WAS set. The cause is that the key
// alone does nothing: `providerKeyPresent` defaults to Anthropic, so without
// `AI_PROVIDER=openai` it checks a variable nobody set and answers no.
//
// This used to COPY those rules out of `src/lib/ai/models.ts`, because that
// file is `server-only` and throws outside a server component. The copy was
// the problem: a test that transcribes the rule it is checking agrees with
// whatever it transcribed, and item 6 went three rounds with a real fault
// sitting beside a passing test. The rules are pure and live in
// `utils/ai-provider.ts` now, so this imports them.

const state = (feature: string) => deploymentState(feature as AiFeature);

const KEYS = ["AI_PROVIDER", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
              "AI_ENABLED", "AI_FEATURES"];
function withEnv(env: Record<string, string>): string {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, env);
  return state("matchup");
}

// The reported fault: an OpenAI key on its own reads as no account at all.
assert.equal(withEnv({ OPENAI_API_KEY: "sk-test" }), "no_key");

// And the fix, which is the pair rather than either half.
assert.equal(withEnv({ AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" }), "on");
assert.equal(withEnv({ AI_PROVIDER: "openai" }), "no_key");

// Whitespace off a copy and paste must not undo it. Without the trim this
// one is "no_key" and looks exactly like the fault above.
assert.equal(withEnv({ AI_PROVIDER: " openai ", OPENAI_API_KEY: "sk-test" }), "on");
assert.equal(withEnv({ AI_PROVIDER: "OpenAI", OPENAI_API_KEY: "sk-test" }), "on");

// Anthropic stays the default, so its key alone is enough and needs no name.
assert.equal(withEnv({ ANTHROPIC_API_KEY: "sk-ant" }), "on");

// The walk-through seam, for a deploy with no account on either provider.
assert.equal(withEnv({ AI_PROVIDER: "stub" }), "on");

// And the two switches that turn it off on purpose, so "not available" has
// an innocent explanation that is not a missing key.
assert.equal(withEnv({ AI_PROVIDER: "stub", AI_ENABLED: "false" }), "off");
assert.equal(withEnv({ AI_PROVIDER: "stub", AI_FEATURES: "scout" }), "off");
assert.equal(withEnv({ AI_PROVIDER: "stub", AI_FEATURES: "scout, matchup" }), "on");

for (const key of KEYS) delete process.env[key];
console.log("ai-provider-gate: the key alone is not enough, and the pair is");
