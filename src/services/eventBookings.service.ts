import "server-only";

import * as repo from "@/repositories/eventBookings.repository";
import { findPaymentStanding, type PaymentStanding }
  from "@/repositories/eventRoster.repository";
import { formatPrice } from "@/utils/format";
import type { CartLine, EventBooking } from "@/types/ticket";
import { owed, type PaymentStatus } from "@/utils/door-list";

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

function toBooking(
  row: Row, money?: PaymentStanding, extras?: repo.BookingExtras,
): EventBooking {
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
    clubId: row.club_id,
    legacyId: event.legacy_id,
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    subtotal: Number(row.subtotal ?? 0),
    discountAmount: Number(row.tier_discount_amount ?? 0),
    total: Number(row.total ?? 0),
    currency: row.currency ?? "GBP",
    priced: {
      subtotal: Number(row.subtotal ?? 0),
      tierLabel: row.membership_tier_label || null,
      tierPercent: Number(row.tier_discount_percent ?? 0),
      tierAmount: Number(row.tier_discount_amount ?? 0),
      points: Number(row.loyalty_points_spent ?? 0),
      pointsAmount: Number(row.loyalty_discount_amount ?? 0),
      total: Number(row.total ?? 0),
      currency: row.currency ?? "GBP",
    },
    createdAt: row.created_at,
    // Unpaid is the honest default for a booking whose standing could not be
    // read: nothing here takes payment, so "not paid yet" is where every
    // booking starts.
    paymentStatus: money?.payment_status ?? "unpaid",
    paymentMethod: money?.payment_method ?? "",
    // The club's own words about this payment, which the member sees too. A
    // note nobody can read is a note nobody writes, which is how the column
    // sat written-and-unread from 0092 to 0205.
    paymentNote: money?.payment_note ?? "",
    refundStatus: money?.refund_status ?? "not_due",
    // Beside the payment they answer, through 0224's function because none of
    // these three is in the generated types. A refund with no date and no
    // method is the half of the record the client asked for.
    refundMethod: extras?.refund_method ?? "",
    refundNote: extras?.refund_note ?? "",
    refundedAt: extras?.refunded_at ?? null,
    teamName: extras?.team_name ?? "",
    cancelReason: money?.cancel_reason ?? "",
    lines: toLines(row.club_event_booking_items),
  };
}

/** One booking by its reference. RLS decides whether the viewer sees it. */
export async function getBooking(reference: string): Promise<EventBooking | null> {
  const row = await repo.findBooking(reference.trim().toUpperCase());
  if (!row) return null;
  // Both swallowed, because the money and the team are details and the ticket
  // is the point: a reader who can see the booking should still get their
  // reference if either second read fails. One wave, not two.
  const [money, teams] = await Promise.all([
    findPaymentStanding([row.id]).catch(() => new Map()),
    repo.findBookingExtras([row.id]).catch(() => new Map<number, repo.BookingExtras>()),
  ]);
  return toBooking(row, money.get(row.id), teams.get(row.id));
}

export async function getMyBookings(profileId: string): Promise<EventBooking[]> {
  const rows = await repo.findMyBookings(profileId);
  const ids = rows.map((r) => r.id);
  const [money, teams] = await Promise.all([
    findPaymentStanding(ids).catch(() => new Map()),
    repo.findBookingExtras(ids).catch(() => new Map<number, repo.BookingExtras>()),
  ]);
  return rows.map((r) => toBooking(r as Row, money.get(r.id), teams.get(r.id)));
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
      // The types on this booking, so the door can filter to one of them.
      types: [...new Set(items.map((i) => i.label).filter(Boolean))],
      // Carried so the sales board can total what is still owed rather than
      // what was sold. Unpaid is the honest default, the same as `toBooking`.
      paymentStatus: (r.payment_status ?? "unpaid") as PaymentStatus,
    };
  });
}

export type EventSales = {
  bookings: number; tickets: number; due: number;
  /** The event these belong to, so a ranking needs no second read. */
  title: string;
  /** Published, draft or taken down. A list shows only what it may show. */
  status: string;
};

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
    const joined = row as unknown as {
      club_event_booking_items: { quantity: number }[];
      club_events: { title: string; status: string } | null;
    };
    const items = joined.club_event_booking_items ?? [];
    const held = sales.get(row.event_id) ?? {
      bookings: 0, tickets: 0, due: 0,
      title: joined.club_events?.title ?? "An event",
      status: joined.club_events?.status ?? "published",
    };
    held.bookings += 1;
    held.tickets += items.reduce((n, i) => n + i.quantity, 0);
    // Only what is still owed. Counting a booking the club has already been
    // paid for leaves the figure climbing while the money comes in, which is
    // the opposite of what a column headed "due" is for.
    held.due += owed([{
      paymentStatus: (row.payment_status ?? "unpaid") as PaymentStatus,
      total: Number(row.total ?? 0),
    }]).amount;
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
