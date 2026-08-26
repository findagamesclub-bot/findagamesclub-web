import "server-only";

import * as repo from "@/repositories/eventBookings.repository";
import { formatPrice } from "@/utils/format";
import type { CartLine, EventBooking } from "@/types/ticket";

/**
 * Reading and cancelling event bookings.
 *
 * Separate from tickets.service, which is the buying side. These read rows that
 * are already frozen — the lines carry the price as it was at checkout, so a
 * club editing a ticket type later cannot rewrite what somebody paid.
 */

type Row = NonNullable<Awaited<ReturnType<typeof repo.findBooking>>>;

function toLines(items: Row["club_event_booking_items"]): CartLine[] {
  return [...(items ?? [])]
    .map((i) => ({
      ticketTypeId: i.ticket_type_id ?? 0,
      label: i.label,
      price: formatPrice(i.price ?? ""),
      unitAmount: Number(i.unit_amount ?? 0),
      quantity: i.quantity,
      lineTotal: Number(i.unit_amount ?? 0) * i.quantity,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function toBooking(row: Row): EventBooking {
  const event = (row as unknown as {
    club_events: {
      id: number; legacy_id: string; title: string; start_date: string | null;
      clubs: { slug: string; name: string };
    };
  }).club_events;

  return {
    id: row.id,
    reference: row.reference,
    eventId: row.event_id,
    eventTitle: event.title,
    eventDate: event.start_date,
    clubSlug: event.clubs.slug,
    clubName: event.clubs.name,
    legacyId: event.legacy_id,
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    subtotal: Number(row.subtotal ?? 0),
    discountAmount: Number(row.tier_discount_amount ?? 0),
    total: Number(row.total ?? 0),
    currency: row.currency ?? "GBP",
    createdAt: row.created_at,
    lines: toLines(row.club_event_booking_items),
  };
}

/** One booking by its reference. RLS decides whether the viewer sees it. */
export async function getBooking(reference: string): Promise<EventBooking | null> {
  const row = await repo.findBooking(reference.trim().toUpperCase());
  return row ? toBooking(row) : null;
}

export async function getMyBookings(profileId: string): Promise<EventBooking[]> {
  const rows = await repo.findMyBookings(profileId);
  return rows.map((r) => toBooking(r as Row));
}

/** Who is coming. Only the club can read these rows. */
export async function getAttendees(eventId: number) {
  const rows = await repo.findAttendees(eventId);
  return rows.map((r) => {
    const items = (r.club_event_booking_items ?? []) as { label: string; quantity: number }[];
    return {
      id: r.id,
      reference: r.reference,
      fullName: r.full_name,
      email: r.email,
      total: Number(r.total ?? 0),
      currency: r.currency ?? "GBP",
      createdAt: r.created_at,
      tickets: items.reduce((n, i) => n + i.quantity, 0),
      // "2× Standard, 1× Junior" reads better on a door list than a nested list.
      summary: items.map((i) => `${i.quantity}× ${i.label}`).join(", "),
    };
  });
}

export type EventSales = { bookings: number; tickets: number; due: number };

/**
 * Sales per event for one club, for the club's own events list.
 *
 * Returns an empty map for anybody else — the booking rows are the club's by
 * policy, so a member reading this gets zero rows rather than an error.
 */
export async function getEventBookingCounts(
  clubIds: number | number[],
): Promise<Map<number, EventSales>> {
  const rows = await repo.findBookingCountsByClub(
    Array.isArray(clubIds) ? clubIds : [clubIds],
  );
  const sales = new Map<number, EventSales>();

  for (const row of rows) {
    const items = (row as unknown as { club_event_booking_items: { quantity: number }[] })
      .club_event_booking_items ?? [];
    const held = sales.get(row.event_id) ?? { bookings: 0, tickets: 0, due: 0 };
    held.bookings += 1;
    held.tickets += items.reduce((n, i) => n + i.quantity, 0);
    held.due += Number(row.total ?? 0);
    sales.set(row.event_id, held);
  }
  return sales;
}

export async function cancelEventBooking(
  id: number,
): Promise<{ ok: true; reference: string } | { ok: false; error: string }> {
  try {
    const row = await repo.cancelBooking(id);
    return { ok: true, reference: row.reference };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("NOT_PERMITTED")) {
      // A cancelled booking cancelled again lands here too, which is the right
      // thing to say either way.
      return { ok: false, error: "That booking is not yours to cancel, or is already cancelled." };
    }
    return { ok: false, error: "Could not cancel that booking. Try again." };
  }
}
