/**
 * What somebody is trying to do this season.
 *
 * Legacy's three, verbatim (`SEASON_COACH_GOAL_OPTIONS`, club_store.py:219).
 * The goal is part of the focus key, so changing it makes a different plan
 * rather than overwriting the one you had: "improve results" and "prepare next
 * games" are different advice about the same list and somebody may want both.
 */

export const SEASON_GOALS = [
  { id: "improve-results", label: "Improve results",
    description: "Focus on stronger decision-making, tighter scoring, and better overall performance." },
  { id: "tighten-list-usage", label: "Tighten list usage",
    description: "Sharpen how you pilot your current list or faction and clean up repeated mistakes." },
  { id: "prepare-next-games", label: "Prepare next games",
    description: "Bias the plan toward the next few rounds, match-ups, and likely opponents." },
] as const;

export type SeasonGoal = (typeof SEASON_GOALS)[number]["id"];

export const isSeasonGoal = (value: string): value is SeasonGoal =>
  SEASON_GOALS.some((one) => one.id === value);

/** One plan per list per goal. The key legacy builds, in the same shape. */
export const focusKeyFor = (listId: number, goal: string) => `list:${listId}:${goal}`;
