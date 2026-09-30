import { build, greet, type Email } from "./build";

/**
 * A saved search that has found something.
 *
 * One message per search per day at most, listing what is new since the last
 * one. Somebody who saved three searches in August would otherwise get three
 * emails a night for ever, which is how a useful feature becomes a spam
 * complaint.
 */
export function eventAlertDigest(params: {
  name?: string;
  label: string;
  events: { title: string; clubName: string; when: string; url: string }[];
  url: string;
}): Email {
  const count = params.events.length;
  const many = count === 1 ? "event" : "events";
  const first = params.events[0]?.title ?? "A new event";

  return build(`${count} new ${many} for "${params.label}"`, {
    // What shows in the inbox list beside the subject. "and 0 more" is the
    // same off-by-one as "1 units", and it is the first thing anybody reads.
    previewText: count > 1
      ? `${first} and ${count - 1} more.`
      : first,
    eyebrow: "Saved search",
    heading: count === 1
      ? `A new event matches "${params.label}"`
      : `${count} new events match "${params.label}"`,
    body: [
      greet(params.name),
      // The whole clause switches, not just the subject: "one event has been
      // listed that match" reads as a typo, and the verb at the end is the
      // part that gets forgotten.
      count === 1
        ? "Since we last wrote, one event has been listed that matches the search you saved."
        : `Since we last wrote, ${count} events have been listed that match the search you saved.`,
    ],
    details: {
      rows: params.events.map((event) => ({
        label: `${event.title} · ${event.clubName}`,
        value: event.when || "Date to come",
      })),
    },
    action: { label: "See them all", url: params.url },
    footnote: "You saved this search on the events page. Change or delete it in your account.",
  });
}

/** A week before a membership runs out. */
export function membershipExpiring(params: {
  name?: string;
  clubName: string;
  endsOn: string;
  url: string;
}): Email {
  return build(`Your ${params.clubName} membership runs out on ${params.endsOn}`, {
    previewText: `It ends on ${params.endsOn}.`,
    eyebrow: "Renewal due",
    heading: `Your ${params.clubName} membership ends on ${params.endsOn}`,
    body: [
      greet(params.name),
      `Renew with the club to keep your member price on tables and tickets, and to keep seeing members-only posts.`,
      `Clubs take payment their own way, so have a word on your next club night or send them a message.`,
    ],
    action: { label: "View your membership", url: params.url },
  });
}

/** And the day after it has. */
export function membershipLapsed(params: {
  name?: string;
  clubName: string;
  url: string;
}): Email {
  return build(`Your ${params.clubName} membership has run out`, {
    previewText: `It ended yesterday. Renewing puts it straight back.`,
    eyebrow: "Membership ended",
    heading: `Your ${params.clubName} membership has run out`,
    body: [
      greet(params.name),
      `You are still on the roster, so nothing is lost. Until it is renewed you pay the visitor price for tables and tickets, and members-only posts are hidden.`,
      `Renewing puts all of it back where it was.`,
    ],
    action: { label: "View your membership", url: params.url },
  });
}
