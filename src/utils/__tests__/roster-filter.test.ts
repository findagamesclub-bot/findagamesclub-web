import assert from "node:assert/strict";
import { filterRoster, rosterOptions } from "../roster-filter";
import type { ClubMember } from "@/types/membership";

const make = (over: Partial<ClubMember> & { fullName: string }): ClubMember => ({
  membershipId: over.fullName.length, profileId: over.fullName, status: "approved",
  tierKey: null, tierAssignedAt: null, joinedAt: "2026-01-01", requestedAt: "2026-01-01",
  games: [], armies: [], playStyle: [], tenureYears: 0,
  ...over,
} as ClubMember);

const roster = [
  make({ fullName: "Ada", games: ["Warhammer 40k", "Kill Team"], armies: ["Death Guard"],
         playStyle: ["Casual"] }),
  make({ fullName: "Bob", games: ["warhammer 40k"], armies: ["Custodes"],
         playStyle: ["Competitive"] }),
  make({ fullName: "Cid", games: ["Blood Bowl"], armies: [], playStyle: ["Casual"] }),
];

const names = (rows: ClubMember[]) => rows.map((r) => r.fullName);

// Options come from the club's own roster, most common first, and fold case.
{
  const games = rosterOptions(roster, (m) => m.games);
  assert.deepEqual(games.map((o) => [o.label, o.count]),
    [["Warhammer 40k", 2], ["Blood Bowl", 1], ["Kill Team", 1]]);
}

// A member listing the same thing twice counts once.
assert.deepEqual(
  rosterOptions([make({ fullName: "Ada", games: ["40k", "40K"] })], (m) => m.games)
    .map((o) => o.count),
  [1]);

// Each filter narrows, and they combine as one description of a person.
assert.deepEqual(names(filterRoster(roster, { game: "warhammer 40k" })), ["Ada", "Bob"]);
assert.deepEqual(names(filterRoster(roster, { style: "casual" })), ["Ada", "Cid"]);
assert.deepEqual(
  names(filterRoster(roster, { game: "warhammer 40k", style: "casual" })), ["Ada"]);
assert.deepEqual(names(filterRoster(roster, { army: "custodes" })), ["Bob"]);

// Nothing chosen means everybody, never nobody.
assert.equal(filterRoster(roster, {}).length, 3);

// Search covers the name, their games and their armies.
assert.deepEqual(names(filterRoster(roster, { query: "ad" })), ["Ada"]);
assert.deepEqual(names(filterRoster(roster, { query: "death" })), ["Ada"]);
assert.deepEqual(names(filterRoster(roster, { query: "blood" })), ["Cid"]);
assert.deepEqual(filterRoster(roster, { query: "zzz" }), []);

// A member with nothing listed is not excluded by an empty filter.
assert.equal(filterRoster([make({ fullName: "New" })], {}).length, 1);
assert.equal(filterRoster([make({ fullName: "New" })], { game: "40k" }).length, 0);

console.log("roster-filter ok");
