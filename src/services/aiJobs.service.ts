import "server-only";

import * as repo from "@/repositories/aiJobs.repository";
import { runAi } from "@/lib/ai/run";
import { MODELS, deploymentState, providerName } from "@/lib/ai/models";
import { AiError } from "@/lib/ai/provider";
import { usageFor, type Usage } from "@/utils/ai-usage";
import { FEATURE_META, type AiFeature } from "@/utils/ai-access";
import type { AiJob } from "@/types/ai";

/**
 * Starting a run, and finishing it after the response has gone.
 *
 * The work is not awaited by the request. `start` inserts the row and returns
 * the id; `work` is handed to `after()` by the action, so the person can close
 * the tab and the answer is there when they come back. That is the case this
 * whole shape exists for.
 */

const toJob = (row: repo.JobRow): AiJob => ({
  id: row.id,
  feature: row.feature as AiFeature,
  status: row.status as AiJob["status"],
  result: row.result,
  provider: row.provider,
  model: row.model,
  costPence: Number(row.cost_pence) || 0,
  latencyMs: Number(row.latency_ms) || 0,
  errorCode: row.error_code,
  createdAt: row.created_at,
  finishedAt: row.finished_at,
  source: row.source,
});

/**
 * Whether this site can run a feature at all, for the screen that draws it.
 *
 * A plain read of two environment variables, so it costs nothing and is safe
 * to ask on every render. The page hands the answer down as a string, which is
 * what keeps `lib/ai` out of a client bundle.
 */
export function aiDeployment(feature: AiFeature) {
  return deploymentState(feature);
}

export async function getJob(id: number): Promise<AiJob | null> {
  const row = await repo.findJob(id).catch(() => null);
  return row ? toJob(row) : null;
}

export async function getLatest(
  club: number, profile: string, feature: AiFeature, signature: string,
): Promise<AiJob | null> {
  const row = await repo.findLatest(club, profile, feature, signature)
    .catch(() => null);
  return row ? toJob(row) : null;
}

/**
 * How many runs are left.
 *
 * The window is computed in SQL by `ai_usage_window` and the wording here by
 * `usageFor`, from the same numbers, so the button and the guard cannot
 * disagree about whether somebody may press it.
 */
/** What this person has already been told about this question. */
export async function getHistory(
  club: number, feature: AiFeature, signature: string,
): Promise<{ id: number; at: string; model: string }[]> {
  const rows = await repo.jobHistory(club, feature, signature).catch(() => []);
  return (rows ?? []).map((row) => ({
    id: Number(row.id),
    at: row.finished_at ?? row.created_at,
    model: row.model ?? "",
  }));
}

export async function getUsage(club: number, feature: AiFeature): Promise<Usage> {
  const rows = await repo.usageWindow(club, feature).catch(() => []);
  const row = rows?.[0];
  const limit = Number(row?.allowed ?? 0);
  const used = Number(row?.used ?? 0);
  const next = row?.next_available_at ?? null;

  // `usageFor` wants the runs themselves; SQL has already counted them, so
  // this hands it a stub of the right length with the boundary at the front.
  const at = Array.from({ length: used }, (_, i) =>
    i === limit - 1 && next
      ? new Date(new Date(next).getTime() - 24 * 3600_000).toISOString()
      : new Date().toISOString());

  return usageFor({
    at, limit,
    noun: FEATURE_META[feature].noun, one: FEATURE_META[feature].one,
    now: new Date(),
  });
}

export type StartResult =
  | { ok: true; jobId: number; cached: boolean }
  | { ok: false; error: string };

export async function start(params: {
  club: number; feature: AiFeature; signature: string;
  source: unknown; payload: unknown; force?: boolean;
}): Promise<StartResult> {
  try {
    const out = await repo.startJob({
      club: params.club, feature: params.feature, signature: params.signature,
      source: params.source, payload: params.payload, force: Boolean(params.force),
    });
    return { ok: true, jobId: out.jobId, cached: out.cached };
  } catch (error) {
    return { ok: false, error: startRefusal(error, params.feature) };
  }
}

/**
 * The run itself, after the response has gone.
 *
 * Every failure is written to the row rather than thrown away, because a
 * spinner that stops with nothing behind it is the worst outcome here. A
 * failure also costs nothing and counts for nothing, which 0147 enforces.
 */
export async function work(params: {
  job: number; feature: AiFeature; payload: unknown; knownUnits: string[];
}): Promise<unknown | null> {
  await repo.markRunning(params.job).catch(() => {});
  try {
    const out = await runAi({
      feature: params.feature, payload: params.payload, knownUnits: params.knownUnits,
    });
    await repo.finishJob({
      job: params.job,
      result: { ...(out.answer.json as object), droppedUnits: out.dropped },
      provider: out.answer.provider, model: out.answer.model,
      tokensIn: out.answer.tokensIn, tokensOut: out.answer.tokensOut,
      tokensCached: out.answer.tokensCached,
      costPence: out.costPence, latencyMs: out.answer.latencyMs, error: "",
    });
    return out.answer.json;
  } catch (error) {
    const kind = error instanceof AiError ? error.kind : "provider";
    // The kind tells the member whether pressing again is worth it. It cannot
    // tell anybody WHY, and item 6 is what that costs: "the coaching service
    // did not answer" fits a dead network, a bad key, no credit and a model
    // name the provider has never heard of, and the real one was the last of
    // those. The sentence is kept for the admin screen, and the model goes
    // with it, because a refusal is usually about the model that was asked
    // for rather than about the run.
    await repo.finishJob({
      job: params.job, result: null,
      provider: providerName(), model: MODELS[params.feature],
      tokensIn: 0, tokensOut: 0, tokensCached: 0,
      costPence: 0, latencyMs: 0, error: kind,
      detail: error instanceof Error ? error.message : String(error),
    }).catch(() => {});
    return null;
  }
}

function startRefusal(error: unknown, feature: AiFeature): string {
  const said = error instanceof Error ? error.message : String(error);
  if (said.includes("AI_IN_FLIGHT")) {
    return "One run is already going. Wait for it to finish.";
  }
  if (said.includes("AI_LIMIT")) {
    return `You have used your ${FEATURE_META[feature].noun} for now. The allowance returns one at a time.`;
  }
  if (said.includes("AI_CLUB_CAP")) {
    return "This club has reached its monthly AI budget. The club's owner can raise it.";
  }
  if (said.includes(`AI_TIER_${feature.toUpperCase()}`)) {
    return `Your current membership tier does not include ${FEATURE_META[feature].label}.`;
  }
  if (said.includes("ARMY_NOT_ENABLED")) {
    return "Army builder is not enabled for this club.";
  }
  if (said.includes("ARMY_NOT_MEMBER")) {
    return "Only approved club members can use the army builder.";
  }
  return "That did not start.";
}

/** File the plan a season run produced, retiring whatever that focus had. */
export async function fileSeasonPlan(params: {
  club: number; focusKey: string; focus: unknown; goal: string;
  plan: unknown; signature: string; matches: number;
}): Promise<void> {
  await repo.saveSeasonPlan(params).catch(() => {});
}

/** What every club has spent, for the admin. */
export async function getAdminUsage(months = 6) {
  const rows = await repo.adminUsage(months).catch(() => []);
  return (rows ?? []).map((row) => ({
    clubId: row.club_id,
    clubName: row.club_name,
    month: row.month,
    runs: Number(row.runs) || 0,
    failures: Number(row.failures) || 0,
    spendPence: Number(row.spend_pence) || 0,
  }));
}

/**
 * The runs that failed recently, for the admin.
 *
 * The detail is the point. Item 6 was a model name the provider had never
 * heard of, and for three rounds the only thing anybody could see was "the
 * coaching service did not answer" — which is also what a dead network, a bad
 * key and an empty account look like. One line here would have ended it.
 */
export async function getRecentFailures(limit = 20) {
  const rows = await repo.recentFailures(limit).catch(() => []);
  return (rows ?? []).map((row) => ({
    id: Number(row.id),
    feature: row.feature,
    provider: row.provider || "",
    model: row.model || "",
    code: row.error_code || "",
    detail: row.error_detail || "",
    at: row.created_at,
  }));
}

/** What one club has spent this month, against its cap. */
export async function getClubSpend(club: number) {
  const spent = await repo.monthSpend(club).catch(() => 0);
  return Number(spent) || 0;
}

/** What the club itself is shown: runs, not pounds. */
export async function getClubAiUsage(club: number): Promise<repo.ClubAiUsage> {
  return repo.clubUsage(club).catch(() => ({ runs: 0, members: 0, usedPercent: null }));
}
