/**
 * What the two admin lists are being asked for.
 *
 * Pure, because the failure is silent: the page still renders, it just renders
 * a different list than the tabs claim. `state` is the house filter bar's own
 * param whatever the tab happens to mean, so these are named for where they
 * sit rather than for what they hold, and one reader serves both screens.
 */

export type AdminListFilters = {
  query: string; tab: string; extra: string; sort: string; page: number;
};

export function readAdminFilters(
  params: Record<string, string | string[] | undefined>,
): AdminListFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  return {
    query: one("q"),
    tab: one("state"),
    extra: one("status"),
    sort: one("sort"),
    page: Math.max(1, Number(one("page")) || 1),
  };
}

export const CLUB_TABS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "active", label: "Live" },
  { key: "paused", label: "Paused" },
  { key: "suspended", label: "Suspended" },
];

/**
 * Upcoming leads, and All carries a value of its own.
 *
 * `nextSearch` drops an empty value from the address, so the tab holding the
 * empty string is the one a plain URL selects. Clubs default to All, so All is
 * the empty one there. Events default to Upcoming, so if All were empty here
 * it would write the same URL as Upcoming and no press would ever reach it.
 */
export const EVENT_TABS: { key: string; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "any", label: "All" },
];

/**
 * How the clubs list is ordered, with the default filled in.
 *
 * Narrowed here rather than in SQL as well, so an address carrying
 * `?sort=whatever` reads as the default instead of reaching the database with
 * a word it has to decide about. The function narrows it too, because the
 * address is a claim and not a fact.
 */
export const CLUB_SORTS = [
  { value: "name", label: "By name" },
  { value: "newest", label: "Newest first" },
];

export function clubSort(filters: AdminListFilters): string {
  return CLUB_SORTS.some((s) => s.value === filters.sort) ? filters.sort : "name";
}

/**
 * How the events list is ordered.
 *
 * "Newest first" is when the event was PUT UP, not the latest date on it. "By
 * date" already walks the start date in both directions, ascending on Upcoming
 * and descending on Past, so a second control for the same column would be the
 * same sort wearing a different word. What it cannot answer is "what has
 * appeared since I last looked", which is the question an admin list is for.
 */
export const EVENT_SORTS = [
  { value: "date", label: "By date" },
  { value: "newest", label: "Newest first" },
];

export function eventSort(filters: AdminListFilters): string {
  return EVENT_SORTS.some((s) => s.value === filters.sort) ? filters.sort : "date";
}

/** What the events list is showing, with the default filled in. */
export function eventWhen(filters: AdminListFilters): string {
  return filters.tab || "upcoming";
}

/** And what SQL should be asked, where "any" means no filter at all. */
export function eventWhenForSql(when: string): string {
  return when === "any" ? "" : when;
}

/**
 * The figure beside each tab.
 *
 * The house tab bar prints a number on every tab, so a tab with nothing behind
 * it reads "Suspended 0", which is the answer somebody wanted before they
 * clicked. A missing count is not the same thing: it renders blank and leaves
 * the bar looking half-loaded, so a failed counts read falls back to zeros.
 */
export function tabsWith(
  tabs: { key: string; label: string }[], counts: Record<string, number>,
) {
  return tabs.map((tab) => ({
    value: tab.key, label: tab.label,
    count: counts[tab.key === "" || tab.key === "any" ? "all" : tab.key] ?? 0,
  }));
}
