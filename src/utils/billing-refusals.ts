/**
 * What the database refuses around money and claims, in plain words.
 *
 * Same shape as `submission-refusals.ts`: the function raises a code, this
 * turns it into a sentence that says what happened and what to do next. Pure,
 * so the wording can be checked without a database.
 */
const MESSAGES: [string, string][] = [
  ["PAYMENT_NEEDS_AMOUNT", "Put in how much was paid."],
  ["SUBSCRIPTION_NOT_FOUND", "That subscription is not here any more."],
  ["SUBSCRIPTION_CANCELLED",
   "This subscription is closed, so a payment cannot be added to it."],
  ["SUBSCRIPTION_NEEDS_OWNER", "That listing has nobody to bill."],
  ["LISTING_NOT_PAID",
   "This one cannot go live until its subscription is paid. Record the payment first."],
  ["FEATURED_OVERLAPS",
   "This club already holds a slot over those days. End that one first, or pick other dates."],
  ["FEATURED_BAD_DATES", "The end date is before the start date."],
  ["CLUB_NOT_FOUND", "That club is not here any more."],
  ["CLUB_HAS_OWNER",
   "This club already has an owner, so it is not up for claim. Transfer it from the team page instead."],
  ["CLUB_NEEDS_NAME", "Give the club a name."],
  ["CLUB_NEEDS_CITY", "Say which town or city it is in."],
  ["CLAIM_NOT_FOUND", "That claim is not here any more."],
  ["CLAIM_ALREADY_ANSWERED",
   "Somebody has already answered this one. Reload to see where it got to."],
  ["CLAIM_NEEDS_REASON", "Give a reason. It is what they will be told."],
];

export function billingRefusal(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");

  const match = MESSAGES.find(([code]) => raw.includes(code));
  if (match) return match[1];

  if (raw.includes("NOT_PERMITTED") || raw.includes("row-level security")
      || raw.includes("insufficient_privilege")) {
    return "That is not yours to change.";
  }

  // A second open claim on the same club, which the unique index refuses.
  if (raw.includes("club_claims_one_open") || raw.includes("duplicate key")) {
    return "You already have a claim in on this club. We will come back to you.";
  }

  const detail = process.env.NODE_ENV === "development" && raw ? ` [${raw}]` : "";
  return `That did not work. Try again, and tell us if it keeps happening.${detail}`;
}
