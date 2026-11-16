import "server-only";

import type { AiFeature } from "@/utils/ai-access";

/**
 * Which model answers which feature, and how much of it it may write.
 *
 * The provider, the defaults and the two switches moved to
 * `utils/ai-provider.ts` and are re-exported here so no caller had to change.
 * They are pure, and they are in `utils` because this file is `server-only`
 * and the test covering them had to hand-copy the rules into itself — which
 * is how item 6 survived three rounds.
 *
 * **The prices in `utils/ai-cost.ts` must be confirmed against the provider's
 * current pricing before the monthly cap is trusted.** They drive
 * `cost_pence`, which drives the cap and the admin's spend view, and a wrong
 * number there does not fail loudly: it just stops a club too early or too
 * late. `DEFERRED.md` carries this.
 */

export {
  AI_DEFAULT_MODELS, deploymentState, featureEnabled, modelFor,
  providerKeyPresent, providerName,
} from "@/utils/ai-provider";

import { modelFor } from "@/utils/ai-provider";

/**
 * Which model answers which feature.
 *
 * Getters, because the environment is read at call time: a module-level
 * constant would freeze whatever was set when the module first loaded, which
 * is not the same thing in a server component as in a test.
 */
export const MODELS: Record<AiFeature, string> = {
  get coach() { return modelFor("coach", process.env.AI_MODEL_COACH); },
  get matchup() { return modelFor("matchup", process.env.AI_MODEL_MATCHUP); },
  get scouting() { return modelFor("scouting", process.env.AI_MODEL_SCOUTING); },
  get season() { return modelFor("season", process.env.AI_MODEL_SEASON); },
};

export const MAX_TOKENS: Record<AiFeature, number> = {
  coach: 4200, matchup: 4200, scouting: 3600, season: 4200,
};
