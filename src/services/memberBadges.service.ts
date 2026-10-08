import "server-only";

import * as repo from "@/repositories/memberBadges.repository";
import type { Badge } from "@/utils/competition-badges";

export type HeldBadge = Badge & { icon?: string };

/**
 * Every badge one member holds.
 *
 * Length-of-membership badges used to be worked out here from the join date and
 * painted without a row behind them. 0162 made them ordinary `club_badges` a
 * club owns, awarded nightly, so there is nothing left to derive: a club that
 * renames "Member for 5 years" or retires it now changes what a member sees,
 * which is what the client asked for and what a computed badge could never do.
 *
 * 0167 did the same for the podium, so a first, second or third at an event or
 * a finished league is a row here too. What is left in `competition-badges.ts`
 * is the three that are true only while they are true: leading a league that
 * is still running, an unbeaten run, a campaign somebody keeps turning up to.
 */
export async function getHeldBadges(profileId: string): Promise<HeldBadge[]> {
  const held = await repo.findBadgesHeldBy(profileId).catch(() => []);

  return held.map((row) => ({
    key: `awarded::${row.id}`,
    label: row.club_badges.label,
    // The club is the context, because the same badge name at two clubs is two
    // different things and the reader has to be able to tell.
    context: [row.clubs.name, row.note].filter(Boolean).join(" · "),
    tone: row.club_badges.tone as Badge["tone"],
    icon: row.club_badges.icon,
  }));
}
