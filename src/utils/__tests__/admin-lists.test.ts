import assert from "node:assert/strict";

import {
  CLUB_TABS, EVENT_TABS, eventWhen, eventWhenForSql, readAdminFilters, tabsWith,
} from "../admin-lists";
import { nextSearch } from "../filter-url";

// --- reading the address --------------------------------------------------

{
  const filters = readAdminFilters({ q: "leeds", state: "paused", page: "3" });
  assert.equal(filters.query, "leeds");
  assert.equal(filters.tab, "paused");
  assert.equal(filters.extra, "");
  assert.equal(filters.page, 3);
}

{
  // A plain URL is page one of everything, not page NaN of nothing.
  const filters = readAdminFilters({});
  assert.deepEqual(filters, { query: "", tab: "", extra: "", page: 1 });
  assert.equal(readAdminFilters({ page: "0" }).page, 1);
  assert.equal(readAdminFilters({ page: "-4" }).page, 1);
  assert.equal(readAdminFilters({ page: "nonsense" }).page, 1);
  // Next hands a repeated param as an array. The first one wins rather than
  // "leeds,hull" going to SQL as one town nobody lives in.
  assert.equal(readAdminFilters({ q: ["leeds", "hull"] }).query, "leeds");
}

// --- the tab that must not be empty ---------------------------------------

{
  // Exactly one tab per list holds the empty string, and it has to be the one
  // the list defaults to. `nextSearch` deletes an empty value, so an empty tab
  // writes the plain URL; if that is not the default, pressing it lands on the
  // default instead and the tab can never be reached. This is the whole reason
  // the events All tab is called "any".
  const empties = (tabs: { key: string }[]) => tabs.filter((t) => t.key === "").length;
  assert.equal(empties(CLUB_TABS), 1, "clubs need one plain-URL tab");
  assert.equal(empties(EVENT_TABS), 0, "events default to upcoming, so none is plain");

  assert.equal(eventWhen({ query: "", tab: "", extra: "", page: 1 }), "upcoming");
  assert.equal(eventWhen({ query: "", tab: "past", extra: "", page: 1 }), "past");
  assert.equal(eventWhen({ query: "", tab: "any", extra: "", page: 1 }), "any");

  // Pressing All has to write an address that reads back as All.
  for (const tab of EVENT_TABS) {
    const search = nextSearch("", { state: tab.key }, { state: "upcoming" });
    const read = eventWhen(readAdminFilters(
      Object.fromEntries(new URLSearchParams(search))));
    assert.equal(read, tab.key, `pressing ${tab.label} does not come back as itself`);
  }

  // And SQL is asked for no filter, not for a status called "any", which would
  // match no branch in the function and quietly return an empty list.
  assert.equal(eventWhenForSql("any"), "");
  assert.equal(eventWhenForSql("upcoming"), "upcoming");
  assert.equal(eventWhenForSql("past"), "past");
}

// --- the counts -----------------------------------------------------------

{
  const tabs = tabsWith(CLUB_TABS, { all: 12, active: 9, paused: 2, suspended: 1 });
  assert.deepEqual(tabs.map((t) => [t.value, t.count]),
    [["", 12], ["active", 9], ["paused", 2], ["suspended", 1]]);

  // Both spellings of "everything" read the same figure.
  assert.equal(tabsWith(EVENT_TABS, { all: 40, upcoming: 5, past: 35 })
    .find((t) => t.value === "any")?.count, 40);

  // A failed counts read is zeros, never undefined: the bar prints whatever it
  // is given, and `undefined` renders as a blank where a number should be.
  for (const tab of tabsWith(CLUB_TABS, {})) {
    assert.equal(tab.count, 0, `${tab.label} has no count`);
    assert.equal(typeof tab.count, "number");
  }
}

console.log("admin-lists: all assertions passed");
