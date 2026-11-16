import "server-only";

import { callRpc, table } from "@/lib/supabase/table";
import { createAdminClient } from "@/lib/supabase/admin";

export type JobRow = {
  id: number;
  club_id: number;
  profile_id: string;
  feature: string;
  status: string;
  source_signature: string;
  source: unknown;
  result: unknown;
  provider: string;
  model: string;
  cost_pence: number;
  latency_ms: number;
  error_code: string;
  created_at: string;
  finished_at: string | null;
};

const COLUMNS =
  "id, club_id, profile_id, feature, status, source_signature, source, result,"
  + " provider, model, cost_pence, latency_ms, error_code, created_at, finished_at";

export async function findJob(id: number): Promise<JobRow | null> {
  const row = await (await table<JobRow>("army_ai_jobs"))
    .select(COLUMNS).eq("id", id).maybeSingle();
  return row.data ?? null;
}

/**
 * The newest succeeded run of this exact question.
 *
 * The signature is not optional. Without it a page asking for "the last coach
 * run" gets the last one for ANY list, so opening list B would show list A's
 * report with A's name in the header. The signature is what makes a stored
 * answer belong to the thing being looked at.
 */
export async function findLatest(
  club: number, profile: string, feature: string, signature: string,
): Promise<JobRow | null> {
  if (!signature) return null;
  const rows = await (await table<JobRow>("army_ai_jobs"))
    .select(COLUMNS)
    .eq("club_id", club).eq("profile_id", profile)
    .eq("feature", feature).eq("status", "succeeded")
    .eq("source_signature", signature)
    .order("created_at", { ascending: false }).limit(1);
  return rows.data?.[0] ?? null;
}

export const usageWindow = (club: number, feature: string) =>
  callRpc<{ used: number; allowed: number; remaining: number | null;
            next_available_at: string | null }[]>(
    "ai_usage_window", { p_club: club, p_feature: feature });

export const adminUsage = (months: number) =>
  callRpc<{ club_id: number; club_name: string; month: string;
            runs: number; failures: number; spend_pence: number }[]>(
    "admin_ai_usage", { p_months: months });

export const monthSpend = (club: number) =>
  callRpc<number>("ai_month_spend", { p_club: club });

export type ClubAiUsage = {
  runs: number;
  members: number;
  /** Null when the site has set this club no cap. */
  usedPercent: number | null;
};

/**
 * What a club has used this month, with no money in it.
 *
 * The cost is ours: one API key, set and watched by a site admin, and a club
 * owner is not billed for it. `admin_ai_usage` is where the pounds belong.
 */
export const clubUsage = (club: number) =>
  callRpc<ClubAiUsage>("club_ai_usage", { p_club: club });

export const startJob = (params: {
  club: number; feature: string; signature: string;
  source: unknown; payload: unknown; force: boolean;
}) => callRpc<{ jobId: number; cached: boolean; status: string }>("start_ai_job", {
  p_club: params.club, p_feature: params.feature, p_signature: params.signature,
  p_source: params.source, p_payload: params.payload, p_force: params.force,
});

/**
 * Every answer this person has had to this question, newest first (0236).
 *
 * The cache answers "has this exact question already been asked"; this answers
 * "what did it say last month", which the client asked for twice and which no
 * screen could reach.
 */
/**
 * The runs that failed recently, with what the provider actually said (0236).
 *
 * Through its own definer function: it crosses every club and every member,
 * so `is_admin()` is the guard, and `error_detail` is not in the generated
 * types, which `check:columns` is right to refuse in a select.
 */
export type FailureRow = {
  id: number; feature: string; provider: string; model: string;
  error_code: string; error_detail: string; created_at: string;
};

export const recentFailures = (limit = 20) =>
  callRpc<FailureRow[]>("admin_ai_failures", { p_limit: limit });

export const jobHistory = (
  club: number, feature: string, signature: string,
) => callRpc<{
  id: number; created_at: string; finished_at: string | null; model: string;
}[]>("ai_job_history", {
  p_club: club, p_feature: feature, p_signature: signature,
});

export const saveSeasonPlan = (params: {
  club: number; focusKey: string; focus: unknown; goal: string;
  plan: unknown; signature: string; matches: number;
}) => callRpc<number>("save_season_plan", {
  p_club: params.club, p_focus_key: params.focusKey, p_focus: params.focus,
  p_goal: params.goal, p_plan: params.plan,
  p_signature: params.signature, p_matches: params.matches,
});

/**
 * Writing a result is the server's, not the member's.
 *
 * `mark_ai_job_running` and `finish_ai_job` are granted to nobody: a member
 * who could write a result could write themselves a free one, or a cheap one.
 * Both go through the service role, which is why they live behind this and not
 * behind `callRpc`.
 */
async function asService(name: string, args: Record<string, unknown>) {
  const supabase = createAdminClient() as unknown as {
    rpc(n: string, a: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  };
  const { error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
}

export const markRunning = (job: number) =>
  asService("mark_ai_job_running", { p_job: job });

/**
 * Write the answer, or the failure.
 *
 * Tries the 0236 signature and falls back to the one before it.
 *
 * `p_detail` is a new argument, which in Postgres makes a NEW function, so a
 * database that has not had 0236 yet refuses the call outright — and this is
 * the one write in the whole AI path whose failure is invisible: `work()`
 * swallows it, the row stays `running`, the member watches a spinner that
 * will never resolve, and the one-in-flight index then refuses them a second
 * go for five minutes. It happened on the first run after the change, here,
 * and prod and dev share one database so a deploy that lands before the
 * migration would do it to every club at once.
 *
 * The fallback costs one extra round trip on exactly one deployment and makes
 * the order of the two irreversible-ish steps stop mattering.
 */
export async function finishJob(params: {
  job: number; result: unknown; provider: string; model: string;
  tokensIn: number; tokensOut: number; tokensCached: number;
  costPence: number; latencyMs: number; error: string;
  /** What the provider actually said (0236). Admin-only, never the member. */
  detail?: string;
}) {
  const base = {
    p_job: params.job, p_result: params.result, p_provider: params.provider,
    p_model: params.model, p_tokens_in: params.tokensIn,
    p_tokens_out: params.tokensOut, p_tokens_cached: params.tokensCached,
    p_cost_pence: params.costPence, p_latency_ms: params.latencyMs,
    p_error: params.error,
  };

  try {
    await asService("finish_ai_job", { ...base, p_detail: params.detail ?? "" });
  } catch (error) {
    const said = error instanceof Error ? error.message : String(error);
    // Only the "no such function" shape. Anything else is a real failure and
    // retrying it without the detail would hide it, which is the whole fault
    // this migration exists to stop.
    const missing = said.includes("Could not find the function")
      || said.includes("PGRST202")
      || said.includes("does not exist");
    if (!missing) throw error;
    await asService("finish_ai_job", base);
  }
}
