import "server-only";

import { sendEmail } from "@/lib/email/send";
import * as templates from "@/lib/email/templates";
import { recipient, siteUrl } from "./mail-recipient.service";
import { nightLabel } from "@/utils/dates";
import type { EventFacts } from "@/types/eventEditor";

/**
 * Event emails.
 *
 * Apart from the writes for the same reason every other notify service is: a
 * mail failure must never undo the cancellation it is announcing. Every
 * function here swallows its own errors and none is awaited for a result.
 *
 * The bell is a trigger's job, not this file's: 0095 fires on the booking row
 * itself, so a payment recorded from the event's list, the club-wide bookings
 * tab or anywhere added later all reach the bell without anybody remembering
 * to call something. These are the emails that go alongside it.
 */

const eventUrl = (event: EventFacts) =>
  `${siteUrl()}/clubs/${event.clubSlug}/events/${event.legacyId}`;

const whenOf = (event: EventFacts) => event.startDate ? nightLabel(event.startDate) : "";

/** Somebody to write to, named the way their booking names them. */
export type Holder = {
  profileId: string | null;
  /** What they typed at checkout. Empty on some imported rows. */
  email: string;
  fullName: string;
  reference: string;
};

/**
 * Posted to the address on the booking, not the one on the account.
 *
 * A member can book for somebody else and type their address, which is why the
 * confirmation goes there (`ticket-notify.service.ts`). Everything that
 * happens to that booking afterwards has to follow it, or the person actually
 * coming gets told they have a place and never told it is off.
 *
 * The account is the fallback, for the imported rows that carry no address.
 */
async function post(to: Holder, make: (name?: string) => templates.Email) {
  try {
    const address = to.email.trim() || (await recipient(to.profileId ?? ""))?.email;
    if (!address) return;

    const message = make(to.fullName.trim() || undefined);
    const sent = await sendEmail({ to: address, ...message });
    if (!sent.ok) console.error("event email failed", { subject: message.subject });
  } catch (error) {
    console.error("event email failed", { reference: to.reference, error });
  }
}

/** One ticket holder, when the club takes their place back. */
export async function notifyPlaceCancelled(
  event: EventFacts, to: Holder & { reason: string },
) {
  await post(to, (name) => templates.placeCancelledByClub({
    name,
    clubName: event.clubName,
    eventTitle: event.title,
    reference: to.reference,
    reason: to.reason,
    url: eventUrl(event),
  }));
}

export async function notifyPaymentRecorded(
  event: EventFacts, to: Holder & { howPaid: string; total: string },
) {
  await post(to, (name) => templates.eventPaymentRecorded({
    name,
    clubName: event.clubName,
    eventTitle: event.title,
    reference: to.reference,
    howPaid: to.howPaid,
    total: to.total,
    url: `${siteUrl()}/tickets/${to.reference}`,
  }));
}

/**
 * Everybody holding a ticket, when the event itself is called off.
 *
 * The holders are read before the status is written, because the trigger
 * cancels their bookings: reading afterwards finds nobody with a live place
 * and nobody gets told.
 *
 * Sent one at a time rather than as one message with everybody in the To line,
 * which would hand every attendee the others' addresses.
 */
export async function notifyEventCancelled(
  event: EventFacts, holders: Holder[], reason: string,
) {
  for (const holder of dedupe(holders)) {
    await post(holder, (name) => templates.eventCancelled({
      name,
      clubName: event.clubName,
      eventTitle: event.title,
      when: whenOf(event),
      reason: reason || "The club has cancelled this event.",
      reference: holder.reference,
      url: eventUrl(event),
    }));
  }
}

/**
 * Everybody the cancellation took out, when the club finds another date.
 *
 * Read after the write rather than before, unlike the cancellation: their
 * bookings stay cancelled, so the list is still there to read.
 */
export async function notifyEventBackOn(event: EventFacts, holders: Holder[]) {
  for (const holder of dedupe(holders)) {
    await post(holder, (name) => templates.eventBackOn({
      name,
      clubName: event.clubName,
      eventTitle: event.title,
      when: whenOf(event),
      url: eventUrl(event),
    }));
  }
}

/**
 * One message per address, not per booking.
 *
 * Somebody who booked three times is one person with one inbox, and three
 * identical emails about the same cancellation is the club looking careless.
 */
function dedupe(holders: Holder[]): Holder[] {
  const seen = new Map<string, Holder>();
  for (const holder of holders) {
    const key = holder.email.trim().toLowerCase() || `id:${holder.profileId ?? ""}`;
    if (key !== "id:" && !seen.has(key)) seen.set(key, holder);
  }
  return [...seen.values()];
}
