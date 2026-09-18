"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import * as editor from "@/services/eventEditor.service";
import * as tickets from "@/services/eventTickets.service";
import { parseEventDraft, type FieldErrors } from "@/utils/event-draft";
import type { TicketAudience, TicketDraft } from "@/utils/event-tickets";
import type { EventFacts } from "@/types/eventEditor";

export type EventEditState = { error?: string; notice?: string; errors?: FieldErrors };

/** Sign-in, club, capability and the event, in one place. */
async function open(data: FormData) {
  const slug = String(data.get("slug") ?? "");
  const eventId = Number(data.get("eventId"));

  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." as const };

  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." as const };

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("events.manage")) {
    return { error: "You do not have permission to change this." as const };
  }
  if (!Number.isFinite(eventId)) {
    return { error: "Something went wrong. Reload and try again." as const };
  }

  const event = await editor.getEvent(club.id, eventId);
  if (!event) return { error: "That event is not here any more." as const };

  return { slug, club, event };
}

async function refresh(slug: string, legacyId: string, eventId: number) {
  revalidatePath(`/clubs/${slug}/manage/events`);
  revalidatePath(`/clubs/${slug}/manage/events/${eventId}`);
  revalidatePath(`/clubs/${slug}/events`);
  revalidatePath(`/clubs/${slug}/events/${legacyId}`);
  revalidatePath("/events");
}

export async function saveEventAction(
  _prev: EventEditState, data: FormData,
): Promise<EventEditState> {
  const gate = await open(data);
  if ("error" in gate) return { error: gate.error };

  // The same rules the browser ran. It is the browser that is optional here:
  // the form posts to an endpoint anybody with an account can reach.
  const parsed = parseEventDraft(data);
  if (!parsed.ok) {
    return { error: "Check the fields marked below.", errors: parsed.errors };
  }

  const result = await editor.saveEvent(gate.club.id, gate.event.id, parsed.value);
  if (!result.ok) return { error: result.error };

  await refresh(gate.slug, gate.event.legacyId, gate.event.id);
  return { notice: result.notice };
}

export async function setStatusAction(
  _prev: EventEditState, data: FormData,
): Promise<EventEditState> {
  const gate = await open(data);
  if ("error" in gate) return { error: gate.error };

  const status = String(data.get("status") ?? "");
  if (status !== "draft" && status !== "published" && status !== "cancelled") {
    return { error: "Something went wrong. Reload and try again." };
  }

  const facts: EventFacts = {
    id: gate.event.id, legacyId: gate.event.legacyId, title: gate.event.title,
    startDate: gate.event.startDate || null,
    clubName: gate.club.name, clubSlug: gate.slug,
  };

  const result = await editor.setStatus(
    gate.club.id, gate.event, facts, status, String(data.get("reason") ?? ""),
  );
  if (!result.ok) return { error: result.error };

  await refresh(gate.slug, gate.event.legacyId, gate.event.id);
  return { notice: result.notice };
}

/** The whole ticket table in one save, so rows can be reordered and removed. */
export async function saveTicketsAction(
  _prev: EventEditState, data: FormData,
): Promise<EventEditState> {
  const gate = await open(data);
  if ("error" in gate) return { error: gate.error };

  const at = (key: string, index: number) => String(data.getAll(key)[index] ?? "").trim();

  const rows: TicketDraft[] = data.getAll("ticketLabel").map((_, index) => {
    const cap = at("ticketQuantity", index);
    return {
      id: Number(at("ticketId", index)) || null,
      label: at("ticketLabel", index),
      price: at("ticketPrice", index),
      // An empty box is "no cap", which is a different thing from zero. Legacy
      // reads it as zero and every reader then treats the type as sold out.
      quantityAvailable: cap === "" ? null : Math.floor(Number(cap)),
      audience: (at("ticketAudience", index) === "members"
        ? "members" : "all") as TicketAudience,
      minimumTierKey: at("ticketTier", index),
    };
  });

  if (rows.some((row) => row.quantityAvailable !== null
                         && !Number.isFinite(row.quantityAvailable))) {
    return { error: "How many tickets there are has to be a whole number." };
  }

  const result = await tickets.saveTicketTypes(
    gate.club.id, gate.event.id, rows,
    gate.club.membershipTiers.map((tier) => tier.key),
  );
  if (!result.ok) return { error: result.error };

  await refresh(gate.slug, gate.event.legacyId, gate.event.id);
  return { notice: result.notice };
}

export async function noticeAction(
  _prev: EventEditState, data: FormData,
): Promise<EventEditState> {
  const gate = await open(data);
  if ("error" in gate) return { error: gate.error };

  const noticeId = Number(data.get("noticeId")) || null;
  const result = noticeId
    ? await editor.removeNotice(gate.event.id, noticeId)
    : await editor.addNotice(gate.event.id, String(data.get("message") ?? ""));
  if (!result.ok) return { error: result.error };

  await refresh(gate.slug, gate.event.legacyId, gate.event.id);
  return { notice: result.notice };
}
