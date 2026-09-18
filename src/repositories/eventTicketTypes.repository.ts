import "server-only";

import { table } from "@/lib/supabase/table";
import type { EditableTicketType } from "@/types/eventEditor";
import type { TicketAudience } from "@/utils/event-tickets";

/**
 * What an event sells.
 *
 * Its own file because a ticket type is the one part of an event people have
 * already paid for: every read here also has to answer "how many have gone",
 * which decides what may still be changed.
 */

const text = (value: string | null | undefined) => value ?? "";

type TicketRow = {
  id: number;
  label: string;
  price: string | null;
  quantity_available: number | null;
  audience: string | null;
  audience_label: string | null;
  minimum_tier_key: string | null;
  position: number;
};

export async function findTicketTypes(eventId: number): Promise<EditableTicketType[]> {
  const types = await table<TicketRow>("club_event_ticket_types");
  const { data, error } = await types
    .select("id, label, price, quantity_available, audience, audience_label, minimum_tier_key, position")
    .eq("event_id", eventId).order("position");
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (!rows.length) return [];

  // How many of each have gone, which decides what may still be changed.
  const items = await table<{ ticket_type_id: number; quantity: number;
                              club_event_bookings: { status: string } | null }>(
    "club_event_booking_items");
  const { data: sold, error: soldError } = await items
    .select("ticket_type_id, quantity, club_event_bookings!inner(status)")
    .in("ticket_type_id", rows.map((row) => row.id));
  if (soldError) throw new Error(soldError.message);

  const taken = new Map<number, number>();
  for (const line of sold ?? []) {
    if (line.club_event_bookings?.status === "cancelled") continue;
    taken.set(line.ticket_type_id, (taken.get(line.ticket_type_id) ?? 0) + line.quantity);
  }

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    price: text(row.price),
    quantityAvailable: row.quantity_available,
    // Anything that is not "members" is open to everybody, which is what
    // legacy's normaliser does with the eight spellings it accepts.
    audience: (row.audience === "members" ? "members" : "all") as TicketAudience,
    audienceLabel: text(row.audience_label),
    minimumTierKey: text(row.minimum_tier_key),
    position: row.position,
    taken: taken.get(row.id) ?? 0,
  }));
}

export type TicketFields = {
  label: string;
  price: string;
  quantity_available: number | null;
  audience: string;
  audience_label: string;
  minimum_tier_key: string | null;
  position: number;
};

export async function insertTicketTypes(eventId: number, rows: TicketFields[]) {
  if (!rows.length) return;
  const types = await table<TicketRow>("club_event_ticket_types");
  // Named column by column rather than spread, because a draft row carries an
  // `id: null` for "not saved yet" and `id` is generated always.
  const { error } = await types.insert(rows.map((row) => ({ event_id: eventId, ...row })));
  if (error) throw new Error(error.message);
}

export async function updateTicketType(eventId: number, id: number, fields: TicketFields) {
  const types = await table<TicketRow>("club_event_ticket_types");
  const { error } = await types.update(fields).eq("id", id).eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

export async function deleteTicketTypes(eventId: number, ids: number[]) {
  if (!ids.length) return;
  const types = await table<TicketRow>("club_event_ticket_types");
  for (const id of ids) {
    // One at a time so the guard trigger in 0090 names the type that refused.
    const { error } = await types.delete().eq("id", id).eq("event_id", eventId);
    if (error) throw new Error(error.message);
  }
}
