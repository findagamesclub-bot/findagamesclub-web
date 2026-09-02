import "server-only";

import * as repo from "@/repositories/events.repository";

/** Every refusal the placing functions raise, worded for the club reading it. */
const ERRORS: [string, string][] = [
  ["PLACING_NOT_YOURS", "Only the club running this event can record its results."],
  ["PLACING_NO_EVENT", "That event is no longer there."],
  ["PLACING_NOT_FOUND", "That placing has already been removed."],
  ["PLACING_RANK_RANGE", "A place has to be between 1 and 999."],
  ["PLACING_NAME_MISSING", "Say who finished there."],
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
  faction: string;
  detachment: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isFinite(params.rank) || params.rank < 1) {
    return { ok: false, error: "A place has to be between 1 and 999." };
  }
  if (!params.name.trim()) {
    return { ok: false, error: "Say who finished there." };
  }

  try {
    await repo.saveEventPlacing({
      ...params,
      rank: Math.floor(params.rank),
      name: params.name.trim(),
      faction: params.faction.trim(),
      detachment: params.detachment.trim(),
    });
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
