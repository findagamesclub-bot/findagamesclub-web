/**
 * Badges a member earns from a club's competitions.
 *
 * The rules are legacy's, unchanged (club_store.py:22907), so a member who had
 * a badge on the old site keeps it here:
 *
 *   finished first in a completed competition   Champion
 *   first in one still running                  Current Leader
 *   second or third in a completed one          Podium Finish
 *   five or more played, some won, none lost    Undefeated Run
 *   four or more played in a campaign           Campaign Veteran
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

const PLACES = ["", "1st", "2nd", "3rd"];

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

    if (entry.completed && entry.rank === 1) {
      add(`${id}::champion`, `${entry.typeLabel || "League"} Champion`, title, "champion");
    } else if (!entry.completed && entry.rank === 1) {
      add(`${id}::leader`, "Current Leader", title, "leader");
    }

    if (entry.completed && (entry.rank === 2 || entry.rank === 3)) {
      add(`${id}::podium`, "Podium Finish", `${title} · ${PLACES[entry.rank]}`, "podium");
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
