import { ARMY_ACCESS_ERRORS } from "@/utils/army-access";

/**
 * The database's codes, in legacy's words.
 *
 * The ladder's four sentences come from `army-access.ts` so the screen that
 * hides a feature and the refusal that stops it cannot use different words for
 * the same rung. The rest are legacy's own validation messages, copied
 * verbatim (`_normalise_army_list_payload`, club_store.py:17516): the client's
 * members have been reading them for two years, and a builder that refuses a
 * list in different words from the one they know is a builder that looks
 * broken.
 */
export const ARMY_REFUSALS: Record<string, string> = {
  ...ARMY_ACCESS_ERRORS,
  ARMY_NAME: "Army list name is required.",
  ARMY_BAD_POINTS: "Choose a valid points value.",
  ARMY_BAD_FACTION: "Choose a valid army faction.",
  ARMY_NO_DETACHMENT: "Choose at least one detachment.",
  ARMY_NO_UNITS: "Add at least one unit to the army list.",
  ARMY_OVER_LIMIT: "Selected units exceed the chosen points limit.",
  ARMY_NOT_YOURS: "You can only edit your own army lists.",
  ARMY_WRONG_CLUB: "That list belongs to a different club.",
  ARMY_LIST_NOT_FOUND: "Army list not found.",
  ARMY_NO_CATALOGUE: "This club has no published catalogue to build against yet.",
  ARMY_VERSION_FROZEN: "An earlier version cannot be changed.",
  RESULT_NOT_FOUND: "That result is not here any more.",
};

export function armyRefusalFrom(error: unknown): string {
  const said = error instanceof Error ? error.message : String(error);
  const hit = Object.keys(ARMY_REFUSALS).find((code) => said.includes(code));
  if (hit) return ARMY_REFUSALS[hit];

  // A refusal the database raised deliberately reads as one of the codes
  // above. Anything else is a fault, and "That did not save." is what the
  // reader should see rather than a stack trace, so the cause goes to the
  // server log instead of being thrown away. Without this a save that fails
  // for a reason nobody anticipated is indistinguishable from one that fails
  // for a reason we chose, which cost a round trip during stage 10 testing.
  console.error("[army-builder] save failed:", said);
  return "That did not save.";
}
