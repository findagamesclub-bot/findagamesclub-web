import { build, greet, type Email } from "./build";

/**
 * The four emails a listing generates, plus the one that tells us.
 *
 * Legacy sends none of these. Its submission flow files a record and an admin
 * finds it by opening the queue, so somebody who listed their club on a Sunday
 * heard nothing until it appeared. Each of these answers one question a person
 * would otherwise email the contact address to ask.
 */

export function listingReceived(params: {
  name?: string;
  clubName: string;
  url: string;
}): Email {
  return build(`We have your listing for ${params.clubName}`, {
    previewText: "It is with us now. We will email you when somebody has looked at it.",
    eyebrow: "Listing received",
    heading: "Thanks, we have it",
    body: [
      greet(params.name),
      `${params.clubName} is in the queue. Somebody will look at it and we will email you `
        + "either way, usually within a few days.",
      "Nothing else is needed from you for now.",
    ],
    action: { label: "See where it is up to", url: params.url },
  });
}

export function listingChangesRequested(params: {
  name?: string;
  clubName: string;
  note: string;
  url: string;
}): Email {
  return build(`A couple of changes to ${params.clubName}`, {
    previewText: params.note,
    eyebrow: "Changes needed",
    heading: "Nearly there",
    body: [
      greet(params.name),
      `We had a look at ${params.clubName} and there are a couple of things to sort out `
        + "before it can go live.",
      "Open it back up, make the changes and send it again. Everything you typed is still there.",
    ],
    // The note is somebody's own words about this club, so it is quoted rather
    // than dropped into the middle of our prose where it read as boilerplate.
    quote: { label: "What we asked for", text: params.note },
    action: { label: "Open your listing", url: params.url },
  });
}

export function listingApproved(params: {
  name?: string;
  clubName: string;
  url: string;
  consoleUrl: string;
}): Email {
  return build(`${params.clubName} is live`, {
    previewText: "Your club is in the directory.",
    eyebrow: "Listing approved",
    heading: `${params.clubName} is live`,
    body: [
      greet(params.name),
      "Your club page is up and people can find it in the directory.",
      "From here you run everything about the club yourself: your nights, your members, "
        + "your events and your shop. The console is where all of that lives.",
    ],
    action: { label: "Open your club console", url: params.consoleUrl },
    footnote: `Your public page: ${params.url}`,
  });
}

export function listingDeclined(params: {
  name?: string;
  clubName: string;
  reason: string;
  url: string;
}): Email {
  return build(`About your listing for ${params.clubName}`, {
    previewText: params.reason,
    eyebrow: "Listing not approved",
    heading: "We could not list this one",
    body: [
      greet(params.name),
      `We have looked at ${params.clubName} and we are not able to put it in the directory.`,
      // Naming the way back, because there is one now. Reading the reason first
      // is the point of the order here: sending the same listing again unchanged
      // gets the same answer.
      "If the reason below is something you can sort out, you can start again from this "
        + "listing and everything you typed will still be there.",
      "If you think we have this wrong, reply to this email and a person will read it.",
    ],
    quote: { label: "Why", text: params.reason },
    action: { label: "See your listings", url: params.url },
  });
}

/**
 * The one that goes to us rather than to them.
 *
 * Without it the queue is only found by somebody remembering to open it, which
 * is how a listing sits for a fortnight.
 */
export function listingSubmittedAdmin(params: {
  clubName: string;
  city: string;
  ownerName: string;
  url: string;
}): Email {
  return build(`New listing: ${params.clubName}`, {
    previewText: `${params.ownerName} has submitted ${params.clubName}, ${params.city}.`,
    eyebrow: "Waiting for review",
    heading: params.clubName,
    body: [
      `${params.ownerName} has submitted a listing for ${params.clubName}`
        + (params.city ? ` in ${params.city}.` : "."),
      "It is in the queue now.",
    ],
    action: { label: "Review it", url: params.url },
  });
}

/**
 * A club has taken its request back out of the queue.
 *
 * To us, not to them: they know, they did it. Without it an admin part way
 * through reading a listing has no idea it has gone.
 */
export function listingWithdrawnAdmin(params: {
  clubName: string;
  city: string;
  ownerName: string;
  url: string;
}): Email {
  return build(`Withdrawn: ${params.clubName}`, {
    previewText: `${params.ownerName} has taken ${params.clubName} back.`,
    eyebrow: "Nothing left to answer",
    heading: `${params.clubName} was taken back`,
    body: [
      `${params.ownerName} has withdrawn the request for ${params.clubName}`
        + (params.city ? ` in ${params.city}.` : "."),
      "It has left the queue. If they list it again it will come back as a new request.",
    ],
    action: { label: "Open the queue", url: params.url },
  });
}

/**
 * They have answered. Different news from a club arriving.
 *
 * "We have your listing" was sent for both, which read as though nothing had
 * been noticed: somebody who had just spent an evening making the changes we
 * asked for was told their club was in the queue, in the same words as the
 * first time.
 */
export function listingResubmitted(params: {
  name?: string;
  clubName: string;
  url: string;
}): Email {
  return build(`We have your changes to ${params.clubName}`, {
    previewText: "Back with us. We will email you when somebody has looked again.",
    eyebrow: "Changes received",
    heading: "Thanks, we have your changes",
    body: [
      greet(params.name),
      `${params.clubName} is back in the queue with the changes you made. Somebody will `
        + "look again and we will email you either way.",
      "Nothing else is needed from you for now.",
    ],
    action: { label: "See where it is up to", url: params.url },
  });
}

/**
 * The same again to us, and it has to be a different email.
 *
 * "New listing" for a club we had already read and sent back put an admin
 * straight back to the top of a listing they knew, with no hint of what had
 * changed or that they were the one who asked.
 */
export function listingResubmittedAdmin(params: {
  clubName: string;
  city: string;
  ownerName: string;
  url: string;
}): Email {
  return build(`Changes made: ${params.clubName}`, {
    previewText: `${params.ownerName} has made the changes you asked for.`,
    eyebrow: "Back for another look",
    heading: params.clubName,
    body: [
      `${params.ownerName} has made the changes we asked for on ${params.clubName}`
        + (params.city ? ` in ${params.city}.` : "."),
      "It is back in the queue and ready to look at again.",
    ],
    action: { label: "Review it", url: params.url },
  });
}

/**
 * A club has taken its listing out of the directory, or put it back.
 *
 * To us, not to them: they did it, they know. One message to the site contact
 * address rather than one per admin, which is what makes this scale when there
 * are a hundred of us and the bell cannot.
 */
export function clubPausedAdmin(params: {
  clubName: string;
  city: string;
  url: string;
}): Email {
  return build(`Paused: ${params.clubName}`, {
    previewText: `${params.clubName} has taken its listing out of the directory.`,
    eyebrow: "Out of the directory",
    heading: `${params.clubName} has paused`,
    body: [
      `${params.clubName}${params.city ? ` in ${params.city}` : ""} has taken its `
        + "listing out of the directory.",
      "Nobody new can find the club, join it or book a table. Its members keep "
        + "everything, and the club can put it back whenever it likes.",
    ],
    action: { label: "Look at the club", url: params.url },
  });
}

export function clubResumedAdmin(params: {
  clubName: string;
  city: string;
  url: string;
}): Email {
  return build(`Back: ${params.clubName}`, {
    previewText: `${params.clubName} has put its listing back.`,
    eyebrow: "Back in the directory",
    heading: `${params.clubName} is back`,
    body: [
      `${params.clubName}${params.city ? ` in ${params.city}` : ""} has put its `
        + "listing back in the directory.",
      "People can find the club again, join it and book tables.",
    ],
    action: { label: "Look at the club", url: params.url },
  });
}

/**
 * Somebody else took the club out of the directory, or put it back.
 *
 * Only when it was not the club's own doing. An email telling somebody what
 * they did two seconds ago is the product describing them rather than telling
 * them something, and every other notice here follows the same rule.
 */
export function listingPaused(params: {
  name?: string;
  clubName: string;
  url: string;
}): Email {
  return build(`${params.clubName} has been taken out of the directory`, {
    previewText: "Nobody new can find the club at the moment.",
    eyebrow: "Out of the directory",
    heading: `${params.clubName} is not listed at the moment`,
    body: [
      greet(params.name),
      `${params.clubName} has been taken out of the directory. Nobody new can find `
        + "it, join it or book a table.",
      "Your members keep everything: their membership, the board and their bookings "
        + "are exactly as they were, and your console still works.",
      "If this is not what you expected, reply to this email and a person will read it.",
    ],
    action: { label: "Open your listing", url: params.url },
  });
}

export function listingResumed(params: {
  name?: string;
  clubName: string;
  url: string;
}): Email {
  return build(`${params.clubName} is back in the directory`, {
    previewText: "People can find your club again.",
    eyebrow: "Back in the directory",
    heading: `${params.clubName} is listed again`,
    body: [
      greet(params.name),
      `${params.clubName} is back in the directory. People can find it, join it and `
        + "book tables again.",
      "Nothing about the listing changed while it was out.",
    ],
    action: { label: "Open your club page", url: params.url },
  });
}
