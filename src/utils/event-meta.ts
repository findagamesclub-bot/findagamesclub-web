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
 * Started, by the club's own day.
 *
 * Today counts: an event running now is one people are at, and "being taken"
 * is half of what the client asked the panel to answer.
 */
export function hasStarted(
  startDate: string | null | undefined, today: string,
): boolean {
  const start = String(startDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return false;
  return start <= today;
}

/**
 * Whether the event is worth asking about, before asking.
 *
 * `playsFortyK` alone was the gate and it closed on the one event that most
 * needed the panel: "Warhammer 40k RTT", an imported tournament with 40k
 * armies recorded against every placing, whose `featured_games` column is
 * empty because nothing in legacy ever filled it in. Every imported event is
 * in that state, which is all of them, so the panel had never appeared once.
 *
 * An event that NAMES its games and leaves 40k out is not a 40k event, which
 * is the client's rule and still holds. An event that names none is unknown,
 * and the armies recorded against it are the better evidence: there is one
 * catalogue, so an army row can only have come from 40k. So this is the cheap
 * half, and the page decides on the rows it gets back.
 */
export function mayHaveArmyMeta(input: {
  startDate: string | null | undefined;
  games: readonly string[] | null | undefined;
  today: string;
}): boolean {
  return hasStarted(input.startDate, input.today) && eventRecordsArmies(input.games);
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
 * Three different rules can empty that panel and it simply vanished for all
 * three, so the only question left on screen was the client's: "When does the
 * event analytics show? I have added placings, but no analytics are showing
 * yet?" A rule that hides a section has to be readable on the screen that
 * hides it, which this codebase has now learned on the draw, the moderation
 * queue and the admin's own queue.
 *
 * Null means there is nothing to explain, either because rows exist or because
 * the reader is not the club and an empty panel would be noise to them.
 */
export function armyMetaWait(input: {
  startDate: string | null | undefined;
  games: readonly string[] | null | undefined;
  today: string;
  /** How many army rows came back. */
  rows: number;
}): string | null {
  if (input.rows > 0) return null;

  if (!eventRecordsArmies(input.games)) {
    return "This event does not list Warhammer 40,000, so there are no factions "
      + "to count. Analytics are a 40k thing.";
  }

  if (!hasStarted(input.startDate, input.today)) {
    return "Analytics appear once the event has started. Everything recorded "
      + "before then is kept and counted on the day.";
  }

  // Started, plays 40k, and still nothing: the armies have not been typed in.
  // Naming a faction is what makes a placing countable, and a placing on its
  // own is not, which is the half the client could not see from the screen.
  return "Nothing to count yet. A finishing place counts once it names a "
    + "faction, and a table of the draw counts once its armies are recorded.";
}
