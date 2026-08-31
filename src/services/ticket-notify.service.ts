import "server-only";

import { sendEmail } from "@/lib/email/send";
import * as templates from "@/lib/email/templates";
import { formatMoney } from "@/utils/format";
import { nightLabel } from "@/utils/dates";
import type { EventBooking } from "@/types/ticket";

/**
 * Ticket emails.
 *
 * Apart from the checkout for the same reason the booking ones are: a mail
 * failure must never fail the reservation it is confirming. Every function
 * swallows its own errors.
 *
 * These go to the address typed at checkout, not the account's, because a
 * member may be booking on behalf of somebody who is actually coming.
 */

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function ticketSummary(booking: EventBooking): string {
  const count = booking.lines.reduce((n, l) => n + l.quantity, 0);
  return `${count} ${count === 1 ? "ticket" : "tickets"}`;
}

export async function notifyBooked(booking: EventBooking) {
  try {
    const message = templates.ticketsBooked({
      name: booking.fullName || undefined,
      clubName: booking.clubName,
      eventTitle: booking.eventTitle,
      when: booking.eventDate ? nightLabel(booking.eventDate) : "",
      reference: booking.reference,
      tickets: ticketSummary(booking),
      total: `${formatMoney(booking.total, booking.currency)} to pay`,
      url: `${siteUrl()}/tickets/${booking.reference}`,
    });

    await sendEmail({ to: booking.email, ...message });
  } catch {
    // The booking exists either way; a missing email is not worth failing it.
  }
}

export async function notifyCancelled(booking: EventBooking) {
  try {
    const message = templates.ticketsCancelled({
      name: booking.fullName || undefined,
      clubName: booking.clubName,
      eventTitle: booking.eventTitle,
      reference: booking.reference,
      url: `${siteUrl()}/clubs/${booking.clubSlug}/events/${booking.legacyId}`,
    });

    await sendEmail({ to: booking.email, ...message });
  } catch {
    // Same reasoning as notifyBooked.
  }
}
