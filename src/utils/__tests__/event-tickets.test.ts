import assert from "node:assert/strict";

import {
  lockedFieldRefusal, removeTicketRefusal, soldLabel, ticketRefusal, ticketsAvailable,
  type TicketDraft,
} from "../event-tickets";

const ticket = (over: Partial<TicketDraft> = {}): TicketDraft => ({
  id: null, label: "Standard", price: "GBP 20", quantityAvailable: 40,
  audience: "all", minimumTierKey: "", ...over,
});

const TIERS = ["basic-membership", "premium-membership"];

// --- what a club may say -------------------------------------------------

{
  assert.equal(ticketRefusal([], TIERS), null, "an event can sell nothing");
  assert.equal(ticketRefusal([ticket()], TIERS), null);
  assert.equal(ticketRefusal([ticket({ quantityAvailable: null })], TIERS), null,
    "no cap is allowed");
  assert.equal(ticketRefusal([ticket({ quantityAvailable: 0 })], TIERS), null,
    "zero left is a real state, it is just closed");
}

{
  assert.ok(ticketRefusal([ticket({ label: "  " })], TIERS), "a blank name");
  assert.ok(ticketRefusal([ticket({ label: "x".repeat(61) })], TIERS), "a name that long");
}

{
  // Legacy drops the second one without a word. This names it.
  const refusal = ticketRefusal([ticket(), ticket({ label: "standard" })], TIERS);
  assert.ok(refusal?.includes("standard"), "duplicate labels are refused, case-insensitively");
}

{
  assert.ok(ticketRefusal([ticket({ quantityAvailable: -1 })], TIERS), "negative");
  assert.ok(ticketRefusal([ticket({ quantityAvailable: 2.5 })], TIERS), "half a ticket");
  assert.ok(ticketRefusal([ticket({ quantityAvailable: 100001 })], TIERS), "a typo");
}

{
  assert.ok(
    ticketRefusal([ticket({ audience: "members", minimumTierKey: "gone" })], TIERS),
    "a tier the club no longer offers",
  );
  assert.ok(
    ticketRefusal([ticket({ audience: "all", minimumTierKey: "premium-membership" })], TIERS),
    "a tier gate on a ticket anybody can buy would do nothing",
  );
  assert.equal(
    ticketRefusal([ticket({ audience: "members", minimumTierKey: "premium-membership" })], TIERS),
    null,
  );
}

// --- what a row says -----------------------------------------------------

{
  assert.equal(soldLabel(0, 40), null, "nothing to say before one has gone");
  assert.equal(soldLabel(12, 40), "12 of 40 sold");
  assert.equal(soldLabel(12, null), "12 sold");
}

// --- removing ------------------------------------------------------------

{
  assert.equal(removeTicketRefusal("Standard", 0), null);
  assert.ok(removeTicketRefusal("Standard", 1)?.includes("person holds"));
  assert.ok(removeTicketRefusal("Standard", 4)?.includes("people hold"));
}

// --- what a sold type may still change -----------------------------------

{
  const before = ticket({ id: 1 });
  assert.equal(lockedFieldRefusal(before, { ...before, label: "Standard entry" }, 3), null,
    "a name may still be corrected");
  assert.equal(lockedFieldRefusal(before, { ...before, price: "GBP 25" }, 0), null,
    "nothing is frozen until one has gone");

  assert.ok(lockedFieldRefusal(before, { ...before, price: "GBP 25" }, 3), "the price is frozen");
  assert.ok(lockedFieldRefusal(before, { ...before, audience: "members" }, 3), "who it is for");
  assert.ok(
    lockedFieldRefusal(before, { ...before, minimumTierKey: "premium-membership" }, 3),
    "the tier",
  );

  assert.ok(lockedFieldRefusal(before, { ...before, quantityAvailable: 2 }, 3),
    "fewer than have gone");
  assert.equal(lockedFieldRefusal(before, { ...before, quantityAvailable: 3 }, 3), null,
    "down to exactly what has gone is how a club closes one");
  assert.equal(lockedFieldRefusal(before, { ...before, quantityAvailable: 60 }, 3), null,
    "adding more is always fine");
  assert.equal(lockedFieldRefusal(before, { ...before, quantityAvailable: null }, 3), null,
    "lifting the cap is fine");
}

// --- the event's capacity ------------------------------------------------

{
  assert.equal(ticketsAvailable([]), null, "no ticket types, no figure");
  assert.equal(ticketsAvailable([ticket({ quantityAvailable: 40 }),
                                 ticket({ label: "Member", quantityAvailable: 10 })]), 50);
  assert.equal(
    ticketsAvailable([ticket({ quantityAvailable: 40 }),
                      ticket({ label: "Member", quantityAvailable: null })]),
    null,
    "one uncapped type makes the whole event uncapped",
  );
}

console.log("event-tickets: all assertions passed");
