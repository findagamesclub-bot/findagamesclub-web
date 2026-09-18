/**
 * What the database refuses, said to the person who hit it.
 *
 * `TICKET_TYPE_SOLD: 3 of Standard have gone` is the right thing for a trigger
 * to raise and the wrong thing to put on a screen. Each of these turns one
 * into a sentence that says what happened and what to do instead.
 *
 * Null means "not one of ours", which is the service's signal to log the raw
 * message and show its own fallback.
 */

/** The bit after the colon, without a trailing stop so callers add their own. */
function detailOf(raw: string, code: string): string | null {
  const detail = raw.split(`${code}:`)[1]?.trim().replace(/\.$/, "");
  return detail || null;
}

/**
 * The same detail, starting a sentence.
 *
 * Separate from `detailOf` because half of these lead the sentence and half
 * sit inside one, and capitalising in both places produced "out of range:
 * This event has 5 rounds".
 */
const lead = (detail: string) => `${detail[0]?.toUpperCase() ?? ""}${detail.slice(1)}`;

const denied = (raw: string) =>
  raw.includes("NOT_PERMITTED") || raw.includes("row-level security")
  || raw.includes("violates row-level security policy");

export function eventRefusal(raw: string): string | null {
  if (raw.includes("EVENT_HAS_BOOKINGS")) {
    const detail = detailOf(raw, "EVENT_HAS_BOOKINGS");
    return `${detail ? lead(detail) : "Somebody holds a ticket for this"}, so it cannot be deleted. `
      + "Cancel it instead and everybody holding one is told.";
  }
  if (raw.includes("TICKET_TYPE_SOLD")) {
    const detail = detailOf(raw, "TICKET_TYPE_SOLD");
    return `${detail ? lead(detail) : "Some have already gone"}, so that ticket cannot be removed. `
      + "Set how many are left to what has gone to close it.";
  }
  if (raw.includes("TICKET_QUANTITY_BELOW_TAKEN")) {
    const detail = detailOf(raw, "TICKET_QUANTITY_BELOW_TAKEN");
    return `${detail ? lead(detail) : "More have gone than that"}, so there cannot be fewer than that.`;
  }
  if (raw.includes("TICKET_LOCKED")) {
    const detail = detailOf(raw, "TICKET_LOCKED");
    return detail
      ? `${lead(detail)}.`
      : "That ticket has been sold, so its price and who it is for cannot change.";
  }
  if (raw.includes("EVENT_NEEDS_TITLE")) return "Your event needs a name.";
  if (raw.includes("EVENT_NEEDS_DATE")) return "Say which day it starts.";
  if (denied(raw)) return "Only the club can change its events.";
  return null;
}

export function pairingRefusal(raw: string): string | null {
  if (raw.includes("PAIRING_ROUND_OUT_OF_RANGE")) {
    const detail = detailOf(raw, "PAIRING_ROUND_OUT_OF_RANGE");
    return detail ? `That round is out of range: ${detail}.`
                  : "That round is higher than this event has.";
  }
  if (denied(raw)) return "Only the club can change the draw.";
  return null;
}

export function rosterRefusal(raw: string): string | null {
  // The update is matched on the states it is valid from, so a list that
  // loaded a minute ago is the likely cause rather than a permission problem.
  if (denied(raw)) {
    return "That booking has changed since this list loaded. Reload and try again.";
  }
  return null;
}
