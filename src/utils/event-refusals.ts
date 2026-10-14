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
  if (raw.includes("TEAM_PLAYER_WRONG_SIDE")) {
    return "That player is in the other team. The left-hand side of a table "
      + "is always the first team named on the fixture.";
  }
  if (denied(raw)) return "Only the club can change the draw.";
  return null;
}

export function teamRefusal(raw: string): string | null {
  if (raw.includes("club_event_teams_one_name")) {
    return "This event already has a team with that name. Give it a different one.";
  }
  if (raw.includes("club_event_team_players_one_account")
      || raw.includes("club_event_team_players_one_name")) {
    return "That player is already in another team at this event. "
      + "Take them out of that one first.";
  }
  if (raw.includes("club_event_teams_name_len")) {
    return "A team name is between 1 and 60 characters.";
  }
  if (raw.includes("club_event_team_players_somebody")) {
    return "A player needs a name, or an account to take the name from.";
  }
  return pairingRefusal(raw);
}

export function rosterRefusal(raw: string): string | null {
  // Adding somebody to the list goes through the same three guards a member's
  // own checkout does, so these are the sentences for them. Specific first:
  // `TICKET_NOT_ELIGIBLE` is raised as `insufficient_privilege`, which the
  // catch-all below would otherwise answer with "reload and try again" about
  // a rule that reloading will not change.
  if (raw.includes("TICKET_NOT_ELIGIBLE")) {
    return "They cannot have that ticket. It is members only, or it needs a tier "
      + "they are not on. Pick one that is open to everybody, or approve their "
      + "membership first.";
  }
  if (raw.includes("TICKETS_SOLD_OUT")) {
    return "There are not that many of that ticket left. Check what is still "
      + "available and try a smaller number.";
  }
  if (raw.includes("EVENT_CANCELLED")) {
    return "This event has been called off, so nobody else can be put on the list.";
  }
  if (raw.includes("EVENT_NOT_ON_SALE")) {
    return "This event is not on sale, so nobody else can be put on the list.";
  }
  if (raw.includes("EVENT_FINISHED")) {
    return "This event has been and gone, so nobody else can be added to it.";
  }
  if (raw.includes("NAME_REQUIRED")) {
    return "A place needs a name on it, so you know who to call up on the day.";
  }
  if (raw.includes("EMAIL_REQUIRED")
      || raw.includes("club_event_bookings_email_check")) {
    return "A place needs an address on it. Everything about a booking is "
      + "posted to it, so a place with nowhere to write to cannot be told if "
      + "the event is called off. Name a member and their own account address "
      + "is used, or type one in.";
  }
  if (raw.includes("BOOKING_LINK_NOT_ALLOWED")) {
    return "That account is nobody at your club yet, so it needs their member "
      + "code. They find it on their own profile page and it works whichever "
      + "club they belong to.";
  }
  if (raw.includes("BOOKING_NOT_FOUND")) {
    return "That booking is not on this event any more. Reload and try again.";
  }
  if (raw.includes("TICKET_NOT_FOUND")) {
    return "That ticket is not on this event any more. Reload and try again.";
  }

  // The update is matched on the states it is valid from, so a list that
  // loaded a minute ago is the likely cause rather than a permission problem.
  if (denied(raw)) {
    return "That booking has changed since this list loaded. Reload and try again.";
  }
  return null;
}
