import type { MerchOrder } from "@/types/clubExtras";

/**
 * Merchandise orders, as the club sorts through them.
 *
 * The member's side already has order-filter.ts, which groups by "is the club
 * still holding this for me". The club asks a different question, which is
 * which of the six states an order is in, so the tabs are the states
 * themselves rather than a rollup of them.
 *
 * Refunded is the fifth, added for the client's item 15. It is a state of the
 * order rather than a flag beside it, because here the status already IS the
 * payment: placed, paid, fulfilled. A table booking is the other shape, and
 * 0229 says why the two differ.
 */

export type ClubOrderFilter =
  | "all" | "placed" | "paid" | "fulfilled" | "cancelled"
  | "refund_due" | "refunded";
export type ClubOrderSort = "recent" | "value" | "name";

const fold = (value: string) => value.trim().toLowerCase();

/** Name, item names and the note, which is where a size or a colour ends up. */
function haystack(order: MerchOrder): string {
  return fold([
    order.personName,
    order.tierLabel ?? "",
    order.notes,
    ...order.lines.map((line) => line.name),
  ].join(" "));
}

export function filterClubOrders(
  orders: MerchOrder[],
  { query = "", filter = "all", sort = "recent" }: {
    query?: string; filter?: ClubOrderFilter; sort?: ClubOrderSort;
  },
): MerchOrder[] {
  const needle = fold(query);

  const kept = orders.filter((order) =>
    (filter === "all" || order.status === filter)
    && (!needle || haystack(order).includes(needle)));

  return kept.sort((a, b) => {
    if (sort === "value") return b.total - a.total;
    if (sort === "name") {
      return a.personName.localeCompare(b.personName)
        || b.createdAt.localeCompare(a.createdAt);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * How many sit in each tab.
 *
 * The six states are exclusive, so unlike the renewal views these do add up
 * to the total, and a club can trust the arithmetic. That is true here and
 * NOT true of the same two words on a table booking or an event place, where
 * a refund is a second column beside the payment rather than a replacement
 * for it, so it overlaps Cancelled instead of slicing it.
 */
export function countClubOrders(orders: MerchOrder[]) {
  const of = (status: MerchOrder["status"]) =>
    orders.filter((order) => order.status === status).length;

  return {
    all: orders.length,
    placed: of("placed"),
    paid: of("paid"),
    fulfilled: of("fulfilled"),
    cancelled: of("cancelled"),
    refund_due: of("refund_due"),
    refunded: of("refunded"),
  };
}

/** Orders the club has not answered yet. What the badge counts. */
export function countUnanswered(orders: MerchOrder[]): number {
  return orders.filter((order) => order.status === "placed").length;
}
