import "server-only";

import type { AiFeature } from "@/utils/ai-access";
import type { AiDeployment } from "@/utils/ai-deployment";

/**
 * Which model answers which feature, and what it costs.
 *
 * Legacy runs `gpt-5.5` for most of it and `gpt-5-mini` for the list coach
 * (server.py:184-185), on the reasoning that the coach's evidence is already
 * deterministic and the model is writing it up. The same split holds here:
 * Sonnet everywhere, and the client can lift matchup to Opus per club.
 *
 * **The prices below must be confirmed against the provider's current pricing
 * before the monthly cap is trusted.** They drive `cost_pence`, which drives
 * the cap and the admin's spend view, and a wrong number there does not fail
 * loudly: it just stops a club too early or too late. `DEFERRED.md` carries
 * this.
 */

export const MODELS: Record<AiFeature, string> = {
  coach: process.env.AI_MODEL_COACH || "claude-sonnet-5",
  matchup: process.env.AI_MODEL_MATCHUP || "claude-sonnet-5",
  scouting: process.env.AI_MODEL_SCOUTING || "claude-sonnet-5",
  season: process.env.AI_MODEL_SEASON || "claude-sonnet-5",
};

export const MAX_TOKENS: Record<AiFeature, number> = {
  coach: 4200, matchup: 4200, scouting: 3600, season: 4200,
};

/** Off entirely, or off for one feature. Both are a deploy-level decision. */
export function featureEnabled(feature: AiFeature): boolean {
  if (String(process.env.AI_ENABLED ?? "").toLowerCase() === "false") return false;
  const only = String(process.env.AI_FEATURES ?? "").trim();
  if (!only) return true;
  return only.split(",").map((one) => one.trim()).includes(feature);
}

/**
 * Is there an account to call?
 *
 * Mirrors `provider()` in `run.ts`: the default is Anthropic and `stub` is a
 * real answer rather than an absence, so asking for it counts as configured.
 * The two have to agree, because this decides whether a screen draws a button
 * and that one decides whether the button works.
 */
export function providerKeyPresent(): boolean {
  const named = String(process.env.AI_PROVIDER ?? "").toLowerCase();
  if (named === "stub") return true;
  if (named === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * What a screen needs to know before it draws.
 *
 * `featureEnabled` and the key check used to be read only inside `runAi`,
 * which is after the press. So every screen offered a confident primary button
 * it already knew would fail, and the only place the site ever said why was a
 * warning that arrived once the job had been filed and had come back. The
 * client read that as the feature not being built, which is a fair reading of
 * what they were shown.
 */
export function deploymentState(feature: AiFeature): AiDeployment {
  if (!featureEnabled(feature)) return "off";
  return providerKeyPresent() ? "on" : "no_key";
}
