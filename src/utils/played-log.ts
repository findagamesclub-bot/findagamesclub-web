/**
 * The club's own log of games that have happened.
 *
 * The Scores page read the newest forty and sifted them in the browser, which
 * is the shape every member-owned list in this app uses and is wrong here: ten
 * tables twice a week is a thousand a year, and the client asked for a month
 * filter, which over a window of forty answers about the window rather than
 * about the month.
 *
 * So the groups live here rather than in the component, because SQL counts
 * them and the browser labels them and the two have to mean the same thing.
 */

export type PlayedTab = "all" | "unscored" | "waiting" | "disputed" | "settled";
export type PlayedSort = "newest" | "oldest";

/**
 * They partition: a game has no score, or it is waiting on the club, or the
 * players disagree, or the club has settled it. The page's own "waiting on
 * you" figure is the middle two added up, which is one fact at two levels of
 * detail rather than two figures that can contradict each other.
 */
export const PLAYED_TABS: { value: PlayedTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unscored", label: "No score" },
  { value: "waiting", label: "Waiting on you" },
  { value: "disputed", label: "Disputed" },
  { value: "settled", label: "Settled" },
];

export const PLAYED_SORTS: { value: PlayedSort; label: string }[] = [
  { value: "newest", label: "Latest night first" },
  { value: "oldest", label: "Earliest night first" },
];

export const isPlayedTab = (value: string): value is PlayedTab =>
  PLAYED_TABS.some((tab) => tab.value === value);

export const isPlayedSort = (value: string): value is PlayedSort =>
  PLAYED_SORTS.some((sort) => sort.value === value);

export type PlayedCounts = Record<PlayedTab, number>;

/**
 * What the club still owes an answer on.
 *
 * Disputed is inside this rather than beside it: both are games the club has
 * to rule on, and the page said "4 waiting on you" over tabs that added up to
 * five before this was written down in one place.
 */
export const owedAnswer = (counts: PlayedCounts): number =>
  counts.waiting + counts.disputed;
