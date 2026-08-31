import assert from "node:assert/strict";
import { competitionBadges, type BadgeSource } from "../competition-badges";

const make = (over: Partial<BadgeSource> & { competitionId: number }): BadgeSource => ({
  title: "Spring Escalation League", typeLabel: "League", type: "league",
  completed: false, rank: 0, played: 0, wins: 0, losses: 0,
  ...over,
});

const labels = (rows: ReturnType<typeof competitionBadges>) => rows.map((b) => b.label);

// Winning a finished competition is a Champion; leading a running one is not.
assert.deepEqual(
  labels(competitionBadges([make({ competitionId: 1, completed: true, rank: 1 })])),
  ["League Champion"]);
assert.deepEqual(
  labels(competitionBadges([make({ competitionId: 1, rank: 1 })])),
  ["Current Leader"]);

// The type label is used, so a campaign champion says campaign.
assert.deepEqual(
  labels(competitionBadges([
    make({ competitionId: 2, typeLabel: "Campaign", type: "campaign", completed: true, rank: 1 }),
  ])),
  ["Campaign Champion"]);

// Second and third in a finished competition, with the place spelled out.
const podium = competitionBadges([make({ competitionId: 3, completed: true, rank: 2 })]);
assert.deepEqual(labels(podium), ["Podium Finish"]);
assert.match(podium[0].context, /2nd$/);
// Fourth earns nothing.
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

// One competition can earn more than one, ordered best first.
assert.deepEqual(
  labels(competitionBadges([
    make({ competitionId: 6, type: "campaign", typeLabel: "Campaign",
           completed: true, rank: 1, played: 6, wins: 5, losses: 0 }),
  ])),
  ["Campaign Champion", "Undefeated Run", "Campaign Veteran"]);

// Never more than six.
assert.equal(
  competitionBadges(Array.from({ length: 8 }, (_x, i) =>
    make({ competitionId: i, completed: true, rank: 1 }))).length,
  6);

console.log("competition-badges ok");
