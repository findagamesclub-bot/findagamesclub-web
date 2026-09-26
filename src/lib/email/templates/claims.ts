import { build, greet, type Email } from "./build";

/**
 * Somebody saying a listing is theirs.
 *
 * Nothing like this exists in legacy, which has no claim flow at all. The
 * wording follows the listing emails on purpose: a claim is a request, and a
 * request that goes unanswered is the same problem whichever queue it is in.
 */

export function claimReceived(params: {
  name?: string;
  clubName: string;
  url: string;
}): Email {
  return build(`We have your claim for ${params.clubName}`, {
    previewText: "We will email you either way.",
    eyebrow: "Claim received",
    heading: "Thanks, we have it",
    body: [
      greet(params.name),
      `Somebody will read what you sent about ${params.clubName} and we will email `
        + "you either way, usually within a few days.",
      "Nothing else is needed from you for now.",
    ],
    action: { label: "See the club", url: params.url },
  });
}

export function claimApproved(params: {
  name?: string;
  clubName: string;
  consoleUrl: string;
  url: string;
}): Email {
  return build(`${params.clubName} is yours`, {
    previewText: "The console is yours from here.",
    eyebrow: "Claim approved",
    heading: `${params.clubName} is yours`,
    body: [
      greet(params.name),
      "We have handed the listing over. From here you run everything about the "
        + "club yourself: your nights, your members, your events and your shop.",
      "The first thing worth doing is checking the listing is right, because it "
        + "was written without you.",
    ],
    action: { label: "Open your club console", url: params.consoleUrl },
    footnote: `Your public page: ${params.url}`,
  });
}

export function claimDeclined(params: {
  name?: string;
  clubName: string;
  reason: string;
}): Email {
  return build(`About your claim for ${params.clubName}`, {
    previewText: params.reason,
    eyebrow: "Claim not approved",
    heading: "We could not hand this one over",
    body: [
      greet(params.name),
      `We have looked at your claim for ${params.clubName} and we are not able to `
        + "hand it over.",
      "If you think we have this wrong, reply to this email and a person will read it.",
    ],
    quote: { label: "Why", text: params.reason },
  });
}

/** And the one that tells us somebody is waiting. */
export function claimSubmittedAdmin(params: {
  clubName: string;
  city: string;
  claimantName: string;
  url: string;
}): Email {
  return build(`Claim: ${params.clubName}`, {
    previewText: `${params.claimantName} says ${params.clubName} is theirs.`,
    eyebrow: "Waiting for an answer",
    heading: params.clubName,
    body: [
      `${params.claimantName} says ${params.clubName}`
        + (params.city ? ` in ${params.city}` : "") + " is theirs.",
      "Read what they sent and hand the club over, or turn it down with a reason.",
    ],
    action: { label: "Read the claim", url: params.url },
  });
}
