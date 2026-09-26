/**
 * The six things somebody can report.
 *
 * The client named four kinds: "reviews, board posts (club and event) and
 * messages". A reply is a post for this purpose, and both boards have them, so
 * six rows carry the four kinds.
 *
 * `target_type` and `target_id` cannot have a foreign key across six tables, so
 * this is the one place that says which table each type lives in and which
 * column holds its words. The queue joins through it, and a flag whose target
 * has gone is dropped on read rather than left to rot.
 *
 * Mirrored by a check constraint in 0122. The test asserts against a copy of
 * that constraint, the way `badge-style.ts` does.
 */

export const MODERATION_TARGETS = [
  { key: "review", label: "Review", plural: "Reviews", table: "club_reviews" },
  { key: "post", label: "Board post", plural: "Board posts",
    table: "club_discussion_posts" },
  { key: "reply", label: "Board reply", plural: "Board replies",
    table: "club_discussion_replies" },
  { key: "event_post", label: "Event post", plural: "Event posts",
    table: "club_event_board_posts" },
  { key: "event_reply", label: "Event reply", plural: "Event replies",
    table: "club_event_board_replies" },
  { key: "message", label: "Message", plural: "Messages", table: "club_messages" },
] as const;

export type ModerationTarget = (typeof MODERATION_TARGETS)[number]["key"];

export function isModerationTarget(value: string): value is ModerationTarget {
  return MODERATION_TARGETS.some((one) => one.key === value);
}

export function targetLabel(value: string): string {
  return MODERATION_TARGETS.find((one) => one.key === value)?.label ?? "Something";
}

/**
 * The status tabs, and the one a plain URL selects.
 *
 * Waiting leads because it is the only tab with a job attached, and it carries
 * the empty string for the reason `admin-lists.ts` documents: `nextSearch`
 * drops an empty value, so the tab a plain URL lands on has to be the empty
 * one. "All" therefore carries a value of its own.
 */
export const FLAG_TABS = [
  { key: "", label: "Waiting" },
  { key: "answered", label: "Answered" },
  { key: "any", label: "All" },
] as const;

export type FlagTab = (typeof FLAG_TABS)[number]["key"];

/** What SQL is asked for, where the tab and the stored status differ. */
export function statusForSql(tab: string): string {
  if (tab === "answered") return "answered";
  if (tab === "any") return "";
  return "open";
}

/** What an admin can do about one. */
export const FLAG_ACTIONS = ["keep", "remove"] as const;
export type FlagAction = (typeof FLAG_ACTIONS)[number];

export function isFlagAction(value: string): value is FlagAction {
  return (FLAG_ACTIONS as readonly string[]).includes(value);
}
