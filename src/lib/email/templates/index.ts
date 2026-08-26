import { renderEmail, renderText, type LayoutOptions } from "./layout";

/**
 * Transactional email copy.
 *
 * Written in the interface's voice: say what happened, say what to do, no
 * apologies and no marketing. Subject lines describe the action, because that
 * is what people scan for in a crowded inbox.
 */

export type Email = { subject: string; html: string; text: string };

function build(subject: string, options: LayoutOptions): Email {
  return { subject, html: renderEmail(options), text: renderText(options) };
}

export function verifyEmail(params: { name?: string; url: string }): Email {
  const greeting = params.name ? `Hello ${params.name},` : "Hello,";
  return build("Confirm your email address", {
    previewText: "One click to finish setting up your FindAGamesClub account.",
    eyebrow: "Confirm your email",
    heading: "Finish setting up your account",
    body: [
      greeting,
      "Confirm this address and you can sign in, join clubs and book a table.",
    ],
    action: { label: "Confirm email address", url: params.url },
    footnote: "This link expires in 24 hours. If you did not create an account, you can ignore this email.",
  });
}

export function resetPassword(params: { name?: string; url: string }): Email {
  const greeting = params.name ? `Hello ${params.name},` : "Hello,";
  return build("Reset your password", {
    previewText: "Choose a new password for your FindAGamesClub account.",
    eyebrow: "Password reset",
    heading: "Choose a new password",
    body: [greeting, "Use the link below to set a new password."],
    action: { label: "Set a new password", url: params.url },
    footnote:
      "This link expires in one hour and can be used once. If you did not ask for it, your password has not changed and no action is needed.",
  });
}

export function welcome(params: { name?: string; url: string }): Email {
  const greeting = params.name ? `Welcome, ${params.name}.` : "Welcome.";
  return build("Welcome to FindAGamesClub", {
    previewText: "Your account is ready. Find a club near you.",
    eyebrow: "Account created",
    heading: "You're in",
    body: [
      greeting,
      "Search by town, by what a club plays, or by how far you'll travel. Club pages show when they meet, whether tables can be booked, and what it costs.",
    ],
    action: { label: "Find a club", url: params.url },
  });
}

export function passwordChanged(params: { name?: string; url: string }): Email {
  const greeting = params.name ? `Hello ${params.name},` : "Hello,";
  return build("Your password was changed", {
    previewText: "The password on your FindAGamesClub account has been changed.",
    eyebrow: "Password changed",
    heading: "Your password was changed",
    body: [
      greeting,
      "The password on your FindAGamesClub account has just been changed. You can sign in with it now.",
    ],
    action: { label: "Sign in", url: params.url },
    // The point of this email is the warning. Someone who did change their own
    // password can ignore it; someone who didn't needs to act.
    footnote:
      "If this wasn't you, reset your password immediately and contact us at hello@findagamesclub.co.uk.",
  });
}

export function emailChanged(params: { name?: string; url: string; newEmail: string }): Email {
  const greeting = params.name ? `Hello ${params.name},` : "Hello,";
  return build("Confirm your new email address", {
    previewText: "Confirm the new address on your FindAGamesClub account.",
    eyebrow: "Email change",
    heading: "Confirm your new address",
    body: [greeting, `Confirm ${params.newEmail} to finish moving your account to it.`],
    action: { label: "Confirm new address", url: params.url },
    footnote: "Until you confirm, your account keeps using the old address.",
  });
}

export function membershipRequested(params: {
  name?: string;
  clubName: string;
  url: string;
}): Email {
  const greeting = params.name ? `Hello ${params.name},` : "Hello,";
  return build(`Your request to join ${params.clubName}`, {
    previewText: `${params.clubName} has your request to join.`,
    eyebrow: "Request sent",
    heading: `Your request is with ${params.clubName}`,
    body: [
      greeting,
      `${params.clubName} has your request to join. Someone from the club will look at it and you will hear back by email.`,
    ],
    action: { label: "View the club", url: params.url },
  });
}

export function membershipApproved(params: {
  name?: string;
  clubName: string;
  tierLabel?: string | null;
  url: string;
}): Email {
  const greeting = params.name ? `Hello ${params.name},` : "Hello,";
  const tier = params.tierLabel ? ` on ${params.tierLabel}` : "";
  return build(`You are now a member of ${params.clubName}`, {
    previewText: `${params.clubName} approved your request.`,
    eyebrow: "Welcome in",
    heading: `You are a member of ${params.clubName}`,
    body: [
      greeting,
      `${params.clubName} approved your request${tier}. You can now book tables, sign up for events and see members-only posts.`,
    ],
    action: { label: "Go to the club", url: params.url },
  });
}

export function membershipDeclined(params: {
  name?: string;
  clubName: string;
  reason?: string | null;
  url: string;
}): Email {
  const greeting = params.name ? `Hello ${params.name},` : "Hello,";
  const body = [
    greeting,
    `${params.clubName} is not able to take your membership request at the moment.`,
  ];
  // Only include a reason when the club actually wrote one. An empty
  // "Reason:" line reads worse than no line at all.
  if (params.reason) body.push(`They said: ${params.reason}`);
  body.push("You are welcome to get in touch with the club directly, or look for another club nearby.");

  return build(`About your request to join ${params.clubName}`, {
    previewText: `An update on your request to join ${params.clubName}.`,
    eyebrow: "Membership update",
    heading: "Your request was not accepted",
    body,
    action: { label: "Find another club", url: params.url },
  });
}

/** To the club, not the applicant. */
export function membershipPendingForOwner(params: {
  clubName: string;
  applicantName: string;
  url: string;
}): Email {
  return build(`${params.applicantName} wants to join ${params.clubName}`, {
    previewText: `A new membership request for ${params.clubName}.`,
    eyebrow: "New request",
    heading: `${params.applicantName} wants to join`,
    body: [
      `${params.applicantName} has asked to join ${params.clubName}.`,
      "Approve or decline the request from your members list.",
    ],
    action: { label: "Review the request", url: params.url },
  });
}

export function tablePromoted(params: {
  name?: string;
  clubName: string;
  night: string;
  time: string;
  gameTitle: string;
  price?: string | null;
  url: string;
}): Email {
  const greeting = params.name ? `Hello ${params.name},` : "Hello,";
  const body = [
    greeting,
    `A table came free at ${params.clubName} and you were next on the list, so it is yours.`,
    // Built from the parts that are actually present: an empty time used to
    // leave a dangling separator reading "Thu 27 Aug, . kill game".
    [
      params.night,
      params.time || null,
      params.gameTitle || null,
      params.price ? `${params.price} a table` : null,
    ].filter(Boolean).join(". ") + ".",
    "You did not have to do anything for this, so if you can no longer make it, please cancel and let the next person have it.",
  ];

  return build(`You have a table at ${params.clubName}`, {
    previewText: `A table came free on ${params.night}.`,
    eyebrow: "Off the waiting list",
    heading: "A table came free",
    body,
    action: { label: "See the booking", url: params.url },
  });
}

export function tableCancelled(params: {
  name?: string;
  clubName: string;
  night: string;
  url: string;
}): Email {
  const greeting = params.name ? `Hello ${params.name},` : "Hello,";
  return build(`Your table at ${params.clubName} is cancelled`, {
    previewText: `Your ${params.night} table has been cancelled.`,
    eyebrow: "Booking cancelled",
    heading: "Your table is cancelled",
    body: [
      greeting,
      `The table you were on at ${params.clubName} on ${params.night} has been cancelled.`,
      "If that was not you, the club or the person who booked it cancelled the game.",
    ],
    action: { label: "Book another night", url: params.url },
  });
}

export function ticketsBooked(params: {
  name?: string;
  clubName: string;
  eventTitle: string;
  when: string;
  reference: string;
  tickets: string;
  total: string;
  url: string;
}): Email {
  const greeting = params.name ? `Hello ${params.name},` : "Hello,";
  return build(`Your place at ${params.eventTitle}`, {
    previewText: `Reference ${params.reference}. ${params.when}.`,
    eyebrow: "Booking confirmed",
    heading: "You are booked in",
    body: [
      greeting,
      `${params.clubName} has your place at ${params.eventTitle}.`,
      [params.when, params.tickets, params.total].filter(Boolean).join(". ") + ".",
      // The reference is the thing they will be asked for on the door, so it is
      // its own line rather than buried in a sentence.
      `Your reference is ${params.reference}.`,
      "Payment is taken by the club on the day. Quote the reference when you arrive.",
    ],
    action: { label: "See your ticket", url: params.url },
    footnote: "If you can no longer make it, cancel from your tickets so somebody else can take the place.",
  });
}

export function ticketsCancelled(params: {
  name?: string;
  clubName: string;
  eventTitle: string;
  reference: string;
  url: string;
}): Email {
  const greeting = params.name ? `Hello ${params.name},` : "Hello,";
  return build(`Your booking for ${params.eventTitle} is cancelled`, {
    previewText: `Booking ${params.reference} has been cancelled.`,
    eyebrow: "Booking cancelled",
    heading: "Your booking is cancelled",
    body: [
      greeting,
      `Booking ${params.reference} for ${params.eventTitle} at ${params.clubName} has been cancelled, and your place has gone back into the pool.`,
      "If that was not you, contact the club — they can cancel a booking too.",
    ],
    action: { label: "See the event", url: params.url },
  });
}
