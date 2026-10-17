import "server-only";

import * as repo from "@/repositories/memberBadges.repository";
import type { Badge } from "@/utils/competition-badges";

export type PodiumFinish = { note: string; onDate: string | null };

export type HeldBadge = Badge & {
  icon?: string;
  /**
   * Every finish a podium badge stands for (0198), newest first.
   *
   * 0167 keeps one badge per rank per club rather than one per finish, so a
   * member who has won twice holds "First place" once. 0182 made the note name
   * the newest and count the rest, and "and 1 more" is where the client got
   * stuck: the other win was on the page, in a different panel, with nothing
   * connecting it to the badge. Empty on every badge that is not a podium.
   */
  finishes?: PodiumFinish[];
};

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
  if (!held.length) return [];

  // One more read for the whole profile rather than one per badge, and a
  // failure costs the list behind a podium chip and nothing else: the badge
  // still draws, with the note 0182 writes.
  const finishes = await repo.findPodiumFinishes(profileId).catch(
    (error: unknown) => {
      console.error("[badges] podium finishes did not load:", error);
      return [];
    });

  const byAward = new Map<number, PodiumFinish[]>();
  for (const row of finishes) {
    const list = byAward.get(row.award_id) ?? [];
    list.push({ note: row.note, onDate: row.on_date });
    byAward.set(row.award_id, list);
  }

  return held.map((row) => ({
    key: `awarded::${row.id}`,
    finishes: byAward.get(row.id),
    label: row.club_badges.label,
    // The club is the context, because the same badge name at two clubs is two
    // different things and the reader has to be able to tell.
    context: [row.clubs.name, row.note].filter(Boolean).join(" · "),
    tone: row.club_badges.tone as Badge["tone"],
    icon: row.club_badges.icon,
  }));
}
