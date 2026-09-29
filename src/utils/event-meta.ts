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
  if (!hasStarted(input.startDate, input.today)) return false;
  const named = (input.games ?? []).length > 0;
  return !named || playsFortyK(input.games);
}
