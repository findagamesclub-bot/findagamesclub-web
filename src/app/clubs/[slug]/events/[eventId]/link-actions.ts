"use server";

import { revalidatePath } from "next/cache";
import * as repo from "@/repositories/events.repository";

export type LinkState = { error?: string; notice?: string };

const ERRORS: [string, string][] = [
  ["EVENT_NOT_YOURS", "Only the club running this event can change its links."],
  ["EVENT_NOT_FOUND", "That event is no longer there."],
  ["EVENT_BAD_URL", "That does not look like a web address. It should read like bestcoastpairings.com/event/…"],
];

/** Set the event's Best Coast Pairings link, or clear it with an empty box. */
export async function bestcoastLinkAction(
  _prev: LinkState,
  data: FormData,
): Promise<LinkState> {
  const slug = String(data.get("slug") ?? "");
  const eventKey = String(data.get("eventKey") ?? "");
  const eventId = Number(data.get("eventId"));
  const url = String(data.get("url") ?? "");

  if (!slug || !eventKey || !Number.isFinite(eventId)) {
    return { error: "Something went wrong. Reload and try again." };
  }

  try {
    await repo.setEventBestcoastLink(eventId, url);
    revalidatePath(`/clubs/${slug}/events/${eventKey}`);
    revalidatePath(`/clubs/${slug}/events`);
    revalidatePath("/events");
    return { notice: url.trim() ? "Best Coast Pairings link saved." : "Link removed." };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const known = ERRORS.find(([code]) => raw.includes(code));
    if (known) return { error: known[1] };

    console.error("bestcoast link failed", { eventId, raw });
    return { error: "Could not save that link. Try again." };
  }
}
