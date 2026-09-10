"use server";

import { revalidatePath } from "next/cache";
import * as placings from "@/services/eventPlacings.service";

export type PlacingState = { error?: string; notice?: string };

/**
 * One action for saving and removing, the same shape as the booking and
 * membership panels: two useActionState hooks in a component can disagree and
 * the older notice wins.
 */
export async function placingAction(
  _prev: PlacingState,
  data: FormData,
): Promise<PlacingState> {
  const slug = String(data.get("slug") ?? "");
  const eventKey = String(data.get("eventKey") ?? "");
  const eventId = Number(data.get("eventId"));
  const intent = String(data.get("intent") ?? "");

  if (!slug || !eventKey || !Number.isFinite(eventId)) {
    return { error: "Something went wrong. Reload and try again." };
  }

  const refresh = () => revalidatePath(`/clubs/${slug}/events/${eventKey}`);

  if (intent === "remove") {
    const result = await placings.removePlacing(eventId, Number(data.get("placingId")));
    refresh();
    return result.ok ? { notice: "Result removed." } : { error: result.error };
  }

  const placingId = Number(data.get("placingId"));
  const result = await placings.savePlacing({
    eventId,
    placingId: Number.isFinite(placingId) && placingId > 0 ? placingId : null,
    rank: Number(data.get("rank")),
    name: String(data.get("name") ?? ""),
    profileId: String(data.get("profileId") ?? "") || null,
    faction: String(data.get("faction") ?? ""),
    detachment: String(data.get("detachment") ?? ""),
  });

  refresh();
  return result.ok ? { notice: "Result saved." } : { error: result.error };
}
