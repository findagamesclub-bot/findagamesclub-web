/**
 * Postgres raises these by name from checkout_event_cart and its triggers.
 * Turning them into sentences here keeps the mapping in one testable place, and
 * out of the service's control flow.
 *
 * Every message names what happened and what to do next — never "an error
 * occurred", which tells somebody holding a full cart nothing at all.
 */
const MESSAGES: [string, string][] = [
  ["TICKETS_SOLD_OUT", "Somebody took the last of those while you were deciding."],
  ["EVENT_FINISHED", "Tickets are no longer available because this event has finished."],
  // The desk already says why per ticket, so this only shows when standing
  // changed between adding to the cart and checking out.
  ["TICKET_NOT_ELIGIBLE",
   "One of those tickets is not open to you any more. Check your membership and try again."],
  ["CART_EMPTY", "Add at least one ticket before checking out."],
  ["NOT_SIGNED_IN", "Sign in to book tickets."],
  ["EVENT_NOT_FOUND", "That event no longer exists."],
  // Raised by the redemption half of checkout_event_cart (0050). Worded as the
  // table booking desk words them, because it is the same refusal.
  ["NOT_ENOUGH_POINTS", "You do not have that many points."],
  ["OVER_REDEMPTION_CAP",
   "Points cannot cover that much of this order. Lower the number and try again."],
  ["NO_REDEMPTION",
   "Loyalty points can only be used by approved members of this club."],
];

export function checkoutError(raw: string): string {
  const match = MESSAGES.find(([code]) => raw.includes(code));
  if (match) return match[1];

  // Anything unrecognised is a bug, not a refusal we planned for. It reached a
  // member as "try again", and trying again did the same thing forever.
  console.error("[checkout] unexpected refusal:", raw);
  return "Could not complete that booking. Try again.";
}
