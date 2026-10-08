/**
 * Badges a member earns from a club's competitions, and still earns on read.
 *
 * The rules are legacy's (club_store.py:22907) minus the two 0167 turned into
 * stored rows. What is left is the three that cannot be stored, because each
 * is true only while it is true:
 *
 *   first in one still running                  Current Leader
 *   five or more played, some won, none lost    Undefeated Run
 *   four or more played in a campaign           Campaign Veteran
 *
 * Champion and Podium Finish are gone from here. A finished podium is a real
 * `club_badges` row now, given automatically and owned by the club, and
 * leaving the derived pair in place would have put two badges for one win side
 * by side on the same profile. One tag, one vocabulary.
 *
 * Six at most, best first, one of each kind per competition.
 */
export type BadgeTone = "champion" | "leader" | "podium" | "streak" | "campaign";

export type Badge = {
  key: string;
  label: string;
  /** Which competition earned it. */
  context: string;
  tone: BadgeTone;
};

export type BadgeSource = {
  competitionId: number;
  title: string;
  typeLabel: string;
  type: string;
  completed: boolean;
  rank: number;
  played: number;
  wins: number;
  losses: number;
};

const ORDER: Record<BadgeTone, number> = {
  champion: 0, leader: 1, podium: 2, streak: 3, campaign: 4,
};

export function competitionBadges(entries: BadgeSource[]): Badge[] {
  const badges: Badge[] = [];
  const seen = new Set<string>();

  const add = (key: string, label: string, context: string, tone: BadgeTone) => {
    if (seen.has(key)) return;
    seen.add(key);
    badges.push({ key, label, context, tone });
  };

  for (const entry of entries) {
    const id = entry.competitionId;
    const title = entry.title.trim() || entry.typeLabel || "Competition";

    // Running, not finished: a finished first place is the stored First place
    // badge 0167 gives out, and this is the thing that is true today.
    if (!entry.completed && entry.rank === 1) {
      add(`${id}::leader`, "Current Leader", title, "leader");
    }

    // Legacy's wording: a run, not a season. Five games with no loss earns it
    // whether or not the competition has finished.
    if (entry.played >= 5 && entry.wins > 0 && entry.losses === 0) {
      add(`${id}::streak`, "Undefeated Run", title, "streak");
    }

    if (entry.type.trim().toLowerCase() === "campaign" && entry.played >= 4) {
      add(`${id}::campaign`, "Campaign Veteran", title, "campaign");
    }
  }

  return badges
    .sort((a, b) => ORDER[a.tone] - ORDER[b.tone]
      || a.context.toLowerCase().localeCompare(b.context.toLowerCase()))
    .slice(0, 6);
}
