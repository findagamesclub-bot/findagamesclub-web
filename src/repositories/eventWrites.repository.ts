import "server-only";

import { callRpc, table } from "@/lib/supabase/table";
import type { EventRow } from "./eventEditor.repository";
import type { EventStatus } from "@/utils/event-draft";

/**
 * Changing an event.
 *
 * Split from the reads because they are two different jobs with two different
 * risks: a read that is wrong shows the wrong number, and a write that is
 * wrong changes somebody else's event. Every one of these is pinned to the
 * club as well as the event id, and proves it touched a row.
 */

export type EventFields = {
  title: string;
  summary: string;
  price: string;
  round_count: number | null;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  venue_name: string;
  venue_address: string;
  venue_postcode: string;
  formats: string[];
  event_types: string[];
  featured_games: string[];
  facilities: string[];
  info_board: string;
  bestcoast_link: string;
  logo_src: string | null;
  logo_alt: string | null;
  logo_path: string | null;
};

/**
 * A new event, through a function.
 *
 * `legacy_id` is the URL and has to be unique within the club, so it is built
 * in SQL where a collision can be settled without a round trip.
 */
export async function createEvent(
  clubId: number, title: string, startDate: string,
): Promise<number> {
  return callRpc<number>("create_club_event", {
    p_club: clubId, p_title: title, p_start_date: startDate,
  });
}

export async function updateEvent(clubId: number, eventId: number, fields: EventFields) {
  const events = await table<EventRow>("club_events");
  // Pinned to the club as well as the id. The policy says the same thing; this
  // is the half that does not depend on getting the policy right.
  const { data, error } = await events
    .update(fields).eq("id", eventId).eq("club_id", clubId).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
}

/**
 * Publish, unpublish or call off.
 *
 * `published_at` is stamped the first time only, so an event taken back to
 * draft and out again keeps the date it first went live.
 */
export async function setEventStatus(
  clubId: number, eventId: number,
  status: EventStatus, reason: string, firstPublish: boolean,
) {
  const events = await table<EventRow>("club_events");
  const patch: Record<string, unknown> = { status, cancel_reason: reason };
  if (status === "published" && firstPublish) patch.published_at = new Date().toISOString();

  const { data, error } = await events
    .update(patch).eq("id", eventId).eq("club_id", clubId).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
}

/**
 * The event's capacity, which legacy computes from its ticket types rather
 * than storing a typed figure (club_store.py:14786). Its own write, so saving
 * the tickets does not have to resend the whole event to change one number.
 */
export async function setTicketsAvailable(
  clubId: number, eventId: number, total: number | null,
) {
  const events = await table<EventRow>("club_events");
  const { data, error } = await events
    .update({ tickets_available: total }).eq("id", eventId).eq("club_id", clubId)
    .select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
}

export async function deleteEvent(clubId: number, eventId: number) {
  const events = await table<EventRow>("club_events");
  const { error } = await events.delete().eq("id", eventId).eq("club_id", clubId);
  if (error) throw new Error(error.message);
}
