import { build, greet, type Email } from "./build";

/**
 * What a club tells the people who bought a ticket.
 *
 * The bell notification is written by a trigger in 0092, inside the same
 * transaction as the cancellation, so it cannot be lost. The email is sent
 * afterwards and best effort: a mail failure must never undo a cancellation
 * that has already happened in the room.
 */

export function eventCancelled(params: {
  name?: string;
  clubName: string;
  eventTitle: string;
  when: string;
  reason: string;
  reference?: string;
  url: string;
}): Email {
  return build(`${params.eventTitle} has been called off`, {
    previewText: params.reason,
    eyebrow: "Event cancelled",
    heading: `${params.eventTitle} is off`,
    body: [
      greet(params.name),
      `${params.clubName} has cancelled ${params.eventTitle}`
        + (params.when ? ` on ${params.when}.` : "."),
      params.reason,
      params.reference
        ? `Your booking ${params.reference} is cancelled with it. `
          + "If you had paid, the club will be in touch about the money."
        : "Your booking is cancelled with it.",
    ],
    action: { label: "See the event", url: params.url },
    footnote: "Questions about a refund go to the club, since they took the payment.",
  });
}

/**
 * A place the club cancelled on somebody's behalf: they rang up, or the club
 * needed the space. Different from a member cancelling their own, which
 * `ticketsCancelled` already covers.
 */
export function placeCancelledByClub(params: {
  name?: string;
  clubName: string;
  eventTitle: string;
  reference: string;
  reason: string;
  url: string;
}): Email {
  return build(`Your place at ${params.eventTitle} has been cancelled`, {
    previewText: `Booking ${params.reference} has been cancelled by the club.`,
    eyebrow: "Booking cancelled",
    heading: "Your place has been cancelled",
    body: [
      greet(params.name),
      `${params.clubName} has cancelled booking ${params.reference} for ${params.eventTitle}.`,
      params.reason || "They did not give a reason.",
      "If that is not what you expected, contact the club. Your place can be booked again "
        + "while tickets are left.",
    ],
    action: { label: "See the event", url: params.url },
  });
}

/** A receipt for money the club has written down as received. */
export function eventPaymentRecorded(params: {
  name?: string;
  clubName: string;
  eventTitle: string;
  reference: string;
  howPaid: string;
  total: string;
  url: string;
}): Email {
  return build(`${params.clubName} has marked your ticket as paid`, {
    previewText: `Booking ${params.reference} is paid.`,
    eyebrow: "Payment recorded",
    heading: "Your ticket is paid",
    body: [
      greet(params.name),
      `${params.clubName} has recorded ${params.total} against booking ${params.reference} `
        + `for ${params.eventTitle}.`,
      params.howPaid,
      "Nothing else to do. Bring the reference on the day.",
    ],
    action: { label: "See your ticket", url: params.url },
  });
}

/**
 * The club found another date.
 *
 * Their old place is not restored, so this is an invitation rather than a
 * confirmation: tickets may have gone elsewhere in the meantime, and putting
 * somebody back into a place and a charge they have not agreed to is worse
 * than asking them to book again.
 */
export function eventBackOn(params: {
  name?: string;
  clubName: string;
  eventTitle: string;
  when: string;
  url: string;
}): Email {
  return build(`${params.eventTitle} is back on`, {
    previewText: "Your old place was not held, so book again to come.",
    eyebrow: "Event back on",
    heading: `${params.eventTitle} is on again`,
    body: [
      greet(params.name),
      `${params.clubName} has put ${params.eventTitle} back on`
        + (params.when ? ` for ${params.when}.` : "."),
      "Your old place was not held when it was called off, so book again if you "
        + "still want to come.",
    ],
    action: { label: "Book a place", url: params.url },
  });
}
