import "server-only";

import * as repo from "@/repositories/aiJobs.repository";
import { runAi } from "@/lib/ai/run";
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

  return usageFor({ at, limit, noun: FEATURE_META[feature].noun, now: new Date() });
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
    await repo.finishJob({
      job: params.job, result: null, provider: "", model: "",
      tokensIn: 0, tokensOut: 0, tokensCached: 0,
      costPence: 0, latencyMs: 0, error: kind,
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

/** What one club has spent this month, against its cap. */
export async function getClubSpend(club: number) {
  const spent = await repo.monthSpend(club).catch(() => 0);
  return Number(spent) || 0;
}
