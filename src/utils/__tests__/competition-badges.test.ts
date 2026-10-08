import assert from "node:assert/strict";
import { competitionBadges, type BadgeSource } from "../competition-badges";

const make = (over: Partial<BadgeSource> & { competitionId: number }): BadgeSource => ({
  title: "Spring Escalation League", typeLabel: "League", type: "league",
  completed: false, rank: 0, played: 0, wins: 0, losses: 0,
  ...over,
});

const labels = (rows: ReturnType<typeof competitionBadges>) => rows.map((b) => b.label);

// Leading a competition that is still running is the one place badge left
// here. A finished first, second or third is a stored badge 0167 gives out, so
// deriving one too would put two badges for the same win on one profile.
assert.deepEqual(
  labels(competitionBadges([make({ competitionId: 1, rank: 1 })])),
  ["Current Leader"]);
assert.deepEqual(
  competitionBadges([make({ competitionId: 1, completed: true, rank: 1 })]), []);
assert.deepEqual(
  competitionBadges([make({ competitionId: 3, completed: true, rank: 2 })]), []);
assert.deepEqual(
  competitionBadges([make({ competitionId: 3, completed: true, rank: 3 })]), []);
// And fourth earned nothing before and earns nothing now.
assert.deepEqual(competitionBadges([make({ competitionId: 3, completed: true, rank: 4 })]), []);

// Undefeated needs five games, at least one win, and no losses.
assert.deepEqual(
  labels(competitionBadges([make({ competitionId: 4, played: 5, wins: 4, losses: 0 })])),
  ["Undefeated Run"]);
assert.deepEqual(
  competitionBadges([make({ competitionId: 4, played: 4, wins: 4, losses: 0 })]), []);
assert.deepEqual(
  competitionBadges([make({ competitionId: 4, played: 6, wins: 5, losses: 1 })]), []);
// Five drawn games is not a run.
assert.deepEqual(
  competitionBadges([make({ competitionId: 4, played: 5, wins: 0, losses: 0 })]), []);

// A campaign veteran needs four games, and only in a campaign.
assert.deepEqual(
  labels(competitionBadges([make({ competitionId: 5, type: "campaign", played: 4 })])),
  ["Campaign Veteran"]);
assert.deepEqual(
  competitionBadges([make({ competitionId: 5, type: "league", played: 9 })]), []);

// One competition can still earn more than one, ordered best first.
assert.deepEqual(
  labels(competitionBadges([
    make({ competitionId: 6, type: "campaign", typeLabel: "Campaign",
           rank: 1, played: 6, wins: 5, losses: 0 }),
  ])),
  ["Current Leader", "Undefeated Run", "Campaign Veteran"]);

// Never more than six. Eight competitions somebody is leading at once is not
// realistic, but the cap is what stops a profile turning into a wall of chips.
assert.equal(
  competitionBadges(Array.from({ length: 8 }, (_x, i) =>
    make({ competitionId: i, rank: 1 }))).length,
  6);

console.log("competition-badges ok");
