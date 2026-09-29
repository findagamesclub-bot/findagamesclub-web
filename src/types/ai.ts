import type { AiFeature } from "@/utils/ai-access";

/** One AI run, as a screen reads it. */
export type AiJob = {
  id: number;
  feature: AiFeature;
  status: "queued" | "running" | "succeeded" | "failed";
  result: unknown;
  provider: string;
  model: string;
  costPence: number;
  latencyMs: number;
  errorCode: string;
  createdAt: string;
  finishedAt: string | null;
  source: unknown;
};
