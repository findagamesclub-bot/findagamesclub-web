/**
 * The analytics page, one section at a time.
 *
 * It was one long page with a jump-to nav. Six sections of charts is a lot of
 * scrolling to answer one question, and it made every load do all six reads
 * whether or not anybody looked at them. Tabs fix both: the page shows the
 * section you asked for and reads only what that section needs, so opening
 * "Money in" costs one round trip instead of six.
 *
 * Pure, so the mapping from tab to reads is something a test can hold. Get it
 * wrong and the section renders its empty state over data that was never
 * fetched, which looks exactly like a club that has done nothing.
 */

export type ReadKey = "summary" | "money" | "people" | "nights" | "months" | "health";

export const ANALYTICS_TABS = [
  { key: "headline", label: "Headline", needs: "summary" },
  { key: "money", label: "Money in", needs: "money" },
  { key: "trend", label: "Over the months", needs: "months" },
  { key: "people", label: "Who turns up", needs: "people" },
  { key: "nights", label: "Nights and events", needs: "nights" },
  { key: "membership", label: "Membership", needs: "health" },
] as const satisfies readonly { key: string; label: string; needs: ReadKey }[];

export type AnalyticsTabKey = (typeof ANALYTICS_TABS)[number]["key"];

export const DEFAULT_TAB: AnalyticsTabKey = "headline";

export function isAnalyticsTab(value: string): value is AnalyticsTabKey {
  return ANALYTICS_TABS.some((tab) => tab.key === value);
}

/**
 * Which tab the address is asking for.
 *
 * An unknown tab falls back rather than rendering nothing: a stale link from
 * before a tab was renamed should land somewhere, not on a blank page.
 */
export function readTab(value: string | string[] | undefined): AnalyticsTabKey {
  const one = Array.isArray(value) ? value[0] : value;
  return one && isAnalyticsTab(one) ? one : DEFAULT_TAB;
}

/** The one read this tab needs. */
export function readsFor(tab: AnalyticsTabKey): ReadKey {
  return ANALYTICS_TABS.find((one) => one.key === tab)!.needs;
}

export function tabLabel(tab: AnalyticsTabKey): string {
  return ANALYTICS_TABS.find((one) => one.key === tab)!.label;
}
