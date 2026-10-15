import { tokens } from "@/lib/tokens";

/**
 * What the site's own dashboard measures, and in what order.
 *
 * In a util because three things read it: the comparison strip, the two
 * charts and the page's own copy. The same reason `MONEY_STREAMS` lives in
 * one, and the same trap avoided: `analytics.service` is `server-only`, so a
 * list imported from a service into a chart drags `next/headers` into the
 * browser bundle and takes the page down with a build error.
 */

/** Things the site gained. Counts, not money. */
export const GROWTH_SERIES = [
  { key: "clubsListed", column: "clubs_listed", label: "Clubs listed",
    short: "Clubs", colour: tokens.brand },
  { key: "eventsAdded", column: "events_added", label: "Events put up",
    short: "Events", colour: tokens.brass },
  { key: "accountsJoined", column: "accounts_joined", label: "Accounts",
    short: "Accounts", colour: tokens.positive },
] as const;

/**
 * The two streams the site itself earns from, and they are not the same kind
 * of money.
 *
 * A listing fee is a payment somebody recorded, with a day, a method and a
 * reference. A featured slot is a placement booked at a price and settled
 * offline: 0161 decided that deliberately and nothing writes a payment row for
 * one. `received` is what the screen uses to say so, rather than adding them
 * into a single figure that would read as a receipt for money nobody has
 * banked.
 */
export const SITE_REVENUE = [
  { key: "listingPence", column: "listing_pence", label: "Listing fees",
    colour: tokens.brass, received: true },
  { key: "featuredPence", column: "featured_pence", label: "Featured slots",
    colour: tokens.brand, received: false },
] as const;

export type Slice = {
  clubsListed: number;
  eventsAdded: number;
  accountsJoined: number;
  listingPence: number;
  featuredPence: number;
};

export type Change = {
  /** Up, down, or neither. Never colour alone: the screen says the word too. */
  direction: "up" | "down" | "flat";
  /** Whole per cent. Null where there is nothing to compare against. */
  percent: number | null;
  before: number;
};

/**
 * How this window compares with the one before it.
 *
 * Growth from zero has no percentage: going 0 to 4 is not "400% up", it is
 * four where there were none, and the screen says that in words. Every
 * dashboard that prints Infinity got here by not deciding this.
 */
export function change(now: number, before: number): Change {
  if (now === before) return { direction: "flat", percent: 0, before };
  if (before === 0) return { direction: "up", percent: null, before };
  const percent = Math.round(((now - before) / before) * 100);
  return { direction: now > before ? "up" : "down", percent: Math.abs(percent), before };
}

/** What the arrow is saying, for anybody who cannot see the arrow. */
export function changeWords(c: Change, noun: string): string {
  if (c.direction === "flat") return `the same as the ${noun} before`;
  if (c.percent === null) return `up from none the ${noun} before`;
  return `${c.direction} ${c.percent}% on the ${noun} before`;
}
