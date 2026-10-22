import { readDetachments, type ResultArmy } from "./result-army";

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

/**
 * The detachments a dialog posted, whichever control posted them.
 *
 * The cascade writes a JSON list into `detachments`; the plain box a club with
 * no catalogue gets writes one string into `detachment`. Both are claims
 * rather than facts, so anything that is not a list of strings reads as none,
 * and a shape nobody typed never refuses a result.
 *
 * One function rather than a branch at each call site, because the two forms
 * of that dialog are one question and the second copy of this rule is where
 * they would start disagreeing.
 */
export function readFieldDetachments(data: {
  get(name: string): unknown;
}): string[] {
  const raw = data.get("detachments");
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((one): one is string => typeof one === "string")
          .map((one) => one.trim())
          .filter(Boolean);
      }
    } catch {
      // Falls through to the single box, which is the other way this is sent.
    }
  }
  const one = data.get("detachment");
  return readDetachments({ detachment: typeof one === "string" ? one : "" });
}
