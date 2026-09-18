import assert from "node:assert/strict";

import { nextSearch, withSearch } from "../filter-url";

const DEFAULTS = { state: "all", sort: "newest", event: "0" };

// --- the bug this exists for ---------------------------------------------

{
  // The bookings list lives behind `tab=bookings`, which the filter bar does
  // not own. Rebuilding the query from the filters alone dropped it, and
  // changing a tab threw the reader back to the events list.
  const search = nextSearch("tab=bookings&state=reserved", { state: "paid" }, DEFAULTS);
  const params = new URLSearchParams(search);
  assert.equal(params.get("tab"), "bookings", "the tab it is not looking at survives");
  assert.equal(params.get("state"), "paid");
}

{
  const search = nextSearch("tab=bookings&q=afridi&ref=email", { sort: "name" }, DEFAULTS);
  const params = new URLSearchParams(search);
  assert.equal(params.get("tab"), "bookings");
  assert.equal(params.get("q"), "afridi", "a param it does own and did not change");
  assert.equal(params.get("ref"), "email", "and one it has never heard of");
}

// --- defaults stay out of the address -------------------------------------

{
  assert.equal(nextSearch("", { state: "all", sort: "newest" }, DEFAULTS), "",
    "a plain list has a plain URL");

  const back = nextSearch("state=paid&sort=name", { state: "all" }, DEFAULTS);
  assert.equal(new URLSearchParams(back).get("state"), null, "going back to All clears it");
  assert.equal(new URLSearchParams(back).get("sort"), "name", "and leaves the sort alone");

  assert.equal(new URLSearchParams(nextSearch("event=2", { event: "0" }, DEFAULTS)).get("event"),
    null, "every event is the default, so it is not written down");
}

// --- empties --------------------------------------------------------------

{
  const cleared = nextSearch("q=ada&state=paid", { q: "" }, DEFAULTS);
  assert.equal(new URLSearchParams(cleared).get("q"), null, "clearing the search drops it");
  assert.equal(new URLSearchParams(cleared).get("state"), "paid");

  const missing = nextSearch("q=ada", { q: undefined }, DEFAULTS);
  assert.equal(new URLSearchParams(missing).get("q"), null,
    "undefined means the same as empty, not 'leave it'");
}

// --- paging ---------------------------------------------------------------

{
  const paged = nextSearch("tab=bookings&page=4&state=paid", { state: "cancelled" }, DEFAULTS);
  assert.equal(new URLSearchParams(paged).get("page"), null,
    "any change goes back to page one, or you land on an empty page four");
  assert.equal(new URLSearchParams(paged).get("tab"), "bookings");
}

// --- the path -------------------------------------------------------------

{
  assert.equal(withSearch("/clubs/x/manage/events", "tab=bookings"),
    "/clubs/x/manage/events?tab=bookings");
  assert.equal(withSearch("/clubs/x/manage/events", ""), "/clubs/x/manage/events",
    "never a trailing question mark");
}

console.log("filter-url: all assertions passed");
