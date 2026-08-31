/**
 * What the ticket count on an event says.
 *
 * Zero is the whole point of this existing. `tickets_available` is a number the
 * club typed, so `0` means "none left" and `null` means "we did not say" — and
 * a plain falsy check treats those as the same thing, which is how a sold-out
 * event ended up with no label at all instead of a red one.
 */
export type TicketsLeft = { label: string; soldOut: boolean };

export function ticketsLeft(
  available: number | null | undefined,
  /** "60 tickets left" on a hero, "60 left" on a card. */
  long = false,
): TicketsLeft | null {
  if (available === null || available === undefined) return null;
  if (available <= 0) return { label: "Sold out", soldOut: true };
  return {
    label: long ? `${available} tickets left` : `${available} left`,
    soldOut: false,
  };
}
