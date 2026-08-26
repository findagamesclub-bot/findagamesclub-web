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
];

export function checkoutError(raw: string): string {
  const match = MESSAGES.find(([code]) => raw.includes(code));
  return match ? match[1] : "Could not complete that booking. Try again.";
}
