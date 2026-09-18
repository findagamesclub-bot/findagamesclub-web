/**
 * Reading and checking the event editor.
 *
 * Same shape as `listing-draft.ts`, and for the same reason: the form posts to
 * an endpoint any account can reach, so the browser's own validation is the
 * courtesy and this is the rule.
 *
 * The field set is legacy's `_normalise_events` (club_store.py:14654) and
 * `_normalise_event_ticket_types` (15458). Two of its rules are deliberately
 * not copied, and both are recorded in STAGE3-SPEC.md: a blank ticket quantity
 * quietly meaning nobody can book, and duplicate labels being dropped without
 * telling anybody.
 */

import { externalUrl } from "./external-url";

export type FieldErrors = Partial<Record<string, string>>;
export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export type EventDraft = {
  title: string;
  summary: string;
  price: string;
  roundCount: number | null;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  venueName: string;
  venueAddress: string;
  venuePostcode: string;
  formats: string[];
  eventTypes: string[];
  featuredGames: string[];
  facilities: string[];
  infoBoard: string;
  bestcoastLink: string;
  logoSrc: string;
  logoAlt: string;
  logoPath: string;
};

export const EVENT_STATUSES = ["draft", "published", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const list = (form: FormData, key: string) =>
  form.getAll(key).map((v) => String(v).trim()).filter(Boolean);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/** A real calendar day, not just four digits and two hyphens. */
function isDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
}

function isTime(value: string): boolean {
  if (!TIME.test(value)) return false;
  const [h, m] = value.split(":").map(Number);
  return h! < 24 && m! < 60;
}

export function parseEventDraft(form: FormData): Parsed<EventDraft> {
  const errors: FieldErrors = {};

  const title = text(form, "title");
  if (!title) errors.title = "Your event needs a name.";

  const startDate = text(form, "startDate");
  if (!startDate) errors.startDate = "Say which day it starts.";
  else if (!isDate(startDate)) errors.startDate = "That is not a date we can read.";

  const endDate = text(form, "endDate");
  if (endDate && !isDate(endDate)) errors.endDate = "That is not a date we can read.";
  else if (endDate && startDate && endDate < startDate) {
    errors.endDate = "The last day cannot be before the first.";
  }

  const startTime = text(form, "startTime");
  if (startTime && !isTime(startTime)) errors.startTime = "Use a 24 hour time, like 19:00.";

  const endTime = text(form, "endTime");
  if (endTime && !isTime(endTime)) errors.endTime = "Use a 24 hour time, like 22:30.";
  // Only on a one-day event. An overnight that finishes at 02:00 the next day
  // is a real thing a club runs, and the dates already say so.
  else if (endTime && startTime && (!endDate || endDate === startDate) && endTime <= startTime) {
    errors.endTime = "It has to finish after it starts.";
  }

  let roundCount: number | null = null;
  const rounds = text(form, "roundCount");
  if (rounds) {
    const n = Number(rounds);
    if (!Number.isInteger(n) || n < 0 || n > 50) {
      errors.roundCount = "Rounds has to be a whole number, up to 50.";
    } else roundCount = n;
  }

  const bestcoastLink = text(form, "bestcoastLink");
  if (bestcoastLink && !externalUrl(bestcoastLink)) {
    errors.bestcoastLink = "That does not look like a web address.";
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      title, summary: text(form, "summary"), price: text(form, "price"), roundCount,
      startDate, startTime, endDate, endTime,
      venueName: text(form, "venueName"),
      venueAddress: text(form, "venueAddress"),
      venuePostcode: text(form, "venuePostcode").toUpperCase(),
      formats: list(form, "formats"),
      eventTypes: list(form, "eventTypes"),
      featuredGames: list(form, "featuredGames"),
      facilities: list(form, "facilities"),
      infoBoard: text(form, "infoBoard"),
      // Stored as typed; `externalUrl` puts the scheme on at render time, the
      // way every other club link in the app is handled.
      bestcoastLink,
      logoSrc: text(form, "logoSrc"),
      logoAlt: text(form, "logoAlt"),
      logoPath: text(form, "logoPath"),
    },
  };
}

/**
 * What an event needs before the public can see it.
 *
 * Draft is the state where a club is still writing, so nothing is required
 * there. These are checked on the way to published.
 */
export function publishRefusal(draft: EventDraft): string | null {
  if (!draft.title) return "Your event needs a name before you publish it.";
  if (!draft.startDate) return "Say which day it starts before you publish it.";
  return null;
}
