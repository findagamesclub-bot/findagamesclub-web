import assert from "node:assert/strict";

import {
  carryListingFrom, consoleBackTarget, consoleFrom, FROM_MANAGE_BOOKINGS,
  FROM_MANAGE_EVENTS, listingBackTarget,
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


{
  // The listing builder has two doors that show the same cards, and back was
  // hardcoded to one of them: pressing "List a different club" on
  // /list-your-club dropped somebody into the account shell on the way out.
  assert.equal(listingBackTarget(undefined).href, "/account/listings");
  assert.equal(listingBackTarget("list-your-club").href, "/list-your-club");
  assert.equal(listingBackTarget(["list-your-club"]).href, "/list-your-club");

  // Both doors show listings, so the label is true either way and only the
  // destination moves.
  assert.equal(listingBackTarget(undefined).label, listingBackTarget("list-your-club").label);

  // A path from the query string must never become the back button. The
  // allowlist is the whole point.
  for (const hostile of ["/evil", "https://evil.example", "my-clubs", "", "..%2F"]) {
    assert.equal(listingBackTarget(hostile).href, "/account/listings", hostile);
    assert.equal(carryListingFrom(hostile), "");
  }

  assert.equal(carryListingFrom("list-your-club"), "?from=list-your-club");
}

console.log("console-back: all assertions passed");
