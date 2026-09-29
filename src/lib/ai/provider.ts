import "server-only";

import type { AiFeature } from "@/utils/ai-access";
import type { AiErrorKind } from "@/utils/ai-errors";

export type { AiErrorKind };

/**
 * What a provider has to do, and nothing else.
 *
 * Two implementations behind it, both over `fetch`. No SDK: the call is one
 * POST with a JSON schema on it, and a dependency that has to be kept current
 * in two places is a dependency that will not be.
 */

export type AiRequest = {
  feature: AiFeature;
  /** Ends with the two rules every legacy prompt ends with. See `prompts.ts`. */
  system: string;
  user: string;
  /** The shape the answer has to take. Enforced by the provider, checked again after. */
  schema: Record<string, unknown>;
  maxTokens: number;
  /** Cached by the provider between calls. The faction's unit names go here. */
  cacheable?: string;
};

export type AiAnswer = {
  json: unknown;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  latencyMs: number;
};

/** A failure the screen can say something useful about. */
export class AiError extends Error {
  readonly kind: AiErrorKind;
  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
  }
}

export type Provider = {
  name: string;
  run(request: AiRequest, model: string, signal: AbortSignal): Promise<AiAnswer>;
};
