import type { ClubMember } from "@/types/membership";

export type RosterFilters = {
  query: string;
  game: string;
  army: string;
  style: string;
  /** The tier they pay for, by its label. */
  membership: string;
  /** The rung they have earned, by its label. */
  loyalty: string;
};

/**
 * The two facts about a member that are not on the member.
 *
 * A membership tier's LABEL lives on the club's tier list and a loyalty rung
 * is worked out from lifetime points through the club's own ladder, so neither
 * is a field on `ClubMember` and neither should become one: the page already
 * computes both to draw the cards, and a second derivation here would be a
 * second answer to "which rung is she on".
 */
export type MemberFacets = { membership: string; loyalty: string };

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

/**
 * The same counted options, from a facet the member does not carry.
 *
 * Kept beside `rosterOptions` and deliberately not merged with it: that one
 * reads a list off each member and this one reads one value out of a lookup,
 * and folding them into a single function with a mode flag would be harder to
 * read than two short ones.
 */
export function facetOptions(
  members: ClubMember[],
  facets: Map<string, MemberFacets>,
  pick: (f: MemberFacets) => string,
) {
  const counts = new Map<string, { label: string; count: number }>();

  for (const member of members) {
    const raw = facets.get(member.profileId);
    const value = fold(raw ? pick(raw) : "");
    if (!value) continue;
    const seen = counts.get(value);
    if (seen) seen.count += 1;
    else counts.set(value, { label: pick(raw!).trim(), count: 1 });
  }

  return [...counts.entries()]
    .map(([value, entry]) => ({ value, label: entry.label, count: entry.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Narrow a roster. Every filter is an AND: they describe one person. */
export function filterRoster(
  members: ClubMember[],
  {
    query = "", game = ANY, army = ANY, style = ANY,
    membership = ANY, loyalty = ANY,
  }: Partial<RosterFilters>,
  facets: Map<string, MemberFacets> = new Map(),
): ClubMember[] {
  const needle = fold(query);

  return members.filter((member) => {
    if (!has(member.games, game)) return false;
    if (!has(member.armies, army)) return false;
    if (!has(member.playStyle, style)) return false;

    const held = facets.get(member.profileId);
    if (membership && fold(held?.membership ?? "") !== membership) return false;
    if (loyalty && fold(held?.loyalty ?? "") !== loyalty) return false;

    if (!needle) return true;

    return (
      fold(member.fullName).includes(needle) ||
      member.games.some((value) => fold(value).includes(needle)) ||
      member.armies.some((value) => fold(value).includes(needle))
    );
  });
}
