/**
 * What this reader has already reported.
 *
 * A report changes nothing anybody can see, deliberately, so without this the
 * page after reporting looks exactly like the page before it and the only way
 * to find out is to report it again: type a reason, send, and be told you
 * already did. The button knowing is the whole fix.
 *
 * Keyed on type and id together because ids are per table and a review 7 and a
 * board post 7 are different things.
 */

export type FlagKey = { target_type: string; target_id: number };

/**
 * A plain array of strings, not a Set and not an object with a `has` on it.
 *
 * This crosses from a Server Component into the client components that draw
 * the buttons, and React refuses to serialize a function: an object carrying a
 * method would throw "Functions cannot be passed directly to Client
 * Components" at request time, with tsc, the build and every static check
 * green. That trap is in CLAUDE.md five times over. Strings survive the
 * boundary, and `useReported` turns them back into a Set on the other side.
 */
export type ReportedKeys = string[];

export const reportKey = (type: string, id: number) => `${type}:${id}`;

export function reportedKeys(rows: FlagKey[]): ReportedKeys {
  return [...new Set(rows.map((row) => reportKey(row.target_type, row.target_id)))];
}

/** Nobody has reported anything, for a signed-out reader or a failed read. */
export const NOTHING_REPORTED: ReportedKeys = [];

export const REPORT_TABS: { key: string; label: string }[] = [
  { key: "", label: "Waiting" },
  { key: "answered", label: "Answered" },
  { key: "withdrawn", label: "Taken back" },
  { key: "any", label: "All" },
];

/**
 * The tab's own value, and what SQL is asked for.
 *
 * Waiting leads because it is the only one with anything pending, so it holds
 * the empty string: `nextSearch` drops an empty value and the tab a plain URL
 * lands on has to be that one.
 */
export function reportStatusForSql(tab: string): string {
  if (tab === "answered" || tab === "withdrawn" || tab === "any") return tab;
  return "open";
}

export function reportTabs(counts: Record<string, number>) {
  return REPORT_TABS.map((tab) => ({
    value: tab.key,
    label: tab.label,
    count: counts[tab.key === "" ? "open" : tab.key === "any" ? "all" : tab.key] ?? 0,
  }));
}

/** The one order a member wants their own reports in, and the other one. */
export const MY_REPORT_SORTS = [
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];
