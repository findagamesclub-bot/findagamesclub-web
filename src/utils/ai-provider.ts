import type { AiFeature } from "./ai-access";
import type { AiDeployment } from "./ai-deployment";

/**
 * Which provider is configured, which model it wants, and whether it can run.
 *
 * Pure, and in `utils` rather than `lib/ai`, for one reason: `lib/ai/models.ts`
 * is `server-only` and throws outside a server component, so the test that
 * covered this used to hand-copy the logic into itself. That copy is how item
 * 6 survived three rounds — the real code and the thing asserting about it
 * were two different readings of the same rule, and the one that was wrong was
 * not the one under test.
 *
 * Nothing here touches the network or imports a provider. `models.ts` re-exports
 * it so no caller has to know it moved.
 */

/**
 * The default model, per provider.
 *
 * This used to be one list of Anthropic ids whatever the provider was, which
 * is what item 6 actually was: `AI_PROVIDER=openai` moved the endpoint and
 * left the model alone, so production asked OpenAI's Responses API for
 * `claude-sonnet-5`, OpenAI refused it, and every screen said "The coaching
 * service did not answer" — a sentence that fits a dead network, a bad key and
 * no credit equally well. It worked on a developer machine throughout, because
 * `.env.local` sets all four `AI_MODEL_*` and a hosting dashboard did not.
 *
 * A provider and a model are not independent switches. Naming one names the
 * other, or the pair can be configured into a state that cannot work with
 * nothing on any screen or in any table saying so.
 *
 * OpenAI's split is legacy's own (server.py:184-185): the big model for the
 * analysis, the small one for the list coach, whose evidence is already worked
 * out in code and which is only writing it up.
 */
export const AI_DEFAULT_MODELS: Record<string, Record<AiFeature, string>> = {
  openai: {
    coach: "gpt-5-mini", matchup: "gpt-5.5",
    scouting: "gpt-5.5", season: "gpt-5.5",
  },
  anthropic: {
    coach: "claude-sonnet-5", matchup: "claude-sonnet-5",
    scouting: "claude-sonnet-5", season: "claude-sonnet-5",
  },
  // The test seam answers without calling anything, so this is only ever
  // written to the row. It names the seam, not a real model.
  stub: { coach: "stub", matchup: "stub", scouting: "stub", season: "stub" },
};

/**
 * The provider, by name.
 *
 * Trimmed as well as lower-cased. A value pasted into a hosting dashboard
 * picks up a trailing space more often than anyone expects, and without this
 * `AI_PROVIDER="openai "` falls through to the Anthropic branch and the site
 * says "not available on this site yet" with a perfectly good OpenAI key
 * sitting next to it. That was this item's second round.
 */
export function providerName(): "openai" | "anthropic" | "stub" {
  const named = String(process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (named === "stub") return "stub";
  if (named === "openai") return "openai";
  return "anthropic";
}

/** An explicit `AI_MODEL_*` still wins, for pinning a version or testing one. */
export function modelFor(feature: AiFeature, pinned?: string): string {
  const named = String(pinned ?? "").trim();
  if (named) return named;
  return AI_DEFAULT_MODELS[providerName()]![feature];
}

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
 * `stub` is a real answer rather than an absence, so asking for it counts as
 * configured. This decides whether a screen draws a button and `run.ts`
 * decides whether the button works; both read `providerName`, so they cannot
 * disagree about which provider is in play.
 */
export function providerKeyPresent(): boolean {
  const named = providerName();
  if (named === "stub") return true;
  if (named === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * What a screen needs to know before it draws.
 *
 * Read where the page renders rather than inside the run. Every screen used to
 * offer a confident primary button it already knew would fail, and the only
 * place the site said why was a warning that arrived once the job had been
 * filed and come back. The client read that as the feature not being built,
 * which is a fair reading of what they were shown.
 */
export function deploymentState(feature: AiFeature): AiDeployment {
  if (!featureEnabled(feature)) return "off";
  return providerKeyPresent() ? "on" : "no_key";
}
