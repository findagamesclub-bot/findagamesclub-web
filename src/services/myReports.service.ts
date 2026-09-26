import "server-only";

import * as repo from "@/repositories/moderation.repository";
import {
  NOTHING_REPORTED, reportedKeys, reportStatusForSql, reportTabs,
} from "@/utils/reported-set";
import { isModerationTarget } from "@/utils/moderation-targets";

export type { MyReportRow } from "@/repositories/moderation.repository";
export type { ReportedKeys } from "@/utils/reported-set";
export type Result = { ok: true; notice: string } | { ok: false; error: string };

/**
 * A report from the side of the person who made it.
 *
 * Its own file rather than more of `moderation.service`, because they are two
 * audiences rather than two halves of one job: that one is an admin's worklist
 * over everybody's reports, this is one person asking what happened to theirs.
 * It also took that file past the 200-line rule.
 */

const REFUSALS: Record<string, string> = {
  NOT_PERMITTED: "Sign in to see what you have reported.",
  FLAG_NOT_FOUND: "That one has already been answered, so it cannot be taken back.",
};

function explain(error: unknown, fallback: string): string {
  const said = error instanceof Error ? error.message : String(error);
  for (const [key, line] of Object.entries(REFUSALS)) {
    if (said.includes(key)) return line;
  }
  return fallback;
}

const MY_PER_PAGE = 20;

export type ReportFilters = {
  tab: string; type: string; query: string; sort: string; page: number;
};

export function readMyReportFilters(
  params: Record<string, string | string[] | undefined>,
): ReportFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const type = one("type");
  return {
    tab: one("state"),
    // An invented kind would narrow the list to nothing under a tab saying
    // otherwise, so it falls back to everything. Same call `readFilters` makes
    // on the admin queue.
    type: isModerationTarget(type) ? type : "",
    query: one("q"),
    sort: one("sort"),
    page: Math.max(1, Number(one("page")) || 1),
  };
}

/**
 * What one person has reported, and what came of it.
 *
 * One wave, the same shape as the admin queue. A failed read answers `null`
 * rather than an empty list, because "you have not reported anything" is a
 * very different thing to tell somebody who reported three things yesterday.
 */
export async function getMyReports(filters: ReportFilters) {
  const [rows, counts] = await Promise.all([
    repo.findMyReports({
      status: reportStatusForSql(filters.tab),
      type: filters.type,
      query: filters.query,
      sort: filters.sort || "recent",
      limit: MY_PER_PAGE,
      offset: (filters.page - 1) * MY_PER_PAGE,
    }).catch(() => null),
    repo.findMyReportCounts(filters.type, filters.query)
      .catch((): Record<string, number> => ({})),
  ]);

  return {
    rows: rows ?? [],
    total: rows?.[0]?.total_count ?? 0,
    page: filters.page,
    perPage: MY_PER_PAGE,
    failed: rows === null,
    tabs: reportTabs(counts ?? {}),
  };
}

export async function withdrawReport(flag: number): Promise<Result> {
  try {
    await repo.withdrawFlag(flag);
    return { ok: true, notice: "Report taken back." };
  } catch (error) {
    return {
      ok: false,
      error: explain(error, "That report could not be taken back."),
    };
  }
}

/**
 * Which of the things on a page this reader has already reported.
 *
 * Every screen that shows a Report button asks for this once and hands the
 * answer down, rather than each button asking for itself. A failed read greys
 * nothing out, which is the safe way round: the worst case is being told you
 * already reported it after pressing, which is what happened before any of
 * this existed.
 */
export async function getReported(profileId: string | null) {
  if (!profileId) return NOTHING_REPORTED;
  return repo.findMyOpenFlags(profileId)
    .then(reportedKeys)
    .catch(() => NOTHING_REPORTED);
}
