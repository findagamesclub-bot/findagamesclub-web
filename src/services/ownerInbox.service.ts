import "server-only";

import * as repo from "@/repositories/ownerInbox.repository";
import { countApprovedByClub } from "@/repositories/memberships.repository";
import { londonToday } from "./bookingCalendar.service";
import { getClubRenewals } from "./renewals.service";
import { countRenewals } from "@/utils/renewal-filter";
import { toMembershipTiers } from "@/utils/membership-tiers";

/**
 * The owner's list of things to do.
 *
 * A club owner runs several clubs and each one asks for something different:
 * somebody wants to join, somebody has ordered a shirt, somebody has booked
 * coaching and not paid. Before this they had to visit each club's page and
 * check. This is the one place that says whether anything is waiting.
 */

export type OwnerTask = {
  kind: "join" | "tier" | "order" | "coaching";
  id: number;
  personName: string;
  detail: string;
  at: string;
  href: string;
};

export type OwnerClub = {
  id: number;
  slug: string;
  name: string;
  city: string | null;
  /** Approved members, so the card can offer the roster with a figure on it. */
  memberCount: number;
  /** Which sections this club actually runs, for the links on the card. */
  runs: { board: boolean; kit: boolean; coaching: boolean; loyalty: boolean; events: boolean };
  /** Tables booked from today on. Activity, not a job, so it is not a task. */
  upcomingTables: number;
  /**
   * Approved memberships that have lapsed or never paid. Shown on the card as
   * a red count, but deliberately not added to `tasks`: chasing money is
   * ongoing work, not an item sitting in a queue waiting to be answered, and
   * mixing it in would make "3 things waiting, longest 4 days ago" meaningless.
   */
  membershipsOwing: number;
  tasks: OwnerTask[];
};

type Person = { full_name: string | null } | null;
const nameOf = (p: Person) => p?.full_name?.trim() || "Club member";

/**
 * How many memberships are owing at each club.
 *
 * Asked club by club because the standing rules live in TypeScript, not SQL:
 * they depend on the tier a member holds now and on when it was assigned, and a
 * second copy of that in a query is a second thing to get wrong.
 */
async function owingByClub(clubs: { id: number }[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>(clubs.map((c) => [c.id, 0]));
  const tierRows = await repo.findTierRowsByClub(clubs.map((c) => c.id));

  await Promise.all(clubs.map(async (club) => {
    try {
      const rows = await getClubRenewals(
        club.id, toMembershipTiers(tierRows.get(club.id) ?? []),
      );
      counts.set(club.id, countRenewals(rows).due);
    } catch {
      // A club whose roster will not load should not take the whole page with
      // it; the card simply shows no count.
      counts.set(club.id, 0);
    }
  }));

  return counts;
}

export async function getOwnerInbox(profileId: string): Promise<OwnerClub[]> {
  const clubs = await repo.findOwnedClubs(profileId);
  if (!clubs.length) return [];

  const ids = clubs.map((c) => c.id);
  const [pending, tierRequests, tierLabels, orders, coaching, members, runs, tables, owing] =
    await Promise.all([
    repo.findPendingByClub(ids),
    // A club with none still gets its inbox.
    repo.findTierRequestsByClub(ids).catch(() => []),
    repo.findTierLabelsByClub(ids).catch(() => new Map<string, string>()),
    repo.findOpenOrdersByClub(ids),
    repo.findUnpaidCoachingByClub(ids, londonToday()),
    countApprovedByClub(ids),
    repo.findSectionsByClub(ids),
    repo.findUpcomingTablesByClub(ids, londonToday()).catch(() => new Map<number, number>()),
    owingByClub(clubs).catch(() => new Map<number, number>()),
  ]);

  const bySlug = new Map(clubs.map((c) => [c.id, c.slug]));
  const tasks = new Map<number, OwnerTask[]>(clubs.map((c) => [c.id, []]));

  for (const row of pending) {
    const person = (row as unknown as { profiles: Person }).profiles;
    tasks.get(row.club_id)?.push({
      kind: "join",
      id: row.id,
      personName: nameOf(person),
      detail: "wants to join",
      at: row.created_at,
      href: `/clubs/${bySlug.get(row.club_id)}/members?from=my-clubs`,
    });
  }

  for (const row of tierRequests) {
    const person = (row as unknown as { profiles: Person }).profiles;
    const label = tierLabels.get(`${row.club_id}:${row.requested_tier_key}`)
      ?? row.requested_tier_key
      ?? "another tier";
    tasks.get(row.club_id)?.push({
      kind: "tier",
      id: row.id,
      personName: nameOf(person),
      detail: `wants ${label}`,
      at: row.tier_requested_at ?? "",
      href: `/clubs/${bySlug.get(row.club_id)}/members?from=my-clubs`,
    });
  }

  for (const row of orders) {
    const person = (row as unknown as { profiles: Person }).profiles;
    tasks.get(row.club_id)?.push({
      kind: "order",
      id: row.id,
      personName: nameOf(person),
      detail: "ordered merchandise",
      at: row.created_at,
      href: `/clubs/${bySlug.get(row.club_id)}/shop?from=my-clubs`,
    });
  }

  for (const row of coaching) {
    const r = row as unknown as {
      profiles: Person;
      club_coaching_slots: { club_id: number; title: string };
    };
    tasks.get(r.club_coaching_slots.club_id)?.push({
      kind: "coaching",
      id: row.id,
      personName: nameOf(r.profiles),
      detail: `booked ${r.club_coaching_slots.title}, not paid`,
      at: row.booked_at,
      href: `/clubs/${bySlug.get(r.club_coaching_slots.club_id)}/coaching?from=my-clubs`,
    });
  }

  return clubs.map((club) => ({
    id: club.id,
    slug: club.slug,
    name: club.name,
    city: club.city,
    memberCount: members.get(club.id) ?? 0,
    runs: runs.get(club.id) ?? { board: false, kit: false, coaching: false, loyalty: false, events: false },
    upcomingTables: tables.get(club.id) ?? 0,
    membershipsOwing: owing.get(club.id) ?? 0,
    // Oldest first: somebody who applied a week ago has waited longest.
    tasks: (tasks.get(club.id) ?? []).sort((a, b) => a.at.localeCompare(b.at)),
  }));
}

/** Just the number, for the badge in the header. */
export async function getOwnerTaskCount(profileId: string): Promise<number> {
  try {
    const clubs = await getOwnerInbox(profileId);
    return clubs.reduce((n, c) => n + c.tasks.length, 0);
  } catch {
    // A badge is not worth failing every page in the app for.
    return 0;
  }
}
