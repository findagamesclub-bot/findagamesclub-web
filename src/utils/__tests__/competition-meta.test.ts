import assert from "node:assert/strict";
import {
  COMPETITION_STATUSES, COMPETITION_TYPES, competitionStatus, competitionType,
  playedFrom, rankStandings, statusLabel, typeLabel,
} from "../competition-meta";

assert.equal(COMPETITION_TYPES.length, 4);
assert.equal(COMPETITION_STATUSES.length, 3);

// Closed sets, with legacy's defaults for anything else.
assert.equal(competitionType("ladder"), "ladder");
assert.equal(competitionType("LADDER"), "ladder");
assert.equal(competitionType("knockout"), "league", "unknown falls back to league");
assert.equal(competitionType(null), "league");
assert.equal(competitionStatus("completed"), "completed");
assert.equal(competitionStatus(""), "active", "unknown falls back to active");
assert.equal(typeLabel("campaign"), "Campaign");
assert.equal(statusLabel("upcoming"), "Upcoming");

// Played is derived, never typed.
assert.equal(playedFrom(3, 1, 1), 5);
assert.equal(playedFrom(0, 0, 0), 0);
assert.equal(playedFrom(-2, 1, 1), 2, "a negative cannot drag the count down");

// --- the table ---------------------------------------------------------------
const row = (memberName: string, points: number, wins: number, losses: number) =>
  ({ memberName, points, wins, losses });

const table = rankStandings([
  row("Zoe", 9, 3, 1),
  row("Adam", 9, 3, 1),
  row("Ben", 12, 4, 0),
  row("Cara", 9, 2, 0),
]);

assert.deepEqual(table.map((r) => r.memberName), ["Ben", "Adam", "Zoe", "Cara"]);
// Ben leads on points. Adam and Zoe both have 9 and 3 wins, so the name breaks
// the tie and the order stops depending on who was typed in first. Cara also
// has 9 but only 2 wins, so she is below both.
assert.equal(table[0].points, 12);
assert.equal(table[3].memberName, "Cara");

console.log("competition-meta ok");
