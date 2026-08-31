/**
 * The vocabularies a competition is built from.
 *
 * Legacy's, verbatim: COMPETITION_TYPE_LABELS and COMPETITION_STATUS_LABELS
 * (club_store.py:685). Both are closed sets, so an unknown value falls back to
 * the same default legacy uses rather than being written through.
 */

export const COMPETITION_TYPES = [
  { value: "league", label: "League" },
  { value: "ladder", label: "Ladder" },
  { value: "campaign", label: "Campaign" },
  { value: "season", label: "Season" },
] as const;

export const COMPETITION_STATUSES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
] as const;

export function competitionType(value: unknown): string {
  const clean = String(value ?? "").trim().toLowerCase();
  return COMPETITION_TYPES.some((t) => t.value === clean) ? clean : "league";
}

export function competitionStatus(value: unknown): string {
  const clean = String(value ?? "").trim().toLowerCase();
  return COMPETITION_STATUSES.some((s) => s.value === clean) ? clean : "active";
}

export function typeLabel(value: unknown): string {
  return COMPETITION_TYPES.find((t) => t.value === competitionType(value))?.label ?? "League";
}

export function statusLabel(value: unknown): string {
  return COMPETITION_STATUSES.find((s) => s.value === competitionStatus(value))?.label ?? "Active";
}

/**
 * A league table, ordered.
 *
 * Points first, then wins, then fewest losses, then name. Legacy sorts on
 * points alone, which leaves two people on nine points in whatever order they
 * were typed and the table looking arbitrary to the pair of them.
 */
export function rankStandings<T extends {
  points: number; wins: number; losses: number; memberName: string;
}>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    b.points - a.points
    || b.wins - a.wins
    || a.losses - b.losses
    || a.memberName.localeCompare(b.memberName));
}

/** Played, from the three results. Nobody should be typing four numbers. */
export function playedFrom(wins: number, draws: number, losses: number): number {
  return Math.max(0, wins) + Math.max(0, draws) + Math.max(0, losses);
}
