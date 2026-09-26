import { fold } from "@/utils/text";

/**
 * What the two badge tabs are being asked for, and how the definitions tab
 * answers it.
 *
 * Both tabs share the house filter bar's own params, so `state`, `q` and
 * `sort` mean the same thing on each and a reader who learns one learns the
 * other. The awarded tab hands them to SQL; the definitions tab is a handful
 * of rows somebody typed by hand, which is the case CLAUDE.md says belongs in
 * memory rather than in a query.
 */

export type BadgeFilters = {
  query: string; state: string; sort: string;
  /** Which badge the awarded list is narrowed to, if any. */
  badge: number | null;
  page: number;
};

export function readBadgeFilters(
  params: Record<string, string | string[] | undefined>,
): BadgeFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const badge = Number(one("badge"));
  return {
    query: one("q"),
    state: one("state"),
    sort: one("sort"),
    badge: Number.isInteger(badge) && badge > 0 ? badge : null,
    page: Math.max(1, Number(one("page")) || 1),
  };
}

/**
 * The same three states on both tabs, because both are about the same badges.
 *
 * All is the empty one: `nextSearch` drops an empty value, so the tab holding
 * it is the tab a plain URL selects, and a plain URL here should show
 * everything.
 */
export const BADGE_STATE_TABS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "live", label: "Given out" },
  { key: "retired", label: "Retired" },
];

export const BADGE_SORTS = [
  { value: "name", label: "By name" },
  { value: "held", label: "Most held" },
  { value: "least", label: "Fewest held" },
];

export const AWARD_SORTS = [
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "member", label: "By member" },
  { value: "badge", label: "By badge" },
];

type BadgeLike = {
  label: string; description: string; active: boolean; awarded: number;
};

const matches = (badge: BadgeLike, query: string) => {
  const term = fold(query.trim());
  if (!term) return true;
  return fold(badge.label).includes(term) || fold(badge.description).includes(term);
};

const inState = (badge: BadgeLike, state: string) =>
  state === "live" ? badge.active : state === "retired" ? !badge.active : true;

/**
 * The definitions tab, sifted.
 *
 * Retired last on every sort, because a badge the club has stopped giving out
 * is not what somebody opened this page to work on. Ties break on the name so
 * two badges held by nobody do not swap places between renders.
 */
export function siftBadges<T extends BadgeLike>(
  rows: T[], filters: { query: string; state: string; sort: string },
): T[] {
  const kept = rows.filter((row) =>
    matches(row, filters.query) && inState(row, filters.state));

  const byName = (a: T, b: T) => fold(a.label).localeCompare(fold(b.label));
  const sorted = [...kept].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (filters.sort === "held") return b.awarded - a.awarded || byName(a, b);
    if (filters.sort === "least") return a.awarded - b.awarded || byName(a, b);
    return byName(a, b);
  });
  return sorted;
}

/**
 * The figure beside each tab on the definitions side.
 *
 * Narrowed by the search, the same as the awarded tab's counts are in SQL:
 * "Retired 1" beside a search for terrain has to mean one retired badge about
 * terrain, or the tab lies about the list under it.
 */
export function badgeStateCounts(rows: BadgeLike[], query: string) {
  const kept = rows.filter((row) => matches(row, query));
  return {
    all: kept.length,
    live: kept.filter((row) => row.active).length,
    retired: kept.filter((row) => !row.active).length,
  };
}

/** The house tab bar prints a number on every tab, so a missing one is a zero. */
export function badgeTabs(counts: Record<string, number>) {
  return BADGE_STATE_TABS.map((tab) => ({
    value: tab.key, label: tab.label,
    count: counts[tab.key === "" ? "all" : tab.key] ?? 0,
  }));
}
