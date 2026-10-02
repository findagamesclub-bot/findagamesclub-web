/**
 * The forty-five notification kinds, grouped into six families.
 *
 * Forty-five switches is a settings page nobody finishes, and a preference
 * table keyed on kind needs a migration every time a feature adds one. So the
 * preference is per family, and the map lives here rather than in SQL because
 * it is a product decision about what belongs with what, not a data rule.
 *
 * **A kind nobody mapped defaults to on.** `familyFor` answers null and every
 * caller treats null as "send it". A feature added next year is then noisy
 * rather than silently muted, which is the failure that is noticed and fixed
 * instead of the one that is not.
 */

export const FAMILIES = [
  "replies", "bookings", "membership", "events", "running", "money",
] as const;

export type Family = (typeof FAMILIES)[number];

export type FamilyMeta = {
  label: string;
  detail: string;
  /** Email cannot be turned off. Only `replies` is locked, and it says why. */
  locked?: string;
  /** Whether email is on for somebody who has never touched this screen. */
  emailByDefault: boolean;
};

export const FAMILY_META: Record<Family, FamilyMeta> = {
  replies: {
    label: "Replies to things you did",
    detail: "Someone answered your message, or a report you filed was decided.",
    locked: "Always on. If you ask a question and never hear the answer, the site has let you down rather than your settings.",
    emailByDefault: true,
  },
  bookings: {
    label: "Your bookings and tickets",
    detail: "Tables, event tickets, coaching and shop orders you have placed.",
    emailByDefault: true,
  },
  membership: {
    label: "Your clubs",
    detail: "Joining, membership tiers, badges, rivalries, team invitations and replies on a club board.",
    emailByDefault: false,
  },
  events: {
    label: "Events you are going to",
    detail: "An event being called off or put back on, and saved event alerts.",
    emailByDefault: true,
  },
  running: {
    label: "Running a club",
    detail: "Listing decisions, claims and reported content. Only reaches you if you help run a club or the site.",
    emailByDefault: false,
  },
  money: {
    label: "Payments and renewals",
    detail: "Subscription reminders, overdue notices and anything that costs money.",
    emailByDefault: true,
  },
};

const MAP = {
  // Somebody answered you.
  message: "replies",
  "report-answered": "replies",
  result_state: "replies",

  // Something you booked or bought.
  table_booked: "bookings",
  booked_in: "bookings",
  booking_cancelled: "bookings",
  waitlist_promoted: "bookings",
  tickets_booked: "bookings",
  tickets_cancelled: "bookings",
  "ticket-paid": "bookings",
  "ticket-unpaid": "bookings",
  "ticket-refunded": "bookings",
  "ticket-checked-in": "bookings",
  "ticket-cancelled-by-club": "bookings",
  coaching_booked: "bookings",
  // Emails with no bell twin. The club is told by a trigger; the person who
  // did the thing is told by email alone, so the kind exists only here.
  //
  // Ticket receipts are deliberately absent: they go to the address typed at
  // checkout, which may belong to somebody with no account and so no
  // preference to honour. A kind here that nothing sends would still be
  // counted on the settings card, which is the one number making the grouping
  // credible.
  "booking-confirmed": "bookings",
  "booking-cancelled-yours": "bookings",
  order: "bookings",
  result_recorded: "bookings",

  // Your standing at a club.
  membership: "membership",
  // Both board kinds, and deliberately not in "replies". That family cannot be
  // switched off, and a thread with thirty replies would then send the author
  // thirty emails they could do nothing about. Club activity, opt in.
  "board-reply-yours": "membership",
  "board-reply-joined": "membership",
  "membership-requested": "membership",
  tier: "membership",
  tier_request: "membership",
  join_request: "membership",
  "badge-awarded": "membership",
  "badge-taken-back": "membership",
  rival: "membership",
  team_invite: "membership",
  team_role: "membership",
  game_found: "membership",
  looking_for_game: "membership",

  // Something you are going to.
  "event-cancelled": "events",
  "event-back-on": "events",
  "event-alert": "events",

  // Work, for somebody who runs a club or the site.
  "club-request": "running",
  "club-request-updated": "running",
  "club-request-withdrawn": "running",
  "club-claim": "running",
  "claim-approved": "running",
  "claim-declined": "running",
  "content-reported": "running",
  "listing-approved": "running",
  "listing-changes-needed": "running",
  "listing-declined": "running",
  "listing-paused": "running",
  "listing-resumed": "running",
  order_placed: "running",

  // Money, which is the one family nobody should miss.
  "club-request-unpaid": "money",
  "listing-payment-received": "money",
  // A receipt for money the member actually paid. It shared the generic
  // `membership` kind, so turning "Your clubs" off silenced a £120 receipt,
  // which is the one thing in that family nobody would expect to lose.
  "membership-paid": "money",
  // A renewal reminder is money, and "renewals" is in this family's own name.
  // Filed under "Your clubs" it was muted alongside badges and rivalries, so
  // somebody who did not care about badges stopped hearing that their
  // membership was about to lapse.
  membership_expiring: "money",
  "membership-lapsed": "money",
  "listing-renewal-due": "money",
  "listing-overdue": "money",
  "listing-lapsed": "money",
  // A featured slot is dated and priced, so it belongs with the money rather
  // than under "Running a club", where email is off by default and a club
  // would have paid for a slot and heard nothing. Three kinds for one row,
  // because `notify_person` de-duplicates on the kind and the ending would
  // otherwise rewrite the booking notice in place (0104, 0112, 0126).
  "featured-booked": "money",
  "featured-ended": "money",
  "featured-removed": "money",
} satisfies Record<string, Family>;

/**
 * Every kind a TypeScript sender may name.
 *
 * Deliberately a union rather than `string`: a sender that invents a kind, or
 * misspells one, is then a compile error rather than an email that quietly
 * ignores the member's preference. Kinds sent only from SQL triggers are in the
 * map too, so the switch governs them as well.
 */
export type NotificationKind = keyof typeof MAP;

/** Null for a kind nobody has mapped, which every caller reads as "send it". */
export function familyFor(kind: string): Family | null {
  const key = String(kind ?? "").trim() as NotificationKind;
  return MAP[key] ?? null;
}

/** Every kind this family covers, for the screen and for the test. */
export function kindsIn(family: Family): string[] {
  return Object.keys(MAP)
    .filter((kind) => MAP[kind as NotificationKind] === family)
    .sort();
}

/** Every kind in the map, for the test that walks the codebase. */
export function allKinds(): string[] {
  return Object.keys(MAP).sort();
}

/** What a member sees before they have ever opened the screen. */
export function defaultsFor(family: Family): { bell: boolean; email: boolean } {
  return { bell: true, email: FAMILY_META[family].emailByDefault };
}

/**
 * Which families this person gets no email about.
 *
 * **A missing row is a default, not an absence.** Two families default to email
 * off, so reading only the rows that say `email = false` misses everybody who
 * has never opened the settings screen, which is almost everybody. That bug
 * shipped: the card read "off" because it applied the default, the sender read
 * "on" because it saw no row, and the email went out anyway.
 *
 * So this is the only place either side asks, and it takes the saved rows
 * rather than doing the read, which is what makes it testable.
 */
export function emailOffFamilies(
  saved: { family: string; email: boolean }[],
): Set<Family> {
  const held = new Map(saved.map((row) => [row.family, row.email]));
  const off = new Set<Family>();

  for (const family of FAMILIES) {
    // A locked family is on whatever is stored, so the screen and the sender
    // cannot disagree about it either.
    if (FAMILY_META[family].locked) continue;
    if (!(held.get(family) ?? defaultsFor(family).email)) off.add(family);
  }
  return off;
}
