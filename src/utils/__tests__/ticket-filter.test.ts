import assert from "node:assert/strict";

import {
  canCancel, countTickets, filterTickets, type TicketLike,
} from "../ticket-filter";

const TODAY = "2026-09-15";

const ticket = (over: Partial<TicketLike> & { reference: string }): TicketLike => ({
  eventTitle: "Autumn Open", clubName: "Didcot Wargames", eventDate: "2026-09-26",
  status: "reserved", paymentStatus: "unpaid", total: 30,
  createdAt: "2026-09-01T10:00:00Z", ...over,
});

const SET: TicketLike[] = [
  ticket({ reference: "A", eventDate: "2026-09-26" }),                       // coming, unpaid
  ticket({ reference: "B", eventDate: "2026-11-14", paymentStatus: "paid_in_advance",
           eventTitle: "Didcot Winter Open" }),                              // coming, paid
  ticket({ reference: "C", eventDate: "2026-06-01", clubName: "Mana Wharf" }), // past, unpaid
  ticket({ reference: "D", eventDate: "2026-04-04",
           paymentStatus: "paid_on_the_door" }),                             // past, paid
  ticket({ reference: "E", eventDate: "2026-10-31", status: "cancelled" }),   // cancelled
  ticket({ reference: "F", eventDate: null }),                               // no date yet
];

const refs = (rows: TicketLike[]) => rows.map((t) => t.reference);

// --- the groups -----------------------------------------------------------

{
  const counts = countTickets(SET, TODAY);
  assert.equal(counts.all, 6);
  assert.equal(counts.cancelled, 1);
  assert.equal(counts.upcoming, 3, "A, B and the undated one");
  assert.equal(counts.past, 2, "C and D");
  assert.equal(counts.topay, 3, "A, C and F. Money owed on a past event is still owed");
  assert.equal(counts.paid, 2, "B and D, whichever way the club recorded it");

  assert.equal(counts.topay + counts.paid + counts.cancelled, counts.all,
    "every ticket is owed, settled, or cancelled, and only one of the three");

  assert.equal(counts.upcoming + counts.past + counts.cancelled, counts.all,
    "every ticket is coming up, past, or cancelled, and only one of the three");
}

{
  assert.deepEqual(refs(filterTickets(SET, { tab: "cancelled", today: TODAY })), ["E"]);
  assert.deepEqual(refs(filterTickets(SET, { tab: "past", today: TODAY })).sort(), ["C", "D"]);
  assert.deepEqual(refs(filterTickets(SET, { tab: "topay", today: TODAY })).sort(),
    ["A", "C", "F"]);

  assert.deepEqual(refs(filterTickets(SET, { tab: "paid", today: TODAY })).sort(), ["B", "D"]);

  const cancelledButUnpaid = [ticket({ reference: "X", status: "cancelled" })];
  assert.deepEqual(filterTickets(cancelledButUnpaid, { tab: "topay", today: TODAY }), [],
    "a cancelled place is not money you owe");

  const cancelledButPaid = [ticket({ reference: "Y", status: "cancelled",
                                     paymentStatus: "paid_in_advance" })];
  assert.deepEqual(filterTickets(cancelledButPaid, { tab: "paid", today: TODAY }), [],
    "nor is a cancelled place something you are still paid up for");
}

// --- search ---------------------------------------------------------------

{
  assert.deepEqual(refs(filterTickets(SET, { tab: "all", query: "winter", today: TODAY })),
    ["B"], "by the event");
  assert.deepEqual(refs(filterTickets(SET, { tab: "all", query: "mana", today: TODAY })),
    ["C"], "by the club");
  assert.deepEqual(refs(filterTickets(SET, { tab: "all", query: "d", today: TODAY })).includes("D"),
    true, "by the reference");
  assert.deepEqual(filterTickets(SET, { tab: "all", query: "zzz", today: TODAY }), []);
}

// --- ordering -------------------------------------------------------------

{
  const soonest = refs(filterTickets(SET, { tab: "all", sort: "soonest", today: TODAY }));
  assert.deepEqual(soonest, ["D", "C", "A", "E", "B", "F"], "by date, undated last");

  const latest = refs(filterTickets(SET, { tab: "all", sort: "latest", today: TODAY }));
  assert.deepEqual(latest, ["B", "E", "A", "C", "D", "F"], "and the other way, undated still last");

  const booked = refs(filterTickets(
    [ticket({ reference: "old", createdAt: "2026-01-01T00:00:00Z" }),
     ticket({ reference: "new", createdAt: "2026-09-10T00:00:00Z" })],
    { tab: "all", sort: "booked", today: TODAY }));
  assert.deepEqual(booked, ["new", "old"]);
}

// --- giving a place back --------------------------------------------------

{
  assert.equal(canCancel(ticket({ reference: "A" }), TODAY), true);
  assert.equal(canCancel(ticket({ reference: "C", eventDate: "2026-06-01" }), TODAY), false,
    "cancelling a place at something that already happened means nothing");
  assert.equal(canCancel(ticket({ reference: "E", status: "cancelled" }), TODAY), false);
  assert.equal(canCancel(ticket({ reference: "F", eventDate: null }), TODAY), true,
    "an undated event has not happened, so the place can still go back");
  assert.equal(canCancel(ticket({ reference: "T", eventDate: TODAY }), TODAY), true,
    "today is still on");
}

console.log("ticket-filter: all assertions passed");
