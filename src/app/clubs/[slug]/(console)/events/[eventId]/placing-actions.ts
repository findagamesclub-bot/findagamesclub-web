"use server";

import { revalidatePath } from "next/cache";
import * as placings from "@/services/eventPlacings.service";
import { readFieldDetachments } from "@/utils/result-form";

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
  // Absent when the club does not record armies, which is a different
  // instruction from "no list": one leaves what is there alone, the other
  // takes it off.
  const listField = data.get("listId");
  const listId = listField === null ? undefined : Number(listField) || null;

  const result = await placings.savePlacing({
    eventId,
    placingId: Number.isFinite(placingId) && placingId > 0 ? placingId : null,
    rank: Number(data.get("rank")),
    name: String(data.get("name") ?? ""),
    profileId: String(data.get("profileId") ?? "") || null,
    // Empty for one of the club's own members, who need none. 0177 checks it
    // rather than trusting that the browser resolved the code into an id.
    memberCode: String(data.get("memberCode") ?? "") || null,
    faction: String(data.get("faction") ?? ""),
    // The cascade posts a list as JSON and the plain box a club with no
    // catalogue still gets posts one string. `readFieldDetachments` is the one
    // place that reads either, so neither form of the dialog is a second rule.
    detachments: readFieldDetachments(data),
    disposition: String(data.get("disposition") ?? ""),
    listId,
  });

  refresh();
  return result.ok ? { notice: "Result saved." } : { error: result.error };
}
