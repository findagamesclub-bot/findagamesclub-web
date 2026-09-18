import assert from "node:assert/strict";

import {
  consoleBackTarget, consoleFrom, FROM_MANAGE_BOOKINGS, FROM_MANAGE_EVENTS,
} from "../back-link";

const event = { slug: "didcot-wargames-didcot", id: 115, title: "Autumn Open" };

// --- where each trail goes ------------------------------------------------

{
  assert.deepEqual(consoleBackTarget(FROM_MANAGE_EVENTS, event), {
    href: "/clubs/didcot-wargames-didcot/manage/events", label: "Events",
  });

  assert.deepEqual(consoleBackTarget(FROM_MANAGE_BOOKINGS, event), {
    href: "/clubs/didcot-wargames-didcot/manage/events?tab=bookings", label: "Bookings",
  });
}

{
  // No trail means you came from the event's own editor, which is where the
  // strip at the top of it links from.
  assert.deepEqual(consoleBackTarget(undefined, event), {
    href: "/clubs/didcot-wargames-didcot/manage/events/115", label: "Autumn Open",
  });
}

// --- nothing else is honoured ---------------------------------------------

{
  // The whole point of the fixed list: a link cannot aim the back button.
  for (const hostile of ["/evil", "https://example.com", "../../admin", "events", ""]) {
    assert.equal(consoleFrom(hostile), null, hostile || "(empty)");
    assert.equal(consoleBackTarget(hostile, event).href,
      "/clubs/didcot-wargames-didcot/manage/events/115",
      `${hostile || "(empty)"} falls back to the editor`);
  }
}

{
  // A repeated param arrives as an array, which is a real thing a URL can do.
  assert.equal(consoleFrom([FROM_MANAGE_BOOKINGS, "/evil"]), FROM_MANAGE_BOOKINGS);
  assert.equal(consoleFrom(["/evil", FROM_MANAGE_BOOKINGS]), null,
    "the first one decides, so a second cannot override it");
}

console.log("console-back: all assertions passed");
