import assert from "node:assert/strict";
import {
  readBadgeFilters, siftBadges, badgeStateCounts, badgeTabs, BADGE_STATE_TABS,
} from "../badge-filters";
import { nextSearch } from "../filter-url";

const badge = (label: string, awarded: number, active = true, description = "") =>
  ({ label, description, active, awarded });

const rows = [
  badge("Terrain wizard", 1, false, "Paints the scenery nobody else will"),
  badge("best painted", 0, true, "Voted best at a club event"),
  badge("Club stalwart", 4, true, "Makes the tea"),
  badge("Tournament winner", 2, true, "First place"),
];

// ----------------------------------------------------------------- reading
{
  const f = readBadgeFilters({ q: "gul", state: "live", sort: "held",
                               badge: "7", page: "3" });
  assert.equal(f.query, "gul");
  assert.equal(f.state, "live");
  assert.equal(f.sort, "held");
  assert.equal(f.badge, 7);
  assert.equal(f.page, 3);
}
{
  // A plain URL is every default, and nothing is undefined.
  const f = readBadgeFilters({});
  assert.deepEqual(f, { query: "", state: "", sort: "", badge: null, page: 1 });
}
{
  // Anything that is not a badge id is no badge at all, not NaN.
  for (const value of ["abc", "0", "-3", "1.5", ""]) {
    assert.equal(readBadgeFilters({ badge: value }).badge, null, `badge=${value}`);
  }
  // A repeated param takes the first, the way Next hands it over.
  assert.equal(readBadgeFilters({ badge: ["4", "9"] }).badge, 4);
  assert.equal(readBadgeFilters({ page: "0" }).page, 1);
}

// ------------------------------------------------------------------ the URL
{
  // The tab holding the empty string has to be the one a plain URL selects, or
  // pressing it writes the address the page already has and nothing reaches
  // it. Every tab must come back as itself.
  for (const tab of BADGE_STATE_TABS) {
    const search = nextSearch(new URLSearchParams("tab=awarded"),
      { state: tab.key }, { state: "" });
    const back = readBadgeFilters(
      Object.fromEntries(new URLSearchParams(search).entries()));
    assert.equal(back.state, tab.key, `${tab.label} did not survive the URL`);
  }
}

// ---------------------------------------------------------------- searching
{
  assert.deepEqual(siftBadges(rows, { query: "terrain", state: "", sort: "" })
    .map((r) => r.label), ["Terrain wizard"]);
  // The description is searched too: "makes the tea" is on the stalwart.
  assert.deepEqual(siftBadges(rows, { query: "tea", state: "", sort: "" })
    .map((r) => r.label), ["Club stalwart"]);
  // fold() normalises both sides, so case and spacing do not decide a match.
  assert.equal(siftBadges(rows, { query: "  BEST PAINTED ", state: "", sort: "" })
    .length, 1);
  assert.equal(siftBadges(rows, { query: "nothing here", state: "", sort: "" })
    .length, 0);
}

// ------------------------------------------------------------------ states
{
  assert.deepEqual(siftBadges(rows, { query: "", state: "retired", sort: "" })
    .map((r) => r.label), ["Terrain wizard"]);
  assert.equal(siftBadges(rows, { query: "", state: "live", sort: "" }).length, 3);
  assert.equal(siftBadges(rows, { query: "", state: "", sort: "" }).length, 4);
}

// ------------------------------------------------------------------- sorts
{
  // Retired sorts last whatever the sort, on every one of them.
  for (const sort of ["", "name", "held", "least"]) {
    const out = siftBadges(rows, { query: "", state: "", sort });
    assert.equal(out[out.length - 1]!.label, "Terrain wizard",
      `retired did not sort last under ${sort || "the default"}`);
  }
  assert.deepEqual(siftBadges(rows, { query: "", state: "", sort: "name" })
    .map((r) => r.label),
    ["best painted", "Club stalwart", "Tournament winner", "Terrain wizard"]);
  assert.deepEqual(siftBadges(rows, { query: "", state: "", sort: "held" })
    .map((r) => r.label),
    ["Club stalwart", "Tournament winner", "best painted", "Terrain wizard"]);
  assert.deepEqual(siftBadges(rows, { query: "", state: "", sort: "least" })
    .map((r) => r.label),
    ["best painted", "Tournament winner", "Club stalwart", "Terrain wizard"]);
}
{
  // Sifting never edits what it was given: the page renders from this list and
  // a sort in place would reorder the copy the counts were taken from.
  const before = rows.map((r) => r.label);
  siftBadges(rows, { query: "", state: "", sort: "held" });
  assert.deepEqual(rows.map((r) => r.label), before);
}
{
  // Two badges held by nobody keep a fixed order rather than swapping between
  // renders, which would make a grid flicker on every keystroke.
  const tied = [badge("Zeta", 0), badge("Alpha", 0), badge("Mu", 0)];
  assert.deepEqual(siftBadges(tied, { query: "", state: "", sort: "held" })
    .map((r) => r.label), ["Alpha", "Mu", "Zeta"]);
}

// ------------------------------------------------------------------ counts
{
  const counts = badgeStateCounts(rows, "");
  assert.deepEqual(counts, { all: 4, live: 3, retired: 1 });
  assert.equal(counts.all, counts.live + counts.retired);

  // The search narrows them, or the tab lies about the list under it.
  assert.deepEqual(badgeStateCounts(rows, "terrain"), { all: 1, live: 0, retired: 1 });

  const tabs = badgeTabs(counts);
  assert.deepEqual(tabs.map((t) => [t.value, t.count]),
    [["", 4], ["live", 3], ["retired", 1]]);
  // A counts read that failed must print zeros, not blanks.
  assert.deepEqual(badgeTabs({}).map((t) => t.count), [0, 0, 0]);
}

console.log("badge-filters: all pass");
