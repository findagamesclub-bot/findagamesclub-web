import { canonicalGame } from "./game-label";

/**
 * When the army panel on an event may be shown.
 *
 * The client set both conditions: "For events this should only show once event
 * has started", and "If the event is not warhammer 40k, this should be hidden
 * as faction and disposition will only be applicable to warhammer 40k".
 *
 * Pure and tested because both are date and label comparisons, which is
 * exactly the shape of thing that reads correctly and behaves otherwise. The
 * date one in particular: `new Date("2026-09-03")` is UTC midnight, so
 * anybody behind UTC reads it as the 2nd.
 */

/** Legacy's own name for the system, which `canonical-labels.json` folds to. */
const FORTY_K = "warhammer 40,000";

export function playsFortyK(games: readonly string[] | null | undefined): boolean {
  return (games ?? []).some(
    (game) => canonicalGame(game).toLowerCase() === FORTY_K);
}

/**
 * Whether an event's own screens should offer the army fields at all.
 *
 * The same reading as the panel above with the date taken out, because the
 * club types the armies in before anybody reads them: a tournament organiser
 * collects lists at the door and the draw is on screen while the event is
 * still running.
 *
 * The club's army builder switch decides this first. This is the second half
 * the client asked for: "cater for non Warhammer 40k events, where these
 * details will not be applicable". A 40k club running a Blood Bowl weekend
 * names Blood Bowl on the event, and a faction cascade on those tables is a
 * set of boxes nobody can fill in.
 */
export function eventRecordsArmies(
  games: readonly string[] | null | undefined,
): boolean {
  const named = (games ?? []).length > 0;
  return !named || playsFortyK(games);
}

/**
 * Why a club is looking at no event analytics, in their own words.
 *
 * It used to be three rules and one of them was a date: the panel waited for
 * the event to start, so a club that typed its placings in beforehand saw
 * nothing and could not tell why. The client asked for it "once any placings
 * are added or event end date has passed", and the honest version of that is
 * simply: show it when there is something to show. Two rules are left, and a
 * rule that hides a section still has to be readable on the screen that hides
 * it.
 *
 * Null means there is nothing to explain, either because rows exist or because
 * the reader is not the club and an empty panel would be noise to them.
 */
export function armyMetaWait(input: {
  games: readonly string[] | null | undefined;
  /** How many army rows came back. */
  rows: number;
}): string | null {
  if (input.rows > 0) return null;

  if (!eventRecordsArmies(input.games)) {
    return "This event does not list Warhammer 40,000, so there are no factions "
      + "to count. Analytics are a 40k thing.";
  }

  // Plays 40k and still nothing: the armies have not been typed in. Naming a
  // faction is what makes a placing countable, and a placing on its own is
  // not, which is the half the client could not see from the screen.
  return "Nothing to count yet. A finishing place counts once it names a "
    + "faction, and a table of the draw counts once its armies are recorded.";
}
