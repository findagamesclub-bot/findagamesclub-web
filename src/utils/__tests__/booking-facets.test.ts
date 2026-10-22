import assert from "node:assert/strict";
import {
  matchFacet, monthLabel, pickerOptions, splitFacets, type BookingFacet,
} from "../booking-facets";

const rows: BookingFacet[] = [
  { kind: "month", value: "2026-10", label: "2026-10", rows: 12 },
  { kind: "month", value: "2026-09", label: "2026-09", rows: 4 },
  { kind: "game", value: "Warhammer 40,000", label: "Warhammer 40,000", rows: 9 },
  { kind: "player", value: "a-uuid", label: "Gulnabi Afridi", rows: 7 },
];

const facets = splitFacets(rows);

// The order the function handed back is kept. SQL sorts by what each option
// holds, and re-sorting here would put the month nobody has booked in at the
// top of a list the database deliberately ordered by weight.
assert.deepEqual(facets.months.map((m) => m.value), ["2026-10", "2026-09"]);
assert.deepEqual(facets.games.map((g) => g.value), ["Warhammer 40,000"]);
assert.deepEqual(facets.players.map((p) => p.value), ["a-uuid"]);

// A month reads as a reader says it, never as the key it is filtered on.
assert.equal(monthLabel("2026-10"), "Oct 2026");
assert.equal(facets.months[0]!.label, "Oct 2026 (12)");
// And a player keeps the name the database gave, not their id.
assert.equal(facets.players[0]!.label, "Gulnabi Afridi (7)");

// The month is read with UTC getters. Under a timezone behind UTC a bare
// `getMonth()` on "2026-10-01" answers September, which is the bug
// `utils/dates.ts` exists to have fixed. Pinned here because this label is
// built from a day that was never in the data.
assert.equal(monthLabel("2026-01"), "Jan 2026");

// The way out carries the empty value, so "every month" writes the plain URL
// the page already has rather than one more parameter nobody set.
const offered = pickerOptions({
  any: "Every month", options: facets.months, picked: "", label: monthLabel,
});
assert.equal(offered[0]!.value, "");
assert.equal(offered[0]!.label, "Every month");
assert.equal(offered.length, 3);

// A month that is really there adds nothing: the option is already in the
// list, and a second copy would be the same month twice in one dropdown.
assert.equal(pickerOptions({
  any: "Every month", options: facets.months, picked: "2026-10", label: monthLabel,
}).length, 3);

// One the club has nothing in is kept and marked, so the reader can see what
// they asked for and clear it. Dropping it instead left the picker showing a
// value missing from its own list over an empty page.
const stale = pickerOptions({
  any: "Every month", options: facets.months, picked: "2019-03", label: monthLabel,
});
assert.equal(stale.length, 4);
assert.equal(stale[1]!.value, "2019-03");
assert.equal(stale[1]!.label, "Mar 2019 (0)");

// Whitespace from an address does not make a second entry for one month.
assert.equal(pickerOptions({
  any: "Every month", options: facets.months, picked: "  2026-09  ", label: monthLabel,
}).length, 3);

// Without a wording, a value with nothing behind it says so rather than
// printing a uuid at somebody.
assert.equal(pickerOptions({
  any: "Anybody", options: facets.players, picked: "a-ghost",
})[1]!.label, "Nothing in this list (0)");

// --- A spelling that differs only in case ----------------------------------

// The games picker folds on case and so does the SQL filter, so a bookmark
// carrying the other capitals finds the right rows and must not leave the
// picker showing a value none of its options has. Measured in a browser
// first: "Kill Team (0)" sat over two games.
const games = [{ value: "kill team", label: "kill team (2)" }];
assert.equal(matchFacet("Kill Team", games), "kill team");
assert.equal(matchFacet("  KILL TEAM ", games), "kill team");
assert.equal(matchFacet("kill team", games), "kill team");

// Resolved, so the option is already there and nothing is marked (0).
assert.equal(pickerOptions({
  any: "Any game", options: games, picked: matchFacet("Kill Team", games),
  label: (v) => v,
}).length, 2);

// A game the club really has nothing of keeps its own spelling and is still
// marked, which is the case `pickerOptions` exists for.
assert.equal(matchFacet("Blood Bowl", games), "Blood Bowl");
assert.equal(pickerOptions({
  any: "Any game", options: games, picked: matchFacet("Blood Bowl", games),
  label: (v) => v,
})[1]!.label, "Blood Bowl (0)");

// Nothing picked stays nothing, never the first option.
assert.equal(matchFacet("", games), "");
assert.equal(matchFacet("   ", games), "");

console.log("booking-facets: all pass");
