/**
 * Turning a page number into a slice, and back into something to read.
 *
 * A page is a URL parameter, which means it arrives as anything at all: "0",
 * "-3", "abc", "99999" typed by hand, or a stale link to page 40 of a list
 * that has since shrunk to two. Every one of those has to land somewhere real
 * rather than on an empty page that looks like the data is gone.
 */

export const PAGE_SIZE = 24;

/** A page number from a query string. Anything unusable reads as page 1. */
export function pageFrom(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
}

/** How many pages `total` rows make. Always at least one, so "page 1 of 0" cannot happen. */
export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/** The page actually shown, once a number past the end is pulled back. */
export function clampPage(page: number, total: number, size = PAGE_SIZE): number {
  return Math.min(Math.max(1, page), pageCount(total, size));
}

/** Inclusive row bounds for PostgREST's `.range()`. */
export function rangeFor(page: number, size = PAGE_SIZE): { from: number; to: number } {
  const from = (Math.max(1, page) - 1) * size;
  return { from, to: from + size - 1 };
}

/** The slice of an in-memory list, for lists already filtered in the browser. */
export function pageOf<T>(items: T[], page: number, size = PAGE_SIZE): T[] {
  const safe = clampPage(page, items.length, size);
  const { from } = rangeFor(safe, size);
  return items.slice(from, from + size);
}

/**
 * "Showing 25 to 48 of 312 members".
 *
 * Written out rather than "Page 2 of 13" because the question people actually
 * have is how much there is, and a page number does not answer it.
 */
export function showingLabel(
  page: number, total: number, noun: string, size = PAGE_SIZE,
): string {
  if (total === 0) return `No ${noun}`;
  const safe = clampPage(page, total, size);
  const { from } = rangeFor(safe, size);
  const first = from + 1;
  const last = Math.min(from + size, total);
  if (total <= size) return `${total} ${noun}`;
  return `Showing ${first} to ${last} of ${total} ${noun}`;
}
