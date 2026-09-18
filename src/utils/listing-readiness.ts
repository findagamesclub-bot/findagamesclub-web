/**
 * Is this listing finished?
 *
 * A transcription of legacy's `refreshGuidedListingProgress`
 * (clubs-v2/src/main.js:11684) and the review items it drives, down to the
 * wording. Legacy computes this from the DOM on every keystroke, which is why
 * its checklist is wrong after a refresh; this takes saved data instead, so the
 * answer is the same whoever asks and whenever.
 */

export type CheckKey =
  | "profile" | "venue" | "contact" | "capacity"
  | "content" | "pricing" | "schedule" | "subscription";

export type Check = {
  key: CheckKey;
  /** The heading legacy gives it on the review step. */
  label: string;
  /** What it wants, in legacy's words. */
  wants: string;
  ready: boolean;
  /** The line under it, which changes as it fills up. */
  note: string;
  /** Fields answered, and fields asked for. The note is these two in words. */
  done: number;
  total: number;
};

/**
 * Legacy checks a schedule row for a day, a start, an end and a label. Our
 * `club_sessions` has carried the time as one string since milestone 1, so
 * there is no start and end to check separately: the same intent, over the
 * three fields we actually store.
 */
export type ListingSession = {
  day?: string | null;
  time?: string | null;
  label?: string | null;
};

export type ReadinessInput = {
  name?: string | null;
  city?: string | null;
  summary?: string | null;
  description?: string | null;
  formats?: string[];

  venueName?: string | null;
  postcode?: string | null;
  venueAddress?: string | null;
  website?: string | null;

  contactEmail?: string | null;

  ages?: string | null;
  memberCount?: number | null;
  tablesAvailable?: number | null;

  featuredGames?: string[];
  facilities?: string[];
  paymentMethods?: string[];

  /** A billing option on the basic tier, switched on and priced. */
  basicMembershipPriced?: boolean;
  /** Six settings filled and one earning tier named. */
  loyaltyReady?: boolean;

  sessions?: ListingSession[];

  /**
   * Submissions only. A club that already exists has no plan to choose, so the
   * eighth check does not apply to it and is left out rather than failed.
   */
  plan?: { chosen: boolean } | null;
};

/**
 * Legacy reads every field as a trimmed string, so `0` is filled rather than
 * empty: a club that says it has no tables has answered the question. An empty
 * list is not an answer, though, which is why arrays are asked about their
 * length and numbers are not.
 */
const filled = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && String(value).trim() !== "";
};

const someOf = (values: unknown[]) => values.filter(filled).length;

const partial = (done: number, total: number) =>
  done === total ? "Complete" : `${done} of ${total} required fields completed`;

export function listingChecks(input: ReadinessInput): Check[] {
  const profile = [input.name, input.city, input.formats, input.summary, input.description];
  const venue = [input.venueName, input.postcode, input.venueAddress, input.website];
  const capacity = [input.ages, input.memberCount, input.tablesAvailable];
  const content = [input.featuredGames, input.facilities, input.paymentMethods];

  const profileDone = someOf(profile);
  const venueDone = someOf(venue);
  const capacityDone = someOf(capacity);
  const contentDone = someOf(content);
  const contactReady = filled(input.contactEmail);
  // Two answers, not one: a club that has priced the basic tier and not set up
  // points is halfway, and a check that only says "no" cannot show that.
  const pricingDone = (input.basicMembershipPriced ? 1 : 0) + (input.loyaltyReady ? 1 : 0);
  const pricingReady = pricingDone === 2;

  // Every row complete, and at least one row. A schedule of one empty row is
  // not a schedule.
  const sessions = input.sessions ?? [];
  const scheduleReady = sessions.length > 0
    && sessions.every((s) => filled(s.day) && filled(s.time) && filled(s.label));

  const checks: Check[] = [
    { key: "profile", label: "Club profile",
      wants: "Club name, city, formats, summary, and description",
      ready: profileDone === profile.length, note: partial(profileDone, profile.length),
      done: profileDone, total: profile.length },
    { key: "venue", label: "Venue",
      wants: "Venue name, postcode, address, and website",
      ready: venueDone === venue.length, note: partial(venueDone, venue.length),
      done: venueDone, total: venue.length },
    { key: "contact", label: "Contact",
      wants: "A public contact email",
      ready: contactReady, note: contactReady ? "Complete" : "Add a public contact email",
      done: contactReady ? 1 : 0, total: 1 },
    { key: "capacity", label: "Capacity and age guidance",
      wants: "Ages, member count, and tables per session",
      ready: capacityDone === capacity.length, note: partial(capacityDone, capacity.length),
      done: capacityDone, total: capacity.length },
    { key: "content", label: "Discovery content",
      wants: "Featured games, facilities, and payment methods",
      ready: contentDone === content.length, note: partial(contentDone, content.length),
      done: contentDone, total: content.length },
    { key: "pricing", label: "Membership and loyalty",
      wants: "Set the basic membership fee and loyalty programme",
      ready: pricingReady,
      note: pricingReady
        ? "Basic membership and loyalty programme complete"
        : "Set the basic membership fee and loyalty programme",
      done: pricingDone, total: 2 },
    { key: "schedule", label: "Schedule and activity",
      wants: "Sessions, notices, events, and competitions are optional",
      ready: scheduleReady,
      note: scheduleReady ? "Opening rhythm complete" : "Complete every opening-rhythm row",
      done: scheduleReady ? 1 : 0, total: 1 },
  ];

  // The eighth only exists for a submission.
  if (input.plan !== undefined && input.plan !== null) {
    checks.push({
      key: "subscription", label: "Listing subscription",
      wants: "Choose a monthly or yearly plan",
      ready: input.plan.chosen,
      note: input.plan.chosen ? "Ready for payment and admin review" : "Choose monthly or yearly",
      done: input.plan.chosen ? 1 : 0, total: 1,
    });
  }

  return checks;
}

/** "3 of 8 required checks ready", in legacy's words. */
export function readinessSummary(checks: Check[]): string {
  const done = checks.filter((c) => c.ready).length;
  return `${done} of ${checks.length} required checks ready`;
}

/**
 * Fields answered across every check.
 *
 * A finer figure than the check count: "18 of 19" says a club is one box from
 * done, where "5 of 7 checks" makes the same listing look half built.
 */
export function readinessFields(checks: Check[]): { done: number; total: number } {
  return {
    done: checks.reduce((n, c) => n + c.done, 0),
    total: checks.reduce((n, c) => n + c.total, 0),
  };
}

/** 0 to 1, for the track under the stepper. */
export function readinessFraction(checks: Check[]): number {
  if (!checks.length) return 0;
  return checks.filter((c) => c.ready).length / checks.length;
}

/**
 * The line under each step in the stepper, again in legacy's words.
 *
 * Step 1 counts thirteen fields, not five: legacy's first step carries the
 * profile, the venue, the contact and the capacity checks between them.
 */
/**
 * Whether each step is actually finished.
 *
 * Its own answer rather than something read back out of the sentence above.
 * The stepper used to decide by testing whether the status text ended in the
 * word "complete", which made "Core details: 0/13 complete" a finished step and
 * put a tick on an empty listing. A boolean is not a thing to infer from a
 * sentence that happens to contain it.
 */
export function stepDone(input: ReadinessInput): Record<number, boolean> {
  const checks = listingChecks(input);
  const by = (key: CheckKey) => checks.find((c) => c.key === key);

  const core = [by("profile"), by("venue"), by("contact"), by("capacity")];

  return {
    1: core.every((check) => check?.ready === true),
    2: by("content")?.ready === true,
    3: by("pricing")?.ready === true,
    4: by("schedule")?.ready === true,
    // The last step is the report, not a thing to finish. It ticks when
    // everything it reports on is done.
    5: checks.every((check) => check.ready),
  };
}

export function stepStatus(input: ReadinessInput): Record<number, string> {
  const checks = listingChecks(input);
  const by = (key: CheckKey) => checks.find((c) => c.key === key);

  const core =
    someOf([input.name, input.city, input.formats, input.summary, input.description])
    + someOf([input.venueName, input.postcode, input.venueAddress, input.website])
    + (filled(input.contactEmail) ? 1 : 0)
    + someOf([input.ages, input.memberCount, input.tablesAvailable]);

  const contentDone = someOf([input.featuredGames, input.facilities, input.paymentMethods]);

  return {
    1: `Core details: ${core}/13 complete`,
    2: `Content: ${contentDone}/3 complete`,
    3: by("pricing")?.ready ? "Required setup complete" : "Membership fee required",
    4: by("schedule")?.ready ? "Opening rhythm complete" : "Opening rhythm required",
    5: by("subscription") ? (by("subscription")!.ready ? "Ready" : "Choose plan") : "Listing health",
  };
}
