import "server-only";

import * as repo from "@/repositories/events.repository";
import { setResultList } from "./resultArmies.service";

/** Every refusal the placing functions raise, worded for the club reading it. */
const ERRORS: [string, string][] = [
  ["PLACING_NOT_YOURS", "Only the club running this event can record its results."],
  ["PLACING_NO_EVENT", "That event is no longer there."],
  ["PLACING_NOT_FOUND", "That placing has already been removed."],
  ["PLACING_RANK_RANGE", "A place has to be between 1 and 999."],
  ["PLACING_NAME_MISSING", "Say who finished there."],
  ["MEMBER_CODE_NEEDED",
    "That person is not one of your members and has no ticket for this event. "
    + "Ask them for their member code and paste it in."],
];

function refusal(error: unknown, where: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const known = ERRORS.find(([code]) => raw.includes(code));
  if (known) return known[1];

  console.error(where, raw);
  return "Could not save that result. Try again.";
}

/**
 * Record who finished where.
 *
 * The rank is the only thing that decides the label: the database turns 3 into
 * "3rd place", so a club cannot end up with a row reading "2nd place" ranked
 * fourth. Everything else is validated there too, because a form is not a
 * permission check.
 */
export async function savePlacing(params: {
  eventId: number;
  placingId: number | null;
  rank: number;
  name: string;
  profileId: string | null;
  /** The code the club was given, when the player is not one of their own. */
  memberCode?: string | null;
  faction: string;
  detachment: string;
  disposition: string;
  /** Undefined leaves whatever list is already named alone. */
  listId?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isFinite(params.rank) || params.rank < 1) {
    return { ok: false, error: "A place has to be between 1 and 999." };
  }
  if (!params.name.trim()) {
    return { ok: false, error: "Say who finished there." };
  }

  try {
    const placingId = await repo.saveEventPlacing({
      ...params,
      rank: Math.floor(params.rank),
      name: params.name.trim(),
      faction: params.faction.trim(),
      detachment: params.detachment.trim(),
      // A disposition hangs off a detachment. Without one it has nothing to
      // belong to, and `resolve_result_army` would refuse the whole placing.
      disposition: params.detachment.trim() ? params.disposition.trim() : "",
    });

    // Second, and only once the placing exists: a list hangs off the army row
    // the save above writes, so there is nothing to attach one to before it.
    // A failure here is reported as itself rather than rolled into the save,
    // because the result is recorded and only the list is missing.
    //
    // A placing with no faction writes no army row at all, so there is nothing
    // to attach a list to and nothing to clear. Without that clause this
    // raised RESULT_NOT_FOUND and the club was told "That result is not here
    // any more" about a placing that had just saved, so pressing Save again
    // made a duplicate. Same guard the draw's armies already carry, missing
    // from this path; found by recording a place with the army left blank.
    if (params.listId !== undefined && placingId && params.faction.trim()) {
      const linked = await setResultList("event_podium", placingId, "one", params.listId);
      if (!linked.ok) {
        return { ok: false, error: linked.error ?? "That list did not save. Try again." };
      }
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: refusal(error, "save placing failed") };
  }
}

export async function removePlacing(
  eventId: number,
  placingId: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await repo.deleteEventPlacing(eventId, placingId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: refusal(error, "delete placing failed") };
  }
}
