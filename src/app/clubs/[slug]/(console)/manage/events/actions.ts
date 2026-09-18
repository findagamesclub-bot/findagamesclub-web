"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import * as editor from "@/services/eventEditor.service";
import type { EventFacts } from "@/types/eventEditor";

export type EventListState = { error?: string; notice?: string; id?: number };

/**
 * Where the club's own event pages live, so one save refreshes all of them.
 *
 * The public page is in the list because a published change has to show there
 * immediately: a club fixing a start time and still seeing the old one is the
 * bug that makes people fix it twice.
 */
async function refresh(slug: string, legacyId?: string) {
  revalidatePath(`/clubs/${slug}/manage/events`);
  revalidatePath(`/clubs/${slug}/events`);
  revalidatePath("/events");
  if (legacyId) revalidatePath(`/clubs/${slug}/events/${legacyId}`);
}

/** Sign-in, club and capability, in one place. */
async function gate(slug: string) {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." as const };

  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." as const };

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("events.manage")) {
    return { error: "You do not have permission to change this." as const };
  }
  return { club };
}

export async function createEventAction(
  _prev: EventListState, data: FormData,
): Promise<EventListState> {
  const slug = String(data.get("slug") ?? "");
  const open = await gate(slug);
  if ("error" in open) return { error: open.error };

  const result = await editor.createEvent(
    open.club.id,
    String(data.get("title") ?? ""),
    String(data.get("startDate") ?? ""),
  );
  if (!result.ok) return { error: result.error };

  await refresh(slug);
  return { notice: result.notice, id: result.id };
}

export async function deleteEventAction(
  _prev: EventListState, data: FormData,
): Promise<EventListState> {
  const slug = String(data.get("slug") ?? "");
  const open = await gate(slug);
  if ("error" in open) return { error: open.error };

  const eventId = Number(data.get("eventId"));
  if (!Number.isFinite(eventId)) return { error: "That event is already gone." };

  const result = await editor.deleteEvent(open.club.id, eventId);
  if (!result.ok) return { error: result.error };

  await refresh(slug, String(data.get("legacyId") ?? ""));
  return { notice: result.notice };
}

/**
 * Publish, unpublish or call off, from the list.
 *
 * The editor has the same control, because both are places somebody decides
 * an event is ready.
 */
export async function setEventStatusAction(
  _prev: EventListState, data: FormData,
): Promise<EventListState> {
  const slug = String(data.get("slug") ?? "");
  const open = await gate(slug);
  if ("error" in open) return { error: open.error };

  const eventId = Number(data.get("eventId"));
  const status = String(data.get("status") ?? "");
  if (status !== "draft" && status !== "published" && status !== "cancelled") {
    return { error: "Something went wrong. Reload and try again." };
  }

  const event = await editor.getEvent(open.club.id, eventId);
  if (!event) return { error: "That event is not here any more." };

  const facts: EventFacts = {
    id: event.id, legacyId: event.legacyId, title: event.title,
    startDate: event.startDate || null, clubName: open.club.name, clubSlug: slug,
  };

  const result = await editor.setStatus(
    open.club.id, event, facts, status, String(data.get("reason") ?? ""),
  );
  if (!result.ok) return { error: result.error };

  await refresh(slug, event.legacyId);
  return { notice: result.notice };
}
