import "server-only";

import * as repo from "@/repositories/memberBadges.repository";
import type { Badge } from "@/utils/competition-badges";
import { tenureBadge } from "@/utils/tenure-badges";
import { londonNow } from "@/utils/dates";

export type HeldBadge = Badge & { icon?: string };

/**
 * Every badge one member holds, from all three places they come from.
 *
 * Two are derived and one is stored, and a reader does not care which: what
 * they want is the row of things this person has. Competition badges come from
 * standings and are added by `getMemberRecords`; this gathers the other two.
 *
 * Sorted with the club's own badges first, because somebody choosing to give
 * you one means more than the calendar doing it.
 */
export async function getHeldBadges(profileId: string): Promise<HeldBadge[]> {
  const today = londonNow().date;

  // One wave. Neither read needs the other's answer.
  const [held, memberships] = await Promise.all([
    repo.findBadgesHeldBy(profileId).catch(() => []),
    repo.findMembershipsFor(profileId).catch(() => []),
  ]);

  const awarded: HeldBadge[] = held.map((row) => ({
    key: `awarded::${row.id}`,
    label: row.club_badges.label,
    // The club is the context, because the same badge name at two clubs is two
    // different things and the reader has to be able to tell.
    context: [row.clubs.name, row.note].filter(Boolean).join(" · "),
    tone: row.club_badges.tone as Badge["tone"],
    icon: row.club_badges.icon,
  }));

  const years: HeldBadge[] = memberships
    .map((row) => {
      const badge = tenureBadge(row.joined_at ?? row.created_at, today);
      return badge
        ? { ...badge, key: `${badge.key}::${row.clubs.slug}`, context: row.clubs.name }
        : null;
    })
    .filter((one): one is HeldBadge => one !== null);

  return [...awarded, ...years];
}
