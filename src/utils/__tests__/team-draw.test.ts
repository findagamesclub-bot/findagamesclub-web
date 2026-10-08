import assert from "node:assert/strict";
import {
  boardOrder, drawTeamRound, fixtureLabel, teamDrawSummary, type DrawTeam,
} from "../team-draw";
import { teamStandings } from "../team-standings";

const team = (id: number, name: string, players: string[]): DrawTeam => ({
  id, name,
  players: players.map((p, i) => ({ id: id * 100 + i, profileId: null, name: p })),
});

// A fixture is a block of tables, so it is lettered and its tables are numbered
// inside it: A1 and A2 belong together in a way table 1 and table 2 never did.
assert.equal(fixtureLabel(0), "A");
assert.equal(fixtureLabel(25), "Z");
assert.equal(fixtureLabel(26), "AA");
assert.equal(fixtureLabel(27), "AB");

const red = team(1, "Red Dice", ["Ann", "Ben"]);
const blue = team(2, "Blue Dice", ["Cal", "Dee"]);

// Board one against board one, in the order the captain listed them.
assert.deepEqual(boardOrder("A", red, blue).map((t) => [t.label, t.one?.name, t.two?.name]), [
  ["A1", "Ann", "Cal"],
  ["A2", "Ben", "Dee"],
]);

// A team a player short leaves the board with one side empty rather than
// dropping it, so the club can see the gap.
const short = team(3, "Short Dice", ["Eve"]);
assert.deepEqual(boardOrder("B", red, short).map((t) => [t.one?.name, t.two?.name ?? null]), [
  ["Ann", "Eve"],
  ["Ben", null],
]);

// Deterministic draw: a fixed source pins the order, so the shape is testable.
const fixed = () => 0;
const drawn = drawTeamRound([red, blue], fixed);
assert.equal(drawn.length, 1);
assert.equal(drawn[0].tables.length, 2);
assert.equal(teamDrawSummary(drawn), "1 fixture, 2 tables");

// An odd number of teams leaves exactly one bye, and the bye has no tables to
// play even though its players are listed.
const odd = drawTeamRound([red, blue, team(4, "Green Dice", ["Fay"])], fixed);
assert.equal(odd.filter((f) => !f.teamTwo).length, 1);
assert.match(teamDrawSummary(odd), /one bye$/);

// An unnamed team is not in the draw at all.
assert.equal(drawTeamRound([red, { ...blue, name: "  " }], fixed).length, 1);
assert.equal(teamDrawSummary([]), "No teams to pair yet.");

// ------------------------------------------------------------- the standings

const teams = [
  { id: 1, name: "Red Dice", finalRank: null },
  { id: 2, name: "Blue Dice", finalRank: null },
  { id: 3, name: "Green Dice", finalRank: null },
];

const table = teamStandings(teams, [
  { teamOne: 1, teamTwo: 2, scoreOne: 125, scoreTwo: 115, gamesOne: 1, gamesTwo: 1 },
  // Nobody has played this one, so it counts for neither side.
  { teamOne: 1, teamTwo: 3, scoreOne: null, scoreTwo: null, gamesOne: 0, gamesTwo: 0 },
  // A bye is not a win.
  { teamOne: 3, teamTwo: null, scoreOne: 90, scoreTwo: null, gamesOne: 2, gamesTwo: 0 },
]);

// Green has only had a bye, so it has played nothing. It sits above Blue
// because it has not lost, which is the same reading a league table gives a
// team with a game in hand.
assert.deepEqual(table.map((r) => [r.name, r.played, r.won, r.lost]), [
  ["Red Dice", 1, 1, 0],
  ["Green Dice", 0, 0, 0],
  ["Blue Dice", 1, 0, 1],
]);
assert.equal(table[0].points, 125);
assert.equal(table[0].against, 115);
assert.equal(table[0].tablesWon, 1);

// A level fixture is a draw for both.
const level = teamStandings(teams.slice(0, 2), [
  { teamOne: 1, teamTwo: 2, scoreOne: 100, scoreTwo: 100, gamesOne: 1, gamesTwo: 1 },
]);
assert.deepEqual(level.map((r) => r.drawn), [1, 1]);

// Once the club has placed them, its order wins over the running one.
const placed = teamStandings(
  [{ id: 1, name: "Red Dice", finalRank: 2 }, { id: 2, name: "Blue Dice", finalRank: 1 }],
  [{ teamOne: 1, teamTwo: 2, scoreOne: 125, scoreTwo: 115, gamesOne: 1, gamesTwo: 1 }]);
assert.deepEqual(placed.map((r) => r.name), ["Blue Dice", "Red Dice"]);

console.log("team-draw: all pass");
