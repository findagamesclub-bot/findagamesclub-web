import assert from "node:assert/strict";

import {
  FEATURED_DEFAULTS, FEATURED_SORTS, FEATURED_TABS, FEATURED_WHEN,
  clubChoices, featuredClubId, featuredSort, featuredState, featuredWhen,
  monthChoices, readFeaturedFilters, type FeaturedFacets,
} from "../featured-filters";
import { nextSearch } from "../filter-url";

// --- reading the address --------------------------------------------------

{
  const filters = readFeaturedFilters({
    q: "didcot", state: "topay", when: "live", month: "2026-11",
    club: "12", sort: "value", page: "3",
  });
  assert.equal(filters.query, "didcot");
  assert.equal(filters.state, "topay");
  assert.equal(filters.when, "live");
  assert.equal(filters.month, "2026-11");
  assert.equal(filters.club, "12");
  assert.equal(filters.page, 3);
}

{
  // A plain URL is page one of everything, not page NaN of nothing.
  const filters = readFeaturedFilters({});
  assert.deepEqual(filters, {
    query: "", state: "", when: "", month: "", club: "", sort: "", page: 1,
  });
  assert.equal(readFeaturedFilters({ page: "0" }).page, 1);
  assert.equal(readFeaturedFilters({ page: "nonsense" }).page, 1);
  // Next hands a repeated param back as an array; the first one wins.
  assert.equal(readFeaturedFilters({ club: ["12", "13"] }).club, "12");
}

// --- the address is a claim, not a fact -----------------------------------

{
  assert.equal(featuredSort("value"), "value");
  assert.equal(featuredSort("whatever"), "newest");
  assert.equal(featuredWhen("live"), "live");
  assert.equal(featuredWhen("whatever"), "");
  // The empty option must not pass the narrowing as a value of its own, or
  // "Any time" would reach SQL as a word rather than as no filter at all.
  assert.equal(featuredWhen(""), "");
  assert.equal(featuredState("paid"), "paid");
  assert.equal(featuredState("banana"), "");
  assert.equal(featuredClubId("12"), 12);
  assert.equal(featuredClubId(""), null);
  assert.equal(featuredClubId("nonsense"), null);
  assert.equal(featuredClubId("-3"), null);
}

// --- the tab that must not be empty ---------------------------------------

{
  // `nextSearch` deletes a value equal to its default, so the tab holding the
  // empty string is the tab a plain URL selects. Exactly one, and it has to be
  // the one the page defaults to, or pressing it lands somewhere else and the
  // tab can never be reached. Clubs and events both paid for this.
  const empty = FEATURED_TABS.filter((tab) => tab.key === "");
  assert.equal(empty.length, 1, "one plain-URL tab");
  assert.equal(empty[0]?.label, "All");

  for (const tab of FEATURED_TABS) {
    const search = new URLSearchParams(nextSearch(
      new URLSearchParams(), { state: tab.key }, FEATURED_DEFAULTS));
    assert.equal(search.get("state") ?? "", tab.key,
      `pressing ${tab.label} writes an address that reads back as itself`);
  }
}

// --- the money and the calendar are two axes ------------------------------

{
  // The reason they are not one list of five words: both narrow at once, and
  // a slot running today that nobody has paid for is the row this screen
  // exists to surface. Either axis alone would hide it behind the other.
  const search = new URLSearchParams(nextSearch(
    new URLSearchParams(), { state: "topay", when: "live" }, FEATURED_DEFAULTS));
  assert.equal(search.get("state"), "topay");
  assert.equal(search.get("when"), "live");

  // And no word appears on both axes, or the same filter would wear two names.
  const money = new Set(FEATURED_TABS.map((tab) => tab.key));
  for (const one of FEATURED_WHEN) {
    assert.ok(!one.value || !money.has(one.value),
      `"${one.value}" cannot be both a money state and a time state`);
  }
}

// --- the pickers offer only what has something behind it ------------------

{
  const facets: FeaturedFacets = {
    months: [{ month: "2026-11", slots: 2 }, { month: "2026-10", slots: 1 }],
    clubs: [{ id: 7, name: "Didcot Wargames", slots: 3 }],
  };

  const months = monthChoices(facets, "");
  assert.equal(months[0]?.value, "", "the way out comes first");
  assert.equal(months[0]?.label, "Any month");
  assert.equal(months[1]?.label, "Nov 2026 (2)");

  const clubs = clubChoices(facets, "7");
  assert.equal(clubs[1]?.label, "Didcot Wargames (3)");

  // A month left in a bookmark after the last slot in it was removed stays
  // offered, marked (0): a picker showing a value missing from its own list
  // over an empty page reads as a screen that has broken, and the reader needs
  // to be able to see what they asked for and clear it.
  const stale = monthChoices(facets, "2026-01");
  assert.equal(stale[1]?.value, "2026-01");
  assert.equal(stale[1]?.label, "Jan 2026 (0)");

  const goneClub = clubChoices(facets, "999");
  assert.equal(goneClub[1]?.label, "A club with no slots (0)");
}

// --- every sort is a real one ---------------------------------------------

{
  // The sort reaches SQL by name, and a sort the function has never heard of
  // falls back to newest there. Nothing in the picker should ever rely on
  // that: an option that silently does nothing is worse than no option.
  for (const sort of FEATURED_SORTS) {
    assert.equal(featuredSort(sort.value), sort.value);
  }
}

console.log("featured-filters: three axes, and every option narrows something");
