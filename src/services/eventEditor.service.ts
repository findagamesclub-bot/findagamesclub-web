import "server-only";

import * as repo from "@/repositories/eventEditor.repository";
import * as notices from "@/repositories/eventNotices.repository";
import * as writes from "@/repositories/eventWrites.repository";
import { findEventImages, saveEventImages } from "@/repositories/eventImages.repository";
import { removeClubMedia } from "@/repositories/clubs.repository";
import { londonToday } from "./bookingCalendar.service";
import { publishRefusal, type EventDraft, type EventStatus } from "@/utils/event-draft";
import { eventRefusal } from "@/utils/event-refusals";
import type { ManageEvent } from "@/utils/event-manage-filter";
import type { EditableEvent, EventFacts } from "@/types/eventEditor";
import { findCancelledByEvent, findDoorList } from "@/repositories/eventRoster.repository";
import { notifyEventBackOn, notifyEventCancelled } from "./event-notify.service";

/**
 * Creating and running a club's own events.
 *
 * Every refusal here is really a policy or a trigger from 0090 refusing. The
 * checks are for the wording: `TICKET_TYPE_SOLD` is the right thing to raise
 * and the wrong thing to show somebody.
 */

export type Result = { ok: true; id?: number; notice?: string } | { ok: false; error: string };

/**
 * What went wrong, said to the person who hit it.
 *
 * The wording is pure and tested in `utils/event-refusals.ts`; what is here is
 * the half that cannot be: logging the raw message when it is one we have not
 * seen, so it shows up in the console rather than only as "try again".
 */
export function refusalOf(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const said = eventRefusal(raw);
  if (said) return said;
  console.error("[events] unexpected refusal:", raw);
  return fallback;
}

// ------------------------------------------------------------------- reads

export async function listEvents(clubId: number): Promise<{
  rows: ManageEvent[]; today: string;
}> {
  const events = await repo.findClubEvents(clubId);
  return {
    today: londonToday(),
    rows: events.map((row) => ({
      id: row.id,
      legacyId: row.legacy_id,
      title: row.title,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      venueName: row.venue_name,
      bookings: row.bookings,
      ticketsAvailable: row.tickets_available,
    })),
  };
}

export async function getEvent(
  clubId: number, eventId: number,
): Promise<EditableEvent | null> {
  const event = await repo.findEditableEvent(clubId, eventId);
  if (!event) return null;

  // A second read rather than an embed, because 0173's table is newer than
  // the generated types. Empty rather than thrown: an event whose pictures
  // will not load should still be editable, and the mirror means the hero is
  // on the row either way.
  const rows = await findEventImages(event.id).catch(() => []);
  return {
    ...event,
    images: (rows ?? []).map((row) => ({
      id: row.id,
      src: row.src ?? "",
      storagePath: row.storage_path,
      alt: row.alt ?? "",
    })),
  };
}

// ------------------------------------------------------------------ writes

/**
 * A new event starts as a draft with a name and a date and nothing else.
 *
 * Legacy has no draft state at all, so saving a title put it in the directory.
 * A club writing next season's event should not have to finish it in one
 * sitting to avoid that.
 */
export async function createEvent(
  clubId: number, title: string, startDate: string,
): Promise<Result> {
  if (!title.trim()) return { ok: false, error: "Give your event a name." };
  if (!startDate) return { ok: false, error: "Say which day it starts." };

  try {
    const id = await writes.createEvent(clubId, title.trim(), startDate);
    return { ok: true, id, notice: `${title.trim()} is saved as a draft.` };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

export async function saveEvent(
  clubId: number, eventId: number, draft: EventDraft,
): Promise<Result> {
  try {
    await writes.updateEvent(clubId, eventId, {
      title: draft.title,
      summary: draft.summary,
      price: draft.price,
      round_count: draft.roundCount,
      tickets_available: draft.capacity,
      start_date: draft.startDate,
      // Empty is not a time the column will take, and "not said" is a real
      // answer: plenty of clubs list a day and sort the hour out later.
      start_time: draft.startTime || null,
      end_date: draft.endDate || null,
      end_time: draft.endTime || null,
      venue_name: draft.venueName,
      venue_address: draft.venueAddress,
      venue_postcode: draft.venuePostcode,
      formats: draft.formats,
      event_types: draft.eventTypes,
      featured_games: draft.featuredGames,
      facilities: draft.facilities,
      info_board: draft.infoBoard,
      bestcoast_link: draft.bestcoastLink,
    });

    // Written after the event's own fields and never beside them: 0173's
    // trigger mirrors the first picture onto `logo_src`, `logo_alt` and
    // `logo_path`, so writing those here as well would be two mechanisms for
    // one fact and the one that lost would depend on statement order.
    //
    // A picture a screen reader cannot describe is a picture with no alt, so
    // the event's own name stands in for a blank one.
    await saveEventImages(eventId, draft.images.map((shot) => ({
      src: shot.src,
      path: shot.path,
      alt: shot.alt.trim() || draft.title,
    })));

    // Only once the rows that pointed at them are gone. Deleting on the click
    // would break the event page for anybody who removes a picture and then
    // leaves without saving: the row still names the path and the file is
    // gone. Never fails the save, because a file left behind is clutter
    // nobody sees and a refused save is work somebody loses.
    if (draft.removedImages.length) {
      await removeClubMedia({ kind: "club", id: clubId }, draft.removedImages)
        .catch((error) => console.error("[event images] file not removed:", error));
    }

    return { ok: true, notice: "Saved." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

export async function setStatus(
  clubId: number, event: EditableEvent, facts: EventFacts,
  status: EventStatus, reason: string,
): Promise<Result> {
  if (status === "published") {
    const refusal = publishRefusal({
      title: event.title, startDate: event.startDate,
    } as EventDraft);
    if (refusal) return { ok: false, error: refusal };
  }
  if (status === "cancelled" && !reason.trim()) {
    return { ok: false, error: "Say why it is off. Everybody holding a ticket is told." };
  }

  const wasCancelled = event.status === "cancelled";

  // Read the holders before the write, not after: the trigger in 0092 cancels
  // their bookings, so a list read afterwards finds nobody left to tell.
  const holders = status === "cancelled" && event.status !== "cancelled"
    ? (await findDoorList(event.id).catch(() => []))
        .filter((row) => row.status !== "cancelled")
        .map((row) => ({
          profileId: row.profileId, email: row.email,
          fullName: row.fullName, reference: row.reference,
        }))
    : [];

  try {
    await writes.setEventStatus(clubId, event.id, status,
      status === "cancelled" ? reason.trim() : "", !event.publishedAt);
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }

  if (status === "published") {
    // Back on after being called off is a different thing from first going
    // live, and the people the cancellation took out are the ones who most
    // need to hear it. Their places are not restored: tickets may have gone
    // elsewhere, and putting somebody back into a charge they have not agreed
    // to is worse than asking them to book again.
    if (wasCancelled) {
      const holders = await findCancelledByEvent(event.id).catch(() => []);
      await notifyEventBackOn(facts, holders);
      return { ok: true,
        notice: holders.length
          ? `Back on. ${holders.length} ${holders.length === 1 ? "person has" : "people have"} been told, and asked to book again.`
          : "Back on. It is on the site again." };
    }
    return { ok: true, notice: "Published. It is on the site now." };
  }
  if (status === "cancelled") {
    // After the write and never awaited for a result: a mail failure must not
    // undo a cancellation that has already happened.
    await notifyEventCancelled(facts, holders, reason.trim());
    return { ok: true,
      notice: holders.length
        ? `Called off. ${holders.length} ${holders.length === 1 ? "person has" : "people have"} been told.`
        : "Called off." };
  }
  return { ok: true, notice: "Back to a draft. Only your team can see it." };
}

export async function deleteEvent(clubId: number, eventId: number): Promise<Result> {
  try {
    await writes.deleteEvent(clubId, eventId);
    return { ok: true, notice: "Deleted." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not delete. Try again.") };
  }
}

// ----------------------------------------------------------------- notices

export async function addNotice(eventId: number, note: string): Promise<Result> {
  const body = note.trim();
  if (!body) return { ok: false, error: "Write the notice first." };
  if (body.length > 2000) return { ok: false, error: "That notice is too long. Trim it." };

  try {
    await notices.addNotice(eventId, body);
    return { ok: true, notice: "Posted." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not post. Try again.") };
  }
}

/**
 * The same words, corrected.
 *
 * Same two rules as posting one, in one place rather than two, because a
 * notice that is too long to post is too long to edit into.
 */
export async function editNotice(
  eventId: number, id: number, note: string,
): Promise<Result> {
  const body = note.trim();
  if (!body) return { ok: false, error: "A notice cannot be empty. Remove it instead." };
  if (body.length > 2000) return { ok: false, error: "That notice is too long. Trim it." };

  try {
    await notices.updateNotice(eventId, id, body);
    return { ok: true, notice: "Notice updated." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

export async function removeNotice(eventId: number, id: number): Promise<Result> {
  try {
    await notices.deleteNotice(eventId, id);
    return { ok: true, notice: "Removed." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not delete. Try again.") };
  }
}
