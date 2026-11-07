import type { MyClubMembership } from "@/services/myMemberships.service";

export type MembershipFilter =
  | "all" | "approved" | "pending" | "suspended" | "past";
export type MembershipSort = "recent" | "name" | "attention";

const fold = (value: string) => value.trim().toLowerCase();

// A suspension is its own group rather than part of "past": the membership is
// live, the tier is still theirs, and the club has simply shut the door. 0212
// made it a status and nothing here knew the word, so a suspended membership
// was in All and in no other tab, under a card that had no status to draw.
const inGroup = (status: MyClubMembership["status"], filter: MembershipFilter) =>
  filter === "all"
    ? true
    : filter === "past"
      ? status === "declined" || status === "cancelled"
      : status === filter;

/** How much this membership wants looking at. Higher sorts first. */
function urgency(membership: MyClubMembership): number {
  // Above everything: a member who cannot get into a club wants to read why
  // before they read that another club wants ten pounds.
  if (membership.status === "suspended") return 4;
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
