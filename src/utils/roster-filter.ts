import type { ClubMember } from "@/types/membership";

export type RosterFilters = {
  query: string;
  game: string;
  army: string;
  style: string;
};

export const ANY = "";

const fold = (value: string) => value.trim().toLowerCase();

/**
 * The values a club's own roster actually contains.
 *
 * Built from the members rather than from a fixed list, so a club that plays
 * one game gets one option instead of a dropdown of forty it has never heard
 * of. Counted so the label can say how many people each choice would leave.
 */
export function rosterOptions(members: ClubMember[], pick: (m: ClubMember) => string[]) {
  const counts = new Map<string, { label: string; count: number }>();

  for (const member of members) {
    // A member listing "40k" twice is one person, not two.
    for (const value of new Set(pick(member).map(fold).filter(Boolean))) {
      const seen = counts.get(value);
      if (seen) seen.count += 1;
      else {
        const original = pick(member).find((raw) => fold(raw) === value) ?? value;
        counts.set(value, { label: original.trim(), count: 1 });
      }
    }
  }

  return [...counts.entries()]
    .map(([value, entry]) => ({ value, label: entry.label, count: entry.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

const has = (values: string[], wanted: string) =>
  !wanted || values.some((value) => fold(value) === wanted);

/** Narrow a roster. Every filter is an AND: they describe one person. */
export function filterRoster(
  members: ClubMember[],
  { query = "", game = ANY, army = ANY, style = ANY }: Partial<RosterFilters>,
): ClubMember[] {
  const needle = fold(query);

  return members.filter((member) => {
    if (!has(member.games, game)) return false;
    if (!has(member.armies, army)) return false;
    if (!has(member.playStyle, style)) return false;
    if (!needle) return true;

    return (
      fold(member.fullName).includes(needle) ||
      member.games.some((value) => fold(value).includes(needle)) ||
      member.armies.some((value) => fold(value).includes(needle))
    );
  });
}
