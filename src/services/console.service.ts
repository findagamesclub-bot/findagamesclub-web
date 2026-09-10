import "server-only";

import { getPendingRequests } from "./memberships.service";
import { findUpcomingTablesByClub } from "@/repositories/ownerInbox.repository";
import { londonToday } from "./bookingCalendar.service";
import { getClubResults } from "./clubResults.service";
import { getUnlinkedNames } from "./memberRecords.service";
import { getOrders } from "./clubExtras.service";
import { getClubRenewals } from "./renewals.service";
import { countRenewals } from "@/utils/renewal-filter";
import type { ConsoleCounts } from "@/components/console/console-nav";
import type { ClubAccess } from "@/utils/club-access";
import type { MembershipTier } from "@/types/clubDetail";

/**
 * What is waiting at one club.
 *
 * The owner inbox answers this across every club somebody runs, which is the
 * right shape for /my-clubs and the wrong one for a console that is already
 * about a single club. This asks per club, and only for the parts the viewer
 * may act on: a helper's console must not count join requests at them, because
 * they cannot answer one.
 *
 * Every piece is caught on its own. A count is decoration on a page whose job
 * is the sections beneath it, and none of them is worth a failed render.
 */

export type ConsoleTask = {
  kind: "join" | "score" | "order" | "renewal";
  count: number;
  label: string;
  href: string;
};

export async function getConsoleCounts(
  clubId: number, access: ClubAccess,
): Promise<ConsoleCounts> {
  const [joinRequests, scoresWaiting, ordersWaiting, unmatchedResults] = await Promise.all([
    access.can("members.manage")
      ? getPendingRequests(clubId).then((r) => r.length).catch(() => 0)
      : Promise.resolve(0),
    access.can("results.manage")
      ? countScoresWaiting(clubId)
      : Promise.resolve(0),
    access.can("shop.manage")
      ? getOrders(clubId).then((o) => o.filter((x) => x.status === "placed").length).catch(() => 0)
      : Promise.resolve(0),
    access.can("members.manage")
      ? getUnlinkedNames(clubId).then((r) => r.length).catch(() => 0)
      : Promise.resolve(0),
  ]);

  return { joinRequests, scoresWaiting, ordersWaiting, unmatchedResults };
}

/**
 * Games the club has not ruled on.
 *
 * Legacy calls these score approvals. A game with a score both players agree
 * on still needs the club to confirm it, because a confirmed result is the
 * only kind the meta tracker counts.
 */
async function countScoresWaiting(clubId: number): Promise<number> {
  try {
    const results = await getClubResults(clubId);
    return results.filter(
      (r) => r.recorded && (r.confirmation === "submitted" || r.confirmation === "disputed"),
    ).length;
  } catch {
    return 0;
  }
}

/** The overview's list, in the order somebody would work through it. */
export async function getConsoleTasks(
  clubId: number, slug: string, access: ClubAccess, tiers: MembershipTier[],
): Promise<ConsoleTask[]> {
  const at = (path: string) => `/clubs/${slug}${path}`;
  const tasks: ConsoleTask[] = [];

  const counts = await getConsoleCounts(clubId, access);

  if (counts.joinRequests) {
    tasks.push({
      kind: "join", count: counts.joinRequests,
      label: counts.joinRequests === 1 ? "person wants to join" : "people want to join",
      href: at("/members"),
    });
  }
  if (counts.scoresWaiting) {
    tasks.push({
      kind: "score", count: counts.scoresWaiting,
      label: counts.scoresWaiting === 1 ? "game needs a ruling" : "games need a ruling",
      href: at("/manage/scores"),
    });
  }
  if (counts.ordersWaiting) {
    tasks.push({
      kind: "order", count: counts.ordersWaiting,
      label: counts.ordersWaiting === 1 ? "order to answer" : "orders to answer",
      href: at("/shop"),
    });
  }

  if (access.can("members.manage")) {
    // Chasing money is ongoing work rather than a queue, so it is listed last
    // and never called a thing "waiting on you".
    const due = await getClubRenewals(clubId, tiers)
      .then((rows) => countRenewals(rows).due)
      .catch(() => 0);
    if (due) {
      tasks.push({
        kind: "renewal", count: due,
        label: due === 1 ? "membership owing" : "memberships owing",
        href: at("/members/renewals"),
      });
    }
  }

  return tasks;
}

/** Tables booked from today on, so the overview can say whether anybody is coming. */
export async function getUpcomingTables(clubId: number): Promise<number> {
  try {
    const counts = await findUpcomingTablesByClub([clubId], londonToday());
    return counts.get(clubId) ?? 0;
  } catch {
    return 0;
  }
}
