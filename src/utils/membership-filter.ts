import type { MyClubMembership } from "@/services/myMemberships.service";

export type MembershipFilter = "all" | "approved" | "pending" | "past";
export type MembershipSort = "recent" | "name" | "attention";

const fold = (value: string) => value.trim().toLowerCase();

const inGroup = (status: MyClubMembership["status"], filter: MembershipFilter) =>
  filter === "all"
    ? true
    : filter === "past"
      ? status === "declined" || status === "cancelled"
      : status === filter;

/** How much this membership wants looking at. Higher sorts first. */
function urgency(membership: MyClubMembership): number {
  if (membership.standing.overdue) return 3;
  if (membership.requestedTierKey) return 2;
  if (membership.status === "pending") return 1;
  return 0;
}

/**
 * Search, filter and sort in one pass.
 *
 * Pure, so the browsing behaviour is testable without rendering anything —
 * which matters more the longer the list gets.
 */
export function filterMemberships(
  memberships: MyClubMembership[],
  { query = "", filter = "all", sort = "recent" }: {
    query?: string;
    filter?: MembershipFilter;
    sort?: MembershipSort;
  },
): MyClubMembership[] {
  const needle = fold(query);

  const kept = memberships.filter((membership) => {
    if (!inGroup(membership.status, filter)) return false;
    if (!needle) return true;
    return (
      fold(membership.club.name).includes(needle) ||
      fold(membership.club.city).includes(needle) ||
      fold(membership.tierLabel ?? "").includes(needle)
    );
  });

  return kept.sort((a, b) => {
    if (sort === "name") return a.club.name.localeCompare(b.club.name);
    if (sort === "attention") {
      const gap = urgency(b) - urgency(a);
      if (gap) return gap;
    }
    // Newest first, by whichever date the membership actually has.
    const at = (m: MyClubMembership) => m.joinedAt ?? m.requestedAt;
    return at(b).localeCompare(at(a));
  });
}

/** How many need the member to do something. Drives the "Needs you" filter. */
export function countNeedingAttention(memberships: MyClubMembership[]): number {
  return memberships.filter((m) => urgency(m) >= 2).length;
}
