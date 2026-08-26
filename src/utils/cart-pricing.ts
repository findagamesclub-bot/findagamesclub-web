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
