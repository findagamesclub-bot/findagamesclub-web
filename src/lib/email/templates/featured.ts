import { build, greet, type Email } from "./build";

/**
 * What a club hears about the front page.
 *
 * Legacy has no featured slot at all, so there is nothing to copy. Each of
 * these exists because 0113 shipped the slot and told nobody: an admin put a
 * club on the homepage and the owner found out by visiting their own site.
 *
 * Dates arrive already formatted, like the amounts in `billing.ts`, so the day
 * in the email is the day on the row rather than one re-derived here.
 */

export function featuredBooked(params: {
  name?: string;
  clubName: string;
  from: string;
  to: string;
  amount: string;
  live: boolean;
  url: string;
}): Email {
  return build(`${params.clubName} is going on the front page`, {
    previewText: params.live
      ? `Live now, until ${params.to}.`
      : `From ${params.from} to ${params.to}.`,
    eyebrow: "Featured",
    heading: params.live
      ? `${params.clubName} is on the front page`
      : `${params.clubName} is booked onto the front page`,
    body: [
      greet(params.name),
      params.live
        ? `Your club leads the homepage from today until ${params.to}.`
        : `Your club leads the homepage from ${params.from} to ${params.to}.`,
      `The slot is ${params.amount}. It ends on its own, so there is nothing `
        + "for you to take down, and we will write to you when it does.",
    ],
    action: { label: "See your club page", url: params.url },
  });
}

export function featuredEnded(params: {
  name?: string;
  clubName: string;
  from: string;
  to: string;
  url: string;
}): Email {
  return build(`${params.clubName} has come off the front page`, {
    previewText: `The slot ran from ${params.from} to ${params.to}.`,
    eyebrow: "Featured slot ended",
    heading: "That slot has finished",
    body: [
      greet(params.name),
      `${params.clubName} was featured on the homepage from ${params.from} to `
        + `${params.to}, and that slot has now ended.`,
      "Nothing else changes. Your listing, your members and your events are "
        + "exactly as they were, and you can book another slot any time.",
    ],
    action: { label: "See your club page", url: params.url },
  });
}

/**
 * The undo, which is news as well.
 *
 * Only sent for a slot that was live or still to come. Tidying a slot that
 * finished weeks ago is housekeeping, and the owner was told when it ended.
 */
export function featuredRemoved(params: {
  name?: string;
  clubName: string;
  to: string;
  url: string;
}): Email {
  return build(`${params.clubName} has come off the front page`, {
    previewText: `It was due to run until ${params.to}.`,
    eyebrow: "Featured slot removed",
    heading: "That slot has been taken down",
    body: [
      greet(params.name),
      `The featured slot for ${params.clubName} has been removed. It was due to `
        + `run until ${params.to}.`,
      "If that is not what you expected, reply to this and we will sort it out.",
    ],
    action: { label: "See your club page", url: params.url },
  });
}
