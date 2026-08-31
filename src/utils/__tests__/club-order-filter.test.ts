import assert from "node:assert/strict";
import {
  countClubOrders, countUnanswered, filterClubOrders,
} from "../club-order-filter";
import type { MerchOrder } from "@/types/clubExtras";

const order = (over: Partial<MerchOrder> & { id: number }): MerchOrder => ({
  personId: `p${over.id}`, personName: `Member ${over.id}`, status: "placed",
  notes: "", log: [], tierLabel: "Premium", createdAt: "2026-08-01T00:00:00Z",
  lines: [{ name: "Club t shirt", price: "£15", quantity: 1, lineTotal: 13.5 }],
  subtotal: 15, discountPercent: 10, discountAmount: 1.5,
  pointsSpent: 0, pointsValue: 0, total: 13.5, ...over,
});

const orders: MerchOrder[] = [
  order({ id: 1, status: "placed", createdAt: "2026-08-30T00:00:00Z", total: 13.5 }),
  order({ id: 2, status: "paid", createdAt: "2026-08-20T00:00:00Z", total: 40 }),
  order({ id: 3, status: "fulfilled", createdAt: "2026-08-10T00:00:00Z", total: 22.5,
          personName: "Alice Brown" }),
  order({ id: 4, status: "cancelled", createdAt: "2026-08-05T00:00:00Z", total: 5,
          lines: [{ name: "Dice tray", price: "£5", quantity: 1, lineTotal: 5 }] }),
  order({ id: 5, status: "placed", createdAt: "2026-08-25T00:00:00Z", total: 60,
          notes: "large, navy please" }),
];

const ids = (rows: MerchOrder[]) => rows.map((r) => r.id);

// --- tabs --------------------------------------------------------------------
const counts = countClubOrders(orders);
assert.equal(counts.all, 5);
assert.equal(counts.placed, 2);
assert.equal(counts.paid, 1);
assert.equal(counts.fulfilled, 1);
assert.equal(counts.cancelled, 1);
// The four states are exclusive, unlike the renewal views, so these must sum.
assert.equal(counts.placed + counts.paid + counts.fulfilled + counts.cancelled, counts.all);

assert.equal(countUnanswered(orders), 2, "only what the club has not answered");

assert.deepEqual(ids(filterClubOrders(orders, { filter: "placed" })), [1, 5]);
assert.deepEqual(ids(filterClubOrders(orders, { filter: "cancelled" })), [4]);

// --- sorting -----------------------------------------------------------------
assert.deepEqual(ids(filterClubOrders(orders, { sort: "recent" })), [1, 5, 2, 3, 4]);
assert.deepEqual(ids(filterClubOrders(orders, { sort: "value" })), [5, 2, 3, 1, 4]);
assert.equal(filterClubOrders(orders, { sort: "name" })[0].personName, "Alice Brown");

// --- search ------------------------------------------------------------------
assert.deepEqual(ids(filterClubOrders(orders, { query: "alice" })), [3]);
assert.deepEqual(ids(filterClubOrders(orders, { query: "dice tray" })), [4],
  "the item, not just the person");
assert.deepEqual(ids(filterClubOrders(orders, { query: "navy" })), [5],
  "the note, where a size or a colour ends up");
assert.equal(filterClubOrders(orders, { query: "nobody" }).length, 0);

// Search and tab together, which is how somebody actually narrows a long list.
assert.deepEqual(ids(filterClubOrders(orders, { query: "member", filter: "placed" })), [1, 5]);

console.log("club-order-filter ok");
