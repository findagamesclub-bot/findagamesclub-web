import { monthLabel, pickerOptions, type FacetOption } from "./booking-facets";

/**
 * What the featured slots list is being asked for.
 *
 * Pure, because the failure is silent: the page still renders, it just renders
 * a different list than the controls claim. `state` is the house filter bar's
 * own param whatever the tab happens to mean, which is why it is named for
 * where it sits rather than for what it holds.
 *
 * THREE AXES, NOT ONE LIST OF WORDS. The client asked for "paid/unpaid, date
 * and club", and the money and the calendar are genuinely independent: a slot
 * can be on the homepage today and unpaid, which is the single most
 * interesting row on the screen. Tabs imply one choice at a time, so the money
 * is the tab row and everything else is a picker beside it.
 */

export type FeaturedFilters = {
  query: string; state: string; when: string; month: string;
  club: string; sort: string; page: number;
};

export function readFeaturedFilters(
  params: Record<string, string | string[] | undefined>,
): FeaturedFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  return {
    query: one("q"),
    state: one("state"),
    when: one("when"),
    month: one("month"),
    club: one("club"),
    sort: one("sort"),
    page: Math.max(1, Number(one("page")) || 1),
  };
}

/**
 * All leads, and it is the empty one.
 *
 * `nextSearch` drops an empty value from the address, so the tab holding the
 * empty string is the tab a plain URL selects. An admin opening this page
 * wants to see the slots, not a subset of them.
 */
export const FEATURED_TABS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "topay", label: "To pay" },
  { key: "paid", label: "Paid" },
  // A slot the club called off after booking, and the money going back
  // (0232, the client's item 16d). The same five words the table payments
  // board uses, because it is the same question about a different thing.
  { key: "cancelled", label: "Cancelled" },
  { key: "refunddue", label: "Refund due" },
  { key: "refunded", label: "Refunded" },
];

/**
 * The same three words the cards have worn since 0113.
 *
 * A status is one vocabulary, so the filter cannot call a booked slot
 * "Upcoming" while the chip beside it says "Booked".
 */
export const FEATURED_WHEN: FacetOption[] = [
  { value: "", label: "Any time" },
  { value: "live", label: "Running now" },
  { value: "soon", label: "Booked" },
  { value: "finished", label: "Finished" },
];

export const FEATURED_SORTS: FacetOption[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "value", label: "Highest price" },
  { value: "club", label: "By club" },
];

/**
 * Narrowed here as well as in SQL, so an address carrying `?sort=whatever`
 * reads as the default rather than reaching the database with a word it has to
 * decide about. The function narrows it too, because the address is a claim
 * and not a fact.
 */
export const featuredSort = (sort: string): string =>
  FEATURED_SORTS.some((one) => one.value === sort) ? sort : "newest";

export const featuredWhen = (when: string): string =>
  FEATURED_WHEN.some((one) => one.value === when && one.value) ? when : "";

const FEATURED_STATES = new Set(
  ["topay", "paid", "cancelled", "refunddue", "refunded"]);

export const featuredState = (state: string): string =>
  FEATURED_STATES.has(state) ? state : "";

/** The club picker holds an id, and an address can carry anything. */
export const featuredClubId = (club: string): number | null =>
  Number(club) > 0 ? Number(club) : null;

/** What each param means when it is absent, so a plain list has a plain URL. */
export const FEATURED_DEFAULTS: Record<string, string> = {
  state: "", when: "", month: "", club: "", sort: "newest",
};

export type FeaturedFacets = {
  months: { month: string; slots: number }[];
  clubs: { id: number; name: string; slots: number }[];
};

export const NO_FEATURED_FACETS: FeaturedFacets = { months: [], clubs: [] };

/**
 * The month and club pickers, each offering only what has a slot behind it.
 *
 * Built from what the database holds rather than generated, so a picker can
 * never offer a choice the filtered page would answer nothing for. A picker
 * saying "Sep 2026 (12)" over a page drawing nothing is the screen
 * contradicting itself.
 */
export function monthChoices(facets: FeaturedFacets, picked: string): FacetOption[] {
  return pickerOptions({
    any: "Any month",
    options: facets.months.map((one) => ({
      value: one.month, label: `${monthLabel(one.month)} (${one.slots})`,
    })),
    picked, label: monthLabel,
  });
}

export function clubChoices(facets: FeaturedFacets, picked: string): FacetOption[] {
  return pickerOptions({
    any: "Any club",
    options: facets.clubs.map((one) => ({
      value: String(one.id), label: `${one.name} (${one.slots})`,
    })),
    // A club id in a bookmark from before its last slot was removed would
    // otherwise leave the picker showing a value missing from its own list,
    // which reads as a screen that has broken.
    picked, label: () => "A club with no slots",
  });
}
