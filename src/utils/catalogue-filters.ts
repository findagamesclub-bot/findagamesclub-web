import { fold } from "./text";

/**
 * Narrowing the two catalogue lists that do not page.
 *
 * Thirty factions and a faction's handful of detachments are both small enough
 * to sift in one pass over what the page already read, which is the same call
 * `siftBadges` makes. The units are the thousand-row case and page in SQL.
 *
 * `fold()` on both sides, like every other comparison in this app, so "t'au"
 * finds T'au Empire.
 */

const hits = (query: string, ...against: string[]) => {
  const wanted = fold(query.trim());
  if (!wanted) return true;
  return against.some((one) => fold(one).includes(wanted));
};

/** By name or by slug: an admin reading the API sees ids, not labels. */
export function siftFactions<T extends { id: string; label: string }>(
  rows: T[], query: string,
): T[] {
  return rows.filter((row) => hits(query, row.label, row.id));
}

/**
 * By name, by slug, or by a disposition it offers.
 *
 * The disposition is there because "which detachments can take Priority
 * Assets" is a real question and the answer is otherwise nine cards to read.
 */
export function siftDetachments<T extends {
  slug: string; label: string; dispositions: string[] | null;
}>(rows: T[], query: string): T[] {
  return rows.filter((row) =>
    hits(query, row.label, row.slug, ...(row.dispositions ?? [])));
}
