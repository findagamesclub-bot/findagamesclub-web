import assert from "node:assert/strict";

import { countDoorRows, filterDoorRows, owed, type DoorRow } from "../door-list";

const row = (over: Partial<DoorRow> = {}): DoorRow => ({
  bookingId: 1, profileId: null, fullName: "Ann Lee", email: "ann@example.com",
  reference: "FAGC-1001", status: "reserved", paymentStatus: "unpaid", paymentMethod: "",
  checkedInAt: null, refundStatus: "not_due", cancelReason: "", notes: "",
  tickets: 1, total: 20, createdAt: "2026-09-01T10:00:00Z", ...over,
});

const SET: DoorRow[] = [
  row({ bookingId: 1, fullName: "Ann Lee", email: "ann@example.com", reference: "FAGC-1001" }),
  row({ bookingId: 2, fullName: "Ben Shah", email: "ben@example.com", reference: "FAGC-1002",
        paymentStatus: "paid_in_advance" }),
  row({ bookingId: 3, fullName: "Cat Moss", email: "cat@example.com", reference: "FAGC-1003",
        paymentStatus: "paid_on_the_door", checkedInAt: "2026-09-26T09:05:00Z" }),
  row({ bookingId: 4, fullName: "Dan Reed", email: "dan@example.com", reference: "FAGC-1004",
        status: "cancelled", refundStatus: "due", paymentStatus: "paid_in_advance" }),
  // Somebody who walked in and has still not paid. Both things are true.
  row({ bookingId: 5, fullName: "Eve Park", email: "eve@example.com", reference: "FAGC-1005",
        checkedInAt: "2026-09-26T09:10:00Z" }),
];

// --- the tabs ------------------------------------------------------------

{
  const counts = countDoorRows(SET);
  assert.equal(counts.all, 5, "All means all, cancellations included");
  assert.equal(counts.cancelled, 1);
  assert.equal(counts.paid, 2, "a cancelled booking that was paid is not in Paid");
  assert.equal(counts.checkedin, 2);
  assert.equal(counts.reserved, 1, "only Ann: unpaid and not through the door");
}

{
  const reserved = filterDoorRows(SET, { tab: "reserved" });
  assert.deepEqual(reserved.map((r) => r.bookingId), [1]);

  const cancelled = filterDoorRows(SET, { tab: "cancelled" });
  assert.deepEqual(cancelled.map((r) => r.bookingId), [4]);

  const checkedIn = filterDoorRows(SET, { tab: "checkedin" });
  assert.deepEqual(checkedIn.map((r) => r.bookingId).sort(), [3, 5],
    "checked in and unpaid is still checked in");
}

// --- search --------------------------------------------------------------

{
  assert.deepEqual(
    filterDoorRows(SET, { tab: "all", query: "ben" }).map((r) => r.bookingId), [2],
    "by name",
  );
  assert.deepEqual(
    filterDoorRows(SET, { tab: "all", query: "ann@" }).map((r) => r.bookingId), [1],
    "by email",
  );
  assert.deepEqual(
    filterDoorRows(SET, { tab: "all", query: "fagc-1003" }).map((r) => r.bookingId), [3],
    "by reference, which is what somebody reads off their phone",
  );
  assert.deepEqual(filterDoorRows(SET, { tab: "all", query: "zzz" }), []);
}

// --- sorting -------------------------------------------------------------

{
  const byName = filterDoorRows(SET, { tab: "all" });
  assert.deepEqual(byName.map((r) => r.fullName)[0], "Ann Lee");

  const byNewest = filterDoorRows(
    [row({ bookingId: 1, createdAt: "2026-09-01T10:00:00Z" }),
     row({ bookingId: 2, createdAt: "2026-09-03T10:00:00Z" })],
    { tab: "all", sort: "newest" },
  );
  assert.deepEqual(byNewest.map((r) => r.bookingId), [2, 1]);

  const byValue = filterDoorRows(
    [row({ bookingId: 1, total: 20 }), row({ bookingId: 2, total: 60 })],
    { tab: "all", sort: "value" },
  );
  assert.deepEqual(byValue.map((r) => r.bookingId), [2, 1]);
}

// --- what is still owed --------------------------------------------------

{
  assert.deepEqual(owed(SET), { people: 2, amount: 40 },
    "Ann and Eve. Dan cancelled, so his money is a refund and not a debt");
  assert.deepEqual(owed([]), { people: 0, amount: 0 });
}

console.log("door-list: all assertions passed");
