import { build, greet, type Email } from "./build";

/**
 * What a club hears about money.
 *
 * Legacy sends none of these. Its billing is a mock Stripe checkout that was
 * never wired up, so a club's first news of a lapse was its listing going. Each
 * of these exists because the alternative is somebody finding out by accident.
 *
 * Amounts arrive already formatted. The service reads them from the row, so the
 * figure in the email is the figure that was recorded, never one re-derived
 * from a price that may have changed since.
 */

export function paymentReceived(params: {
  name?: string;
  clubName: string;
  amount: string;
  paidTo: string;
  url: string;
}): Email {
  return build(`Payment received for ${params.clubName}`, {
    previewText: `${params.amount} received. Paid up to ${params.paidTo}.`,
    eyebrow: "Payment received",
    heading: "Thanks, that is received",
    body: [
      greet(params.name),
      `We have recorded ${params.amount} for ${params.clubName}.`,
      `Your listing is paid up to ${params.paidTo}. We will write to you before `
        + "it runs out.",
    ],
    action: { label: "See your billing", url: params.url },
  });
}

export function renewalDue(params: {
  name?: string;
  clubName: string;
  amount: string;
  dueOn: string;
  daysLeft: number;
  url: string;
}): Email {
  const when = params.daysLeft === 1 ? "tomorrow" : `in ${params.daysLeft} days`;
  return build(`${params.clubName} is due ${when}`, {
    previewText: `${params.amount} due on ${params.dueOn}.`,
    eyebrow: "Renewal due",
    heading: `${params.clubName} is due ${when}`,
    body: [
      greet(params.name),
      `Your listing runs out on ${params.dueOn}. It is ${params.amount} to keep it going.`,
      "Nothing happens straight away if it is late: there is a short grace period "
        + "and we will tell you when that is running out too.",
    ],
    action: { label: "How to pay", url: params.url },
  });
}

export function renewalOverdue(params: {
  name?: string;
  clubName: string;
  amount: string;
  graceEnds: string;
  url: string;
}): Email {
  return build(`${params.clubName} is overdue`, {
    previewText: `Still up until ${params.graceEnds}.`,
    eyebrow: "Overdue",
    heading: "This one is overdue",
    body: [
      greet(params.name),
      `${params.clubName} has run out and we have not had ${params.amount} yet.`,
      `Your listing stays exactly as it is until ${params.graceEnds}. A payment any `
        + "time before then and nothing changes at all.",
    ],
    action: { label: "How to pay", url: params.url },
  });
}

export function listingLapsed(params: {
  name?: string;
  clubName: string;
  amount: string;
  hidden: boolean;
  url: string;
}): Email {
  return build(`${params.clubName} has lapsed`, {
    previewText: params.hidden
      ? "It is out of the directory until it is paid."
      : "Still listed, but the subscription has ended.",
    eyebrow: "Lapsed",
    heading: `${params.clubName} has lapsed`,
    body: [
      greet(params.name),
      params.hidden
        ? "The grace period has run out, so your club is out of the directory for "
          + "now. Nobody new can find it."
        : "The grace period has run out and the subscription has ended.",
      "Your members keep everything: their membership, the board and their bookings "
        + "are exactly as they were, and your console still works.",
      `It is ${params.amount} to put it back, and it goes back the same day we have it.`,
    ],
    action: { label: "How to pay", url: params.url },
  });
}

/**
 * The one that goes to us rather than to them.
 *
 * One message to the site contact address, not one per admin, which is the
 * shape that survives a hundred of us.
 */
export function paymentDueAdmin(params: {
  clubName: string;
  amount: string;
  dueOn: string;
  url: string;
}): Email {
  return build(`Overdue: ${params.clubName}`, {
    previewText: `${params.amount} was due on ${params.dueOn}.`,
    eyebrow: "Money owed",
    heading: params.clubName,
    body: [
      `${params.amount} was due on ${params.dueOn} and has not been recorded.`,
      "They have been written to. Record the payment when it arrives and the "
        + "listing goes straight back.",
    ],
    action: { label: "Open billing", url: params.url },
  });
}
