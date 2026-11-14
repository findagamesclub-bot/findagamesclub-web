import { monthYear, nightLabel } from "./dates";

/**
 * The months, games and players a club has bookings for.
 *
 * Three screens narrow on these and none of them should build its own list: a
 * month that is offered on the money screen and missing from the scores
 * screen is two screens disagreeing about what the club has done.
 *
 * Every option has rows behind it, which is the same rule the roster filters
 * already follow. A dropdown offering a month with nothing in it is a control
 * pretending to work.
 */

export type FacetKind = "month" | "night" | "game" | "player";

export type BookingFacet = {
  kind: FacetKind;
  value: string;
  label: string;
  rows: number;
};

export type FacetOption = { value: string; label: string };

export type BookingFacets = {
  months: FacetOption[];
  /**
   * The club nights inside the month that is already picked, and nothing at
   * all when none is. 0228: a club three seasons in has run two hundred
   * nights, so the whole list is the problem the month picker solved once.
   */
  nights: FacetOption[];
  games: FacetOption[];
  players: FacetOption[];
};

export const NO_FACETS: BookingFacets =
  { months: [], nights: [], games: [], players: [] };

/**
 * "2026-10" as a reader says it.
 *
 * Through `monthYear`, which reads the date with UTC getters: a bare
 * `getMonth()` on an ISO day is read in the viewer's timezone, and anybody
 * behind UTC sees the month before.
 */
export const monthLabel = (value: string): string =>
  monthYear(`${value}-01`) ?? value;

/** One row per option, with what it holds, in the order the picker shows. */
export function splitFacets(rows: BookingFacet[]): BookingFacets {
  const of = (kind: FacetKind) =>
    rows.filter((row) => row.kind === kind)
      .map((row) => ({
        value: row.value,
        label: `${kind === "month" ? monthLabel(row.value)
                 : kind === "night" ? nightLabel(row.value)
                 : row.label} (${row.rows})`,
      }));

  return {
    months: of("month"), nights: of("night"),
    games: of("game"), players: of("player"),
  };
}

/**
 * A picker's options: the way out, then what the club has.
 *
 * The empty value is what a plain URL carries, so "every month" writes the
 * address the page already has rather than one more parameter nobody set.
 *
 * Anything the reader has picked that the club has nothing behind goes in as
 * well, marked (0). A month typed into the address by hand, or one left in a
 * bookmark from before a club cleared its last booking in it, would otherwise
 * leave the picker showing a value missing from its own list over an empty
 * page, which reads as a screen that has broken. Keeping it means the reader
 * can see what they asked for and clear it, and it costs no second read: the
 * alternative was fetching the months before the list so the one could be
 * checked against the other.
 */
/**
 * The option a picked value really is, where the two differ only in case.
 *
 * The games picker folds "Kill Team" and "kill team" into one option named by
 * whichever spelling the club uses most, and the SQL filter folds the same
 * way. A bookmark carrying the other spelling therefore narrows the list
 * correctly and leaves the picker showing a value none of its options has, so
 * `pickerOptions` marks it (0): "Kill Team (0)" over two games.
 *
 * Resolving it here rather than loosening `pickerOptions` is the narrower
 * fix, and the right one: MUI needs the value to equal an option exactly, so
 * what has to change is the value, not the test.
 */
export function matchFacet(picked: string, options: FacetOption[]): string {
  const clean = picked.trim();
  if (!clean) return "";
  const folded = clean.toLowerCase();
  return options.find((option) => option.value.toLowerCase() === folded)?.value ?? clean;
}

export function pickerOptions({ any, options, picked, label }: {
  any: string;
  options: FacetOption[];
  picked: string;
  /** How to word a value with nothing behind it. The default suits an id. */
  label?: (value: string) => string;
}): FacetOption[] {
  const clean = picked.trim();
  const stale = clean && !options.some((option) => option.value === clean);
  const word = label ?? (() => "Nothing in this list");
  return [
    { value: "", label: any },
    ...(stale ? [{ value: clean, label: `${word(clean)} (0)` }] : []),
    ...options,
  ];
}
