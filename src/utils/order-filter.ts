import type { MyOrder } from "@/services/myActivity.service";

export type OrderFilter = "all" | "waiting" | "collected" | "cancelled";
export type OrderSort = "recent" | "value" | "club";

const fold = (value: string) => value.trim().toLowerCase();

/**
 * "To collect" is anything the club still has: an order they have not answered
 * yet as well as one they have taken money for. `placed` used to be in no group
 * at all, so All said 7 and the three tabs added up to 6.
 */
const WAITING = new Set(["placed", "paid"]);

const inGroup = (order: MyOrder, filter: OrderFilter) => {
  if (filter === "all") return true;
  if (filter === "waiting") return WAITING.has(order.status);
  if (filter === "collected") return order.status === "fulfilled";
  return order.status === "cancelled";
};

/**
 * Search, filter and sort the member's kit orders.
 *
 * Search covers the item names as well as the club: "where did I order that
 * t shirt" is the question somebody actually arrives with.
 */
export function filterOrders(
  orders: MyOrder[],
  { query = "", filter = "all", sort = "recent" }: {
    query?: string;
    filter?: OrderFilter;
    sort?: OrderSort;
  },
): MyOrder[] {
  const needle = fold(query);

  const kept = orders.filter((order) => {
    if (!inGroup(order, filter)) return false;
    if (!needle) return true;
    return (
      fold(order.club.name).includes(needle) ||
      order.items.some((item) => fold(item.name).includes(needle))
    );
  });

  return kept.sort((a, b) => {
    if (sort === "value") return b.total - a.total;
    if (sort === "club") {
      return a.club.name.localeCompare(b.club.name) || b.placedAt.localeCompare(a.placedAt);
    }
    return b.placedAt.localeCompare(a.placedAt);
  });
}

/** Orders the club is still holding for this member. */
export function countWaiting(orders: MyOrder[]): number {
  return orders.filter((order) => WAITING.has(order.status)).length;
}
