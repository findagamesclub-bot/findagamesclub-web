import { build, greet, type Email } from "./build";

export function membershipRequested(params: {
  name?: string;
  clubName: string;
  url: string;
}): Email {
  const greeting = greet(params.name);
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
  const greeting = greet(params.name);
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
  const greeting = greet(params.name);
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

export function tierUpgradeForOwner(params: {
  clubName: string;
  memberName: string;
  tierLabel: string;
  url: string;
}): Email {
  return build(`${params.memberName} wants to move to ${params.tierLabel}`, {
    previewText: `A tier change request at ${params.clubName}.`,
    eyebrow: "Tier request",
    heading: `${params.memberName} wants ${params.tierLabel}`,
    body: [
      `${params.memberName} has asked to move to the ${params.tierLabel} tier at ${params.clubName}.`,
      "Change their tier from your members list, or leave it if the answer is no.",
    ],
    action: { label: "Open your members list", url: params.url },
  });
}

/**
 * A receipt for membership money that changed hands offline.
 *
 * Clubs take cash at the door and bank transfers, so this confirms what the
 * club recorded rather than what a card was charged. The period is the point:
 * it is the answer to "how long am I paid up until".
 */
export function membershipPaid(params: {
  name?: string;
  clubName: string;
  tierLabel: string;
  billingLabel: string;
  price: string;
  paidUntil: string | null;
  url: string;
}): Email {
  const rows = [
    { label: "Club", value: params.clubName },
    { label: "Tier", value: params.tierLabel },
    { label: "Paid for", value: params.billingLabel },
  ];
  if (params.paidUntil) rows.push({ label: "Covers you until", value: params.paidUntil });

  return build(`Your ${params.clubName} membership payment`, {
    previewText: `${params.tierLabel}. ${params.price}.`,
    eyebrow: "Payment recorded",
    heading: "Your membership is paid",
    body: [
      greet(params.name),
      `${params.clubName} has recorded your membership payment.`,
      params.paidUntil
        ? "Nothing is taken automatically, so the club will ask you again when this period ends."
        : "This was a one-off fee, so there is nothing further to pay on this tier.",
    ],
    details: { rows, total: { label: "Amount", value: params.price } },
    action: { label: "See your membership", url: params.url },
  });
}

/** An existing member moved onto a different tier. */
export function tierChanged(params: {
  name?: string;
  clubName: string;
  tierLabel: string;
  url: string;
}): Email {
  return build(`You are now on ${params.tierLabel} at ${params.clubName}`, {
    previewText: `Your tier at ${params.clubName} has changed.`,
    eyebrow: "Tier changed",
    heading: `You are on ${params.tierLabel}`,
    body: [
      greet(params.name),
      `${params.clubName} has moved your membership onto the ${params.tierLabel} tier.`,
      "What that tier includes is on the club's page, along with anything there is to pay.",
    ],
    action: { label: "See what it includes", url: params.url },
  });
}
