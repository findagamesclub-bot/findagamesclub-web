import "server-only";

import { anthropic } from "./anthropic";
import { openai } from "./openai";
import { stub } from "./stub";
import { MAX_TOKENS, MODELS, featureEnabled } from "./models";
import { costPence } from "@/utils/ai-cost";
import { redact } from "@/utils/ai-redact";
import { SCHEMAS } from "./schemas";
import { SYSTEM, userPrompt } from "./prompts";
import { AiError, type AiAnswer, type Provider } from "./provider";
import { pruneUnknownUnits } from "@/utils/ai-prune";
import type { AiFeature } from "@/utils/ai-access";

/**
 * One run, end to end.
 *
 * Pick the provider, redact, call with a timeout, then **check the answer
 * again**. The schema is enforced by the provider and it is still not enough:
 * a model told in three sentences not to invent units invents units, and no
 * schema can tell a real datasheet from a plausible one. So every unit name it
 * suggests is checked against the catalogue the list was priced on, and the
 * ones that do not exist are dropped and counted. The card says how many went
 * rather than quietly showing a shorter list.
 */

const TIMEOUT_MS = 90_000;

function provider(): Provider {
  const named = String(process.env.AI_PROVIDER ?? "").toLowerCase();
  // `stub` is a test seam, not a fallback: it only runs when it is asked for
  // by name, so a missing or mistyped AI_PROVIDER never quietly serves fake
  // coaching to a real member.
  if (named === "stub") return stub;
  if (named === "openai") return openai;
  return anthropic;
}

export type RunResult = {
  answer: AiAnswer;
  costPence: number;
  /** Unit names the model named that the catalogue does not have. */
  dropped: string[];
};

export async function runAi(params: {
  feature: AiFeature;
  payload: unknown;
  /** Every unit name the faction actually has, for the cache block and the check. */
  knownUnits: string[];
  model?: string;
}): Promise<RunResult> {
  if (!featureEnabled(params.feature)) {
    throw new AiError("disabled", "That feature is switched off on this deployment.");
  }

  const model = params.model || MODELS[params.feature];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const answer = await provider().run({
      feature: params.feature,
      system: SYSTEM[params.feature],
      user: userPrompt(params.feature, redact(params.payload)),
      schema: SCHEMAS[params.feature] as unknown as Record<string, unknown>,
      maxTokens: MAX_TOKENS[params.feature],
      // The faction's unit list is most of the prompt and never changes
      // between runs for that faction, which is exactly what a cache block is
      // for. It is also the list the check below reads.
      cacheable: params.knownUnits.length
        ? `Units available to this faction:\n${params.knownUnits.join("\n")}`
        : undefined,
    }, model, controller.signal);

    const { json, dropped } = pruneUnknownUnits(answer.json, params.knownUnits);

    return {
      answer: { ...answer, json },
      costPence: costPence(model, {
        in: answer.tokensIn, out: answer.tokensOut, cached: answer.tokensCached,
      }),
      dropped,
    };
  } finally {
    clearTimeout(timer);
  }
}
