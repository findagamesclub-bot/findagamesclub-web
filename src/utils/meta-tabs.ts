/**
 * Which read each tab needs.
 *
 * The analytics page learned this: six sections on one page meant six reads on
 * every visit, and the fix was a tested map from tab to read. Get it wrong and
 * a section renders its empty state over data nobody fetched, which is
 * indistinguishable from a club that has played nothing.
 */

export type MetaTab =
  | "factions" | "detachments" | "matchups" | "context" | "units" | "trend";

export type MetaRead =
  | "factions" | "detachments" | "dispositions" | "matchups"
  | "context" | "units" | "before";

export const META_TABS: { value: MetaTab; label: string }[] = [
  { value: "factions", label: "Factions" },
  { value: "detachments", label: "Detachments" },
  { value: "matchups", label: "Matchups" },
  { value: "context", label: "Battle context" },
  { value: "units", label: "Units" },
  { value: "trend", label: "Trend" },
];

/**
 * Factions is what a plain URL opens, so it carries the empty value the way
 * every other tab bar on the site does.
 */
export const DEFAULT_TAB: MetaTab = "factions";

export function readTab(raw: unknown): MetaTab {
  const value = typeof raw === "string" ? raw : "";
  return META_TABS.some((one) => one.value === value)
    ? (value as MetaTab) : DEFAULT_TAB;
}

/**
 * The factions read rides along with everything, because every section's lead
 * sentence names the leading faction and the summary strip counts the sample.
 * One extra read beats six sections disagreeing about what is winning.
 */
export const READS_FOR: Record<MetaTab, MetaRead[]> = {
  factions: ["factions", "detachments", "dispositions"],
  detachments: ["factions", "detachments", "dispositions"],
  matchups: ["factions", "matchups"],
  context: ["factions", "context"],
  units: ["factions", "units"],
  // The direction is this window's factions against the one before it.
  trend: ["factions", "before"],
};

export function readsFor(tab: MetaTab): MetaRead[] {
  return READS_FOR[tab];
}
