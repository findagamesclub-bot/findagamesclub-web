import assert from "node:assert/strict";

import { eventRefusal, pairingRefusal, rosterRefusal } from "../event-refusals";

// Postgres prefixes what a raise puts out, so the matcher has to cope with it.
const raised = (message: string) => `Failed to run: ${message}`;

// --- events --------------------------------------------------------------

{
  const said = eventRefusal(raised("EVENT_HAS_BOOKINGS: 4 people hold a ticket for Autumn Open"));
  assert.ok(said?.startsWith("4 people hold a ticket for Autumn Open,"),
    "the trigger's own detail is kept, since it names the count and the event");
  assert.ok(said?.includes("Cancel it instead"), "and it says what to do instead");
}

{
  const said = eventRefusal(raised("EVENT_HAS_BOOKINGS"));
  assert.ok(said?.startsWith("Somebody holds a ticket"), "a bare code still says something");
}

{
  const said = eventRefusal(raised("TICKET_TYPE_SOLD: 3 of Standard have gone"));
  assert.ok(said?.startsWith("3 of Standard have gone,"));
  assert.ok(said?.includes("what has gone to close it"));
}

{
  assert.ok(eventRefusal(raised("TICKET_QUANTITY_BELOW_TAKEN: 12 of Standard have gone"))
    ?.includes("12 of Standard have gone"));

  assert.equal(
    eventRefusal(raised("TICKET_LOCKED: Standard has been sold, so its price cannot change.")),
    "Standard has been sold, so its price cannot change.",
    "a trailing stop is not doubled",
  );
}

{
  assert.equal(eventRefusal("EVENT_NEEDS_TITLE"), "Your event needs a name.");
  assert.equal(eventRefusal("EVENT_NEEDS_DATE"), "Say which day it starts.");
  assert.equal(eventRefusal("NOT_PERMITTED"), "Only the club can change its events.");
  assert.ok(eventRefusal('new row violates row-level security policy for table "club_events"'));
}

{
  assert.equal(eventRefusal("connection reset by peer"), null,
    "anything we do not recognise is the service's to log and fall back on");
}

// --- pairings ------------------------------------------------------------

{
  assert.equal(
    pairingRefusal(raised("PAIRING_ROUND_OUT_OF_RANGE: this event has 5 rounds")),
    "That round is out of range: this event has 5 rounds.",
  );
  assert.ok(pairingRefusal("PAIRING_ROUND_OUT_OF_RANGE"), "a bare code still says something");
  assert.equal(pairingRefusal("NOT_PERMITTED"), "Only the club can change the draw.");
  assert.equal(pairingRefusal("some other fault"), null);
}

// --- the roster ----------------------------------------------------------

{
  assert.ok(rosterRefusal("NOT_PERMITTED")?.includes("Reload and try again"));
  assert.equal(rosterRefusal("some other fault"), null);
}

console.log("event-refusals: all assertions passed");
