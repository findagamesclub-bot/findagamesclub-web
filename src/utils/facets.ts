/**
 * Search terms travel as one string. Commas can't be the separator: the
 * directory's most-played game is "Warhammer 40,000", and splitting on commas
 * turned it into "Warhammer 40" AND "000", which matched almost nothing.
 *
 * A pipe never appears in a game or facility label, so it can't collide.
 */
export const FACET_SEPARATOR = "|";

export function splitFacets(value: string | undefined | null): string[] {
  const seen = new Set<string>();
  // Deduped on read as well as on entry: a hand-edited or shared URL can repeat
  // a term, and the chip row keys on the term itself.
  return (value ?? "")
    .split(FACET_SEPARATOR)
    .map((v) => v.trim())
    .filter((v) => {
      if (!v || seen.has(v.toLowerCase())) return false;
      seen.add(v.toLowerCase());
      return true;
    });
}

export function joinFacets(facets: string[]): string {
  return facets.join(FACET_SEPARATOR);
}
