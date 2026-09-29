"use client";

import { useQuery } from "@tanstack/react-query";
import type { AiJob } from "@/types/ai";

/**
 * Watch a run until it finishes.
 *
 * Backs off 1.5s to 4s, because the first ten seconds are when somebody is
 * actually looking and the last thirty are when they have gone to do something
 * else. Stops the moment the job lands either way, so a finished page is not
 * still asking.
 *
 * There is no timeout here on purpose. A job that never finishes is swept by
 * `sweep_ai_jobs` and comes back as failed, so the page learns from the same
 * place it learns everything else rather than deciding for itself.
 */
export function useAiJob(jobId: number | null) {
  return useQuery({
    queryKey: ["ai-job", jobId],
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const job = query.state.data as AiJob | undefined;
      if (!job || job.status === "succeeded" || job.status === "failed") return false;
      const age = Date.now() - new Date(job.createdAt).getTime();
      return age < 12_000 ? 1_500 : 4_000;
    },
    queryFn: async (): Promise<AiJob> => {
      const response = await fetch(`/api/ai/jobs/${jobId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not read that run.");
      return response.json() as Promise<AiJob>;
    },
  });
}
