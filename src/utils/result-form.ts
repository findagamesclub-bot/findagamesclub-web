import type { ResultArmy } from "./result-army";

/**
 * The two armies, as a result dialog posted them.
 *
 * A form cannot post a shape, so `ArmyFields` writes one hidden field holding
 * both sides and this reads it back. Undefined is the answer to anything that
 * will not parse as well as to nothing being sent: a club with the builder off
 * sends no field at all, and a result is not worth refusing over a shape
 * nobody typed.
 *
 * Undefined matters downstream. `record_booking_result` leaves an existing
 * army alone when its side is absent, so a dialog that could not load the
 * catalogue saves the scores without deleting what was recorded before.
 */
export function readArmies(
  raw: unknown,
): { one?: Partial<ResultArmy>; two?: Partial<ResultArmy> } | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return parsed as { one?: Partial<ResultArmy>; two?: Partial<ResultArmy> };
  } catch {
    return undefined;
  }
}
