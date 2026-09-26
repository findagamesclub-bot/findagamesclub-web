import "server-only";

import * as repo from "@/repositories/moderation.repository";
import {
  FLAG_TABS, isFlagAction, isModerationTarget, statusForSql,
} from "@/utils/moderation-targets";

export type { FlagRow } from "@/repositories/moderation.repository";

export type Result = { ok: true; notice: string } | { ok: false; error: string };

const PER_PAGE = 25;

const REFUSALS: Record<string, string> = {
  NOT_PERMITTED: "That is not yours to answer.",
  TARGET_NOT_FOUND: "That is not here any more.",
  UNKNOWN_TARGET: "That is not something you can report.",
  UNKNOWN_ACTION: "That is not something you can do to a report.",
  FLAG_NOT_FOUND: "Somebody has already answered that one.",
  ADMIN_ONLY: "That one is for a site admin, not for the club. A review of your club, or anything your own team wrote, is not yours to answer.",
};

function explain(error: unknown, fallback: string): string {
  const said = error instanceof Error ? error.message : String(error);
  for (const [key, line] of Object.entries(REFUSALS)) {
    if (said.includes(key)) return line;
  }
  return fallback;
}

export type ModerationFilters = {
  tab: string; type: string; query: string; page: number;
};

export function readFilters(
  params: Record<string, string | string[] | undefined>,
): ModerationFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const type = one("type");
  return {
    tab: one("state"),
    // An invented type would narrow the list to nothing under a tab saying
    // otherwise, so it falls back to everything.
    type: isModerationTarget(type) ? type : "",
    query: one("q"),
    page: Math.max(1, Number(one("page")) || 1),
  };
}

export async function getQueue(filters: ModerationFilters) {
  // One wave. The counts do not need the rows and the rows do not need the
  // counts, so waiting for one before starting the other costs 300ms for
  // nothing.
  const [rows, counts] = await Promise.all([
    repo.findFlags({
      type: filters.type,
      status: statusForSql(filters.tab),
      query: filters.query,
      limit: PER_PAGE,
      offset: (filters.page - 1) * PER_PAGE,
    }).catch(() => null),
    repo.findFlagCounts(filters.type, filters.query)
      .catch((): Record<string, number> => ({})),
  ]);

  const safe = counts ?? {};
  return {
    rows: rows ?? [],
    total: rows?.[0]?.total_count ?? 0,
    page: filters.page,
    perPage: PER_PAGE,
    // A read that failed is not a queue with nothing in it. Without this the
    // screen says "Nothing waiting" to an admin whose database is unreachable.
    failed: rows === null,
    tabs: FLAG_TABS.map((tab) => ({
      value: tab.key,
      label: tab.label,
      count: safe[tab.key === "" ? "open" : tab.key === "any" ? "all" : tab.key] ?? 0,
    })),
  };
}

/** How many are waiting, for the rail badge and the dashboard queue. */
export async function countWaiting(): Promise<number> {
  const counts = await repo.findFlagCounts("", "")
    .catch((): Record<string, number> => ({}));
  return Number(counts?.open ?? 0);
}

export async function report(
  type: string, id: number, reason: string,
): Promise<Result> {
  if (!isModerationTarget(type)) {
    return { ok: false, error: REFUSALS.UNKNOWN_TARGET! };
  }
  try {
    const flag = await repo.reportContent(type, id, reason.trim().slice(0, 500));
    return {
      ok: true,
      // Reporting the same thing twice is a no-op in SQL, and saying so is
      // kinder than a second "thanks" that suggests two reports were filed.
      notice: flag === null
        ? "You have already reported that one. An admin will look."
        : "Thanks. An admin will look at it.",
    };
  } catch (error) {
    return { ok: false, error: explain(error, "That could not be reported.") };
  }
}

export async function resolve(
  flag: number, action: string, reason: string,
): Promise<Result> {
  if (!isFlagAction(action)) {
    return { ok: false, error: REFUSALS.UNKNOWN_ACTION! };
  }
  try {
    await repo.resolveFlag(flag, action, reason.trim().slice(0, 500));
    return {
      ok: true,
      notice: action === "remove" ? "Taken down." : "Left as it is.",
    };
  } catch (error) {
    return { ok: false, error: explain(error, "That could not be answered.") };
  }
}

/**
 * The club's own queue, over the reports on its own club.
 *
 * Same shape as `getQueue`, because one component draws both. Everything that
 * makes them different lives in SQL: which flags a club may see at all, and
 * that the reporter's name never comes back.
 */
export async function getClubQueue(club: number, filters: ModerationFilters) {
  const [rows, counts] = await Promise.all([
    repo.findClubFlags({
      club,
      type: filters.type,
      status: statusForSql(filters.tab),
      query: filters.query,
      limit: PER_PAGE,
      offset: (filters.page - 1) * PER_PAGE,
    }).catch(() => null),
    repo.findClubFlagCounts(club, filters.type, filters.query)
      .catch((): Record<string, number> => ({})),
  ]);

  const safe = counts ?? {};
  return {
    rows: rows ?? [],
    total: rows?.[0]?.total_count ?? 0,
    page: filters.page,
    perPage: PER_PAGE,
    failed: rows === null,
    tabs: FLAG_TABS.map((tab) => ({
      value: tab.key,
      label: tab.label,
      count: safe[tab.key === "" ? "open" : tab.key === "any" ? "all" : tab.key] ?? 0,
    })),
  };
}

/** How many are waiting at one club, for the console rail badge. */
export async function countClubWaiting(club: number): Promise<number> {
  const counts = await repo.findClubFlagCounts(club, "", "")
    .catch((): Record<string, number> => ({}));
  return Number(counts?.open ?? 0);
}

export async function resolveForClub(
  flag: number, action: string, reason: string,
): Promise<Result> {
  if (!isFlagAction(action)) {
    return { ok: false, error: REFUSALS.UNKNOWN_ACTION! };
  }
  try {
    await repo.resolveClubFlag(flag, action, reason.trim().slice(0, 500));
    return {
      ok: true,
      notice: action === "remove" ? "Taken down." : "Left as it is.",
    };
  } catch (error) {
    return { ok: false, error: explain(error, "That could not be answered.") };
  }
}
