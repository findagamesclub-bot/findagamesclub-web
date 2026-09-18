import "server-only";

import { table } from "@/lib/supabase/table";
import { findTicketTypes } from "./eventTicketTypes.repository";
import { findNotices } from "./eventNotices.repository";
import type { EditableEvent, EditableTicketType, EventNotice } from "@/types/eventEditor";
import type { EventStatus } from "@/utils/event-draft";
import type { TicketAudience } from "@/utils/event-tickets";

/**
 * A club's own events, including the ones nobody else can see.
 *
 * Separate from `events.repository.ts`, which answers the directory and the
 * public event page. That one never asks for a draft and never counts who has
 * booked; this one does both on every read.
 *
 * The `table()` helper is here because 0090 to 0092 are not in the generated
 * types until the user has run them. Swap these for typed queries after the
 * regeneration.
 */

export type EventRow = {
  id: number;
  legacy_id: string;
  club_id: number;
  title: string;
  summary: string | null;
  price: string | null;
  round_count: number | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_postcode: string | null;
  formats: string[] | null;
  event_types: string[] | null;
  featured_games: string[] | null;
  facilities: string[] | null;
  info_board: string | null;
  bestcoast_link: string | null;
  logo_src: string | null;
  logo_alt: string | null;
  logo_path: string | null;
  status: EventStatus;
  published_at: string | null;
  cancel_reason: string | null;
  tickets_available: number | null;
};

const EVENT_COLUMNS = `id, legacy_id, club_id, title, summary, price, round_count,
  start_date, start_time, end_date, end_time,
  venue_name, venue_address, venue_postcode,
  formats, event_types, featured_games, facilities,
  info_board, bestcoast_link, logo_src, logo_alt, logo_path,
  status, published_at, cancel_reason, tickets_available`;

const text = (value: string | null | undefined) => value ?? "";

function toEvent(
  row: EventRow, ticketTypes: EditableTicketType[], notices: EventNotice[], bookings: number,
): EditableEvent {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    clubId: row.club_id,
    title: row.title,
    summary: text(row.summary),
    price: text(row.price),
    roundCount: row.round_count,
    startDate: text(row.start_date),
    startTime: text(row.start_time),
    endDate: text(row.end_date),
    endTime: text(row.end_time),
    venueName: text(row.venue_name),
    venueAddress: text(row.venue_address),
    venuePostcode: text(row.venue_postcode),
    formats: row.formats ?? [],
    eventTypes: row.event_types ?? [],
    featuredGames: row.featured_games ?? [],
    facilities: row.facilities ?? [],
    infoBoard: text(row.info_board),
    bestcoastLink: text(row.bestcoast_link),
    logoSrc: text(row.logo_src),
    logoAlt: text(row.logo_alt),
    logoPath: text(row.logo_path),
    status: row.status,
    publishedAt: row.published_at,
    cancelReason: text(row.cancel_reason),
    ticketsAvailable: row.tickets_available,
    bookings,
    ticketTypes,
    notices,
  };
}

/** The club's list, with how many people hold a place on each. */
export type EventListRow = EventRow & { bookings: number };

export async function findClubEvents(clubId: number): Promise<EventListRow[]> {
  const events = await table<EventRow>("club_events");
  const { data, error } = await events
    .select(EVENT_COLUMNS).eq("club_id", clubId).order("start_date", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (!rows.length) return [];

  // One query for the counts rather than one per event: a club with ten years
  // of events would otherwise make a hundred round trips to draw one list.
  const bookings = await table<{ event_id: number }>("club_event_bookings");
  const { data: live, error: countError } = await bookings
    .select("event_id")
    .in("event_id", rows.map((row) => row.id))
    .neq("status", "cancelled");
  if (countError) throw new Error(countError.message);

  const counts = new Map<number, number>();
  for (const row of live ?? []) counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);

  return rows.map((row) => ({ ...row, bookings: counts.get(row.id) ?? 0 }));
}

/**
 * The row id behind an event's URL key.
 *
 * The public pages address an event by `legacy_id`, which is what is in
 * everybody's emails; the console addresses it by row id. The redirect left
 * behind by the move needs to get from one to the other.
 */
export async function findEventIdByKey(
  clubId: number, legacyId: string,
): Promise<number | null> {
  const events = await table<EventRow>("club_events");
  const { data, error } = await events
    .select("id").eq("club_id", clubId).eq("legacy_id", legacyId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

/** One event to edit. Null when it is not this club's, which is a 404. */
export async function findEditableEvent(
  clubId: number, eventId: number,
): Promise<EditableEvent | null> {
  const events = await table<EventRow>("club_events");
  const { data, error } = await events
    .select(EVENT_COLUMNS).eq("id", eventId).eq("club_id", clubId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const [ticketTypes, notices, bookings] = await Promise.all([
    findTicketTypes(eventId), findNotices(eventId), countLiveBookings(eventId),
  ]);
  return toEvent(data, ticketTypes, notices, bookings);
}

/** How many people hold a place, which is who a cancellation has to tell. */
async function countLiveBookings(eventId: number): Promise<number> {
  const bookings = await table<{ id: number }>("club_event_bookings");
  const { count, error } = await bookings
    .select("id", { count: "exact" }).eq("event_id", eventId).neq("status", "cancelled");
  if (error) throw new Error(error.message);
  return count ?? 0;
}
