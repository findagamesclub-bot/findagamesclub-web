import assert from "node:assert/strict";
import { countWaiting, filterOrders } from "../order-filter";
import type { MyOrder } from "@/services/myActivity.service";

const make = (over: Partial<MyOrder> & { id: number }): MyOrder => ({
  club: { slug: "didcot", name: "Didcot Wargames", logoUrl: null },
  status: "paid", placedAt: "2026-08-01", updatedAt: null,
  total: 10, saved: 0, tierLabel: null,
  items: [{ id: 1, name: "Club t shirt", quantity: 1, lineTotal: 10, quoted: false }],
  ...over,
} as MyOrder);

const orders = [
  make({ id: 1, placedAt: "2026-08-20", total: 27 }),
  make({ id: 2, placedAt: "2026-08-01", total: 13.5, status: "fulfilled" }),
  make({ id: 3, placedAt: "2026-07-01", total: 60, status: "cancelled",
         club: { slug: "abingdon", name: "Abingdon Games Club", logoUrl: null },
         items: [{ id: 9, name: "Dice tray", quantity: 2, lineTotal: 60, quoted: false }] }),
];

const ids = (rows: MyOrder[]) => rows.map((r) => r.id);

// Groups map to the words a member would use, not the database status.
assert.deepEqual(ids(filterOrders(orders, { filter: "waiting" })), [1]);
assert.deepEqual(ids(filterOrders(orders, { filter: "collected" })), [2]);
assert.deepEqual(ids(filterOrders(orders, { filter: "cancelled" })), [3]);
assert.equal(countWaiting(orders), 1);

// A brand new order sits at `placed`, which used to belong to no tab at all:
// All counted it and the three groups did not, so the numbers disagreed.
const withPlaced = [...orders, make({ id: 4, placedAt: "2026-08-25", status: "placed" })];
assert.equal(countWaiting(withPlaced), 2);
assert.equal(filterOrders(withPlaced, { filter: "waiting" }).length, 2);
assert.equal(
  filterOrders(withPlaced, { filter: "waiting" }).length
  + filterOrders(withPlaced, { filter: "collected" }).length
  + filterOrders(withPlaced, { filter: "cancelled" }).length,
  filterOrders(withPlaced, { filter: "all" }).length,
  "every order belongs to exactly one tab",
);

// Search finds an item as well as a club.
assert.deepEqual(ids(filterOrders(orders, { query: "dice" })), [3]);
assert.deepEqual(ids(filterOrders(orders, { query: "abingdon" })), [3]);
assert.equal(filterOrders(orders, { query: "t shirt" }).length, 2);
assert.deepEqual(filterOrders(orders, { query: "zzz" }), []);

// Newest first by default; value and club are the alternatives.
assert.deepEqual(ids(filterOrders(orders, {})), [1, 2, 3]);
assert.deepEqual(ids(filterOrders(orders, { sort: "value" })), [3, 1, 2]);
assert.deepEqual(ids(filterOrders(orders, { sort: "club" }))[0], 3);

console.log("order-filter ok");
