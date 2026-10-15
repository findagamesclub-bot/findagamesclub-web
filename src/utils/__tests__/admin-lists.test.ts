import assert from "node:assert/strict";

import {
  CLUB_SORTS, CLUB_TABS, EVENT_SORTS, EVENT_TABS, clubSort, eventSort, eventWhen,
  eventWhenForSql, readAdminFilters, tabsWith,
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
  assert.deepEqual(filters, { query: "", tab: "", extra: "", sort: "", page: 1 });
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

  const at = (tab: string) => ({ query: "", tab, extra: "", sort: "", page: 1 });
  assert.equal(eventWhen(at("")), "upcoming");
  assert.equal(eventWhen(at("past")), "past");
  assert.equal(eventWhen(at("any")), "any");

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

// --- how the clubs list is ordered ----------------------------------------

{
  // An address is a claim. Anything that is not one of the two offered reads
  // as the default rather than reaching SQL as a word it has to decide about.
  const sorted = (sort: string) => clubSort({ query: "", tab: "", extra: "", sort, page: 1 });
  assert.equal(sorted(""), "name");
  assert.equal(sorted("name"), "name");
  assert.equal(sorted("newest"), "newest");
  assert.equal(sorted("created_at desc; drop table clubs"), "name");

  // The default is the one `nextSearch` drops, so a plain URL and the picker's
  // own first option write the same address. Get this wrong and pressing
  // "By name" leaves `?sort=name` on every link the pager builds.
  const plain = nextSearch("", { sort: "name" }, { sort: "name" });
  assert.equal(plain, "");
  assert.equal(clubSort(readAdminFilters(
    Object.fromEntries(new URLSearchParams(plain)))), "name");

  // And pressing the other one comes back as itself.
  for (const option of CLUB_SORTS) {
    const search = nextSearch("", { sort: option.value }, { sort: "name" });
    assert.equal(clubSort(readAdminFilters(
      Object.fromEntries(new URLSearchParams(search)))), option.value,
      `pressing ${option.label} does not come back as itself`);
  }
}

// --- and how the events list is ordered -----------------------------------

{
  const sorted = (sort: string) =>
    eventSort({ query: "", tab: "", extra: "", sort, page: 1 });
  assert.equal(sorted(""), "date");
  assert.equal(sorted("date"), "date");
  assert.equal(sorted("newest"), "newest");
  assert.equal(sorted("start_date"), "date");

  // Each list's default is the one `nextSearch` drops, so a plain URL and the
  // picker's own first option write the same address.
  assert.equal(nextSearch("", { sort: "date" }, { sort: "date" }), "");

  for (const option of EVENT_SORTS) {
    const search = nextSearch("", { sort: option.value }, { sort: "date" });
    assert.equal(eventSort(readAdminFilters(
      Object.fromEntries(new URLSearchParams(search)))), option.value,
      `pressing ${option.label} does not come back as itself`);
  }

  // The two lists do not share a default, and must not share a sort value
  // either: `state` and `sort` are one address, and a club sort reaching the
  // events list would narrow nothing and order by something nobody picked.
  assert.equal(CLUB_SORTS.find((s) => s.value === "date"), undefined,
    "the clubs list must not offer the events list's default");
  assert.equal(EVENT_SORTS.find((s) => s.value === "name"), undefined,
    "the events list must not offer the clubs list's default");
  // They do share "newest", deliberately: it is the same word for the same
  // idea on both, which is the whole reason the client asked for it twice.
  assert.ok(CLUB_SORTS.some((s) => s.value === "newest"));
  assert.ok(EVENT_SORTS.some((s) => s.value === "newest"));
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
