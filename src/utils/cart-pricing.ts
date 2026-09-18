import type { CartLine, EventCart } from "@/types/ticket";

/**
 * What a cart costs.
 *
 * Pure, and deliberately mirrors what checkout_event_cart does in SQL — that
 * function is the authority, this is what the buyer is shown before it runs.
 * If the two ever disagree the buyer sees one number and is charged another,
 * so both round the discount to pennies the same way.
 */

/** "GBP 15" / "£15" / "Pay what you can" → a number, or 0. */
export function amountOf(price: string | null | undefined): number {
  const digits = (price ?? "").replace(/[^0-9.]/g, "");
  const value = Number(digits);
  return Number.isFinite(value) ? value : 0;
}

export function priceCart(params: {
  lines: CartLine[];
  discountPercent: number;
  tierLabel: string | null;
  currency?: string;
}): EventCart {
  const subtotal = params.lines.reduce((n, l) => n + l.lineTotal, 0);
  const percent = Math.min(100, Math.max(0, Math.floor(params.discountPercent)));

  // Rounded to pennies before subtracting, as `round(x, 2)` does in the
  // function. Subtracting an unrounded share leaves totals like £56.999999.
  const discountAmount = Math.round(subtotal * percent) / 100;

  return {
    lines: params.lines,
    subtotal,
    discountPercent: percent,
    discountAmount,
    total: Math.max(subtotal - discountAmount, 0),
    currency: params.currency ?? "GBP",
    tierLabel: params.tierLabel,
  };
}

/**
 * The cart as it will be a moment from now.
 *
 * The cart itself lives on the server, which is right: it survives a reload,
 * follows the buyer to another device, and is the thing checkout actually
 * charges. What it is not is instant, and a stepper that waits on a round trip
 * before the number moves feels broken next to the shop's bag.
 *
 * So the browser works out the same answer and shows it at once, and the
 * server's reply replaces it. Both ends price through `priceCart`, so the
 * figure never jumps when the real one lands.
 */
export function changeCartLine(
  cart: EventCart | null,
  line: { ticketTypeId: number; label: string; price: string | null; unitAmount: number },
  quantity: number,
): EventCart {
  const current = cart?.lines ?? [];
  const wanted = Math.max(0, Math.floor(quantity));

  const lines = wanted === 0
    ? current.filter((l) => l.ticketTypeId !== line.ticketTypeId)
    : current.some((l) => l.ticketTypeId === line.ticketTypeId)
      ? current.map((l) => l.ticketTypeId === line.ticketTypeId
          ? { ...l, quantity: wanted, lineTotal: l.unitAmount * wanted }
          : l)
      // A type that is not in the cart yet goes on the end, where the server
      // puts it too: the rows come back ordered by when they were added.
      : [...current, {
          ticketTypeId: line.ticketTypeId,
          label: line.label,
          price: line.price,
          unitAmount: line.unitAmount,
          quantity: wanted,
          lineTotal: line.unitAmount * wanted,
        }];

  return priceCart({
    lines,
    discountPercent: cart?.discountPercent ?? 0,
    tierLabel: cart?.tierLabel ?? null,
    currency: cart?.currency ?? "GBP",
  });
}
