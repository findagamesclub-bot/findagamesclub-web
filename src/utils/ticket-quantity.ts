/**
 * How many of a ticket type somebody may hold.
 *
 * Pure, because three places have to agree about it: the stepper on the event,
 * the stepper in the drawer, and the service that writes the cart line. When
 * only the first of those knew the rule, a drawer opened on a ticket with one
 * place left happily counted to three, and the refusal did not arrive until
 * checkout.
 *
 * The database is still the authority. `checkout_event_cart` locks the ticket
 * type and counts what has actually gone, because between this running and the
 * reserve landing somebody else can take the last place. This is the same rule
 * said early enough to be useful.
 */

/** Legacy's own ceiling on a single line, kept. */
export const MAX_PER_LINE = 20;

export type Allowed = { quantity: number; refusal: string | null };

export function allowedQuantity(
  wanted: number,
  /** What is left to book. Null when the club capped nothing. */
  remaining: number | null,
  label = "that ticket",
): Allowed {
  const asked = Math.max(0, Math.floor(Number(wanted) || 0));

  // Zero is how a stepper says "take it out", not a refusal.
  if (asked === 0) return { quantity: 0, refusal: null };

  if (remaining !== null && remaining <= 0) {
    return { quantity: 0, refusal: `${label} has sold out.` };
  }

  if (remaining !== null && asked > remaining) {
    return {
      quantity: remaining,
      refusal: remaining === 1
        ? `Only one ${label} is left, so that is what you have.`
        : `Only ${remaining} of ${label} are left, so that is what you have.`,
    };
  }

  if (asked > MAX_PER_LINE) {
    return {
      quantity: MAX_PER_LINE,
      refusal: `${MAX_PER_LINE} is the most of one ticket you can book at once. `
        + "Ask the club if you need more.",
    };
  }

  return { quantity: asked, refusal: null };
}

/** Whether the plus button has anywhere left to go. */
export function canAddMore(held: number, remaining: number | null): boolean {
  if (held >= MAX_PER_LINE) return false;
  return remaining === null || held < remaining;
}
