import { needsQuote } from "./merch-bag";

/**
 * What an order is worth, or that nobody has said yet.
 *
 * A club can price an item as free text, so "TBC" and "Ask at the desk" store
 * a total of zero. Showing £0.00 tells the member the club gave it away and
 * tells the club a member took one for nothing, and neither is true.
 *
 * The price text is copied onto the order line at checkout, so an order placed
 * before the club named a price still knows that it had none.
 */
export function orderTotalLabel(
  order: { total: number; lines: { price: string | null }[] },
  money: (n: number) => string,
): string {
  const unpriced = order.lines.length > 0 && order.lines.every((l) => needsQuote(l.price));
  return unpriced ? "To be priced" : money(order.total);
}
