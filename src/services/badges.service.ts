import "server-only";

import * as repo from "@/repositories/badges.repository";
import { badgeTabs, type BadgeFilters } from "@/utils/badge-filters";
import {
  BADGE_DESCRIPTION_MAX, BADGE_LABEL_MAX, isBadgeIcon, isClubTone,
  DEFAULT_ICON, DEFAULT_TONE,
} from "@/utils/badge-style";

export type { ClubBadgeRow, MemberBadgeRow, BadgeAwardRow, BadgeAwardPageRow }
  from "@/repositories/badges.repository";

export type Result = { ok: true; notice: string } | { ok: false; error: string };

/**
 * The refusals a club sees, in its own words.
 *
 * The database raises these by name so a screen never has to guess from a
 * Postgres error string, and a message nobody mapped would otherwise reach a
 * toast as "duplicate key value violates unique constraint".
 */
const REFUSALS: Record<string, string> = {
  NOT_PERMITTED: "That is not yours to change.",
  BADGE_NEEDS_NAME: "Give the badge a name.",
  BADGE_NOT_FOUND: "That badge is not here any more.",
  BADGE_RETIRED: "That badge is retired, so it cannot be given out.",
  NOT_A_MEMBER: "Only somebody on the roster can be given a badge.",
  AWARD_NOT_FOUND: "That badge has already been taken back.",
  club_badges_one_label: "There is already a badge with that name.",
};

function explain(error: unknown): string {
  const said = error instanceof Error ? error.message : String(error);
  for (const [key, line] of Object.entries(REFUSALS)) {
    if (said.includes(key)) return line;
  }
  return "That did not save. Try again in a moment.";
}

export async function listBadges(club: number) {
  return repo.findClubBadges(club).catch(() => []);
}

/** Everybody holding a badge, or everybody holding one particular badge. */
export async function listAwards(club: number, badge: number | null = null) {
  return repo.findBadgeAwards(club, badge).catch(() => []);
}

/** How many awards a page shows. Cards, three across, so a page is eight rows. */
export const AWARDS_PER_PAGE = 24;

/**
 * A page of awards, and the tab counts beside it.
 *
 * One wave. Neither read needs the other's answer, so waiting for the first
 * would cost a round trip for nothing. A read that failed answers `null` and
 * the screen says the list would not load, because "nobody holds a badge" is a
 * very different thing to tell an owner who has just given one out.
 */
export async function getAwardsPage(club: number, filters: BadgeFilters) {
  const [rows, counts] = await Promise.all([
    repo.findBadgeAwardsPage({
      club, badge: filters.badge, query: filters.query, state: filters.state,
      sort: filters.sort || "recent",
      limit: AWARDS_PER_PAGE, offset: (filters.page - 1) * AWARDS_PER_PAGE,
    }).catch(() => null),
    repo.findBadgeAwardCounts(club, filters.badge, filters.query)
      .catch(() => ({} as Record<string, number>)),
  ]);

  return {
    rows: rows ?? [],
    // The total rides on every row, so an empty page has to answer zero rather
    // than read it off a row that is not there.
    total: rows?.[0]?.total_count ?? 0,
    page: filters.page,
    perPage: AWARDS_PER_PAGE,
    failed: rows === null,
    tabs: badgeTabs(counts ?? {}),
  };
}

export async function saveBadge(params: {
  club: number; badge: number | null; label: string; description: string;
  icon: string; tone: string; active: boolean;
}): Promise<Result> {
  const label = params.label.trim();
  if (!label) return { ok: false, error: REFUSALS.BADGE_NEEDS_NAME! };
  if (label.length > BADGE_LABEL_MAX) {
    return { ok: false, error: `A badge name is ${BADGE_LABEL_MAX} characters at most.` };
  }
  if (params.description.length > BADGE_DESCRIPTION_MAX) {
    return { ok: false, error: `Keep the description under ${BADGE_DESCRIPTION_MAX} characters.` };
  }

  try {
    await repo.saveBadge({
      ...params,
      label,
      // The database checks these too. Folding an unknown value here rather
      // than passing it on means a stale form gets a badge, not a raw
      // constraint violation in a toast.
      icon: isBadgeIcon(params.icon) ? params.icon : DEFAULT_ICON,
      tone: isClubTone(params.tone) ? params.tone : DEFAULT_TONE,
    });
    return { ok: true, notice: params.badge ? "Badge saved." : "Badge added." };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}

export async function awardBadge(
  badge: number, profiles: string[], note: string,
): Promise<Result> {
  if (!profiles.length) return { ok: false, error: "Pick somebody to give it to." };

  // One at a time rather than one call taking an array: a club awarding to six
  // people where one has left should give it to the other five and say so,
  // not refuse the lot.
  let given = 0;
  let already = 0;
  for (const profile of profiles) {
    try {
      const id = await repo.awardBadge(badge, profile, note);
      if (id === null) already += 1; else given += 1;
    } catch (error) {
      return { ok: false, error: explain(error) };
    }
  }

  if (given === 0) return { ok: true, notice: "They already had it." };
  const who = given === 1 ? "1 member" : `${given} members`;
  return {
    ok: true,
    notice: already > 0
      ? `Given to ${who}. The rest already had it.`
      : `Given to ${who}.`,
  };
}

export async function revokeAward(award: number): Promise<Result> {
  try {
    await repo.revokeAward(award);
    return { ok: true, notice: "Badge taken back." };
  } catch (error) {
    return { ok: false, error: explain(error) };
  }
}
