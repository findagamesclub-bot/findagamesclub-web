import assert from "node:assert/strict";
import { memberRecord, scoreTrend, streakLabel, type StatGame } from "../member-stats";

const g = (date: string, outcome: StatGame["outcome"],
           myScore: number | null = null, theirScore: number | null = null): StatGame =>
  ({ date, outcome, myScore, theirScore });

// The client's own figures: 18 played, 8 wins, 2 draws, 8 losses, 44.4%.
const eighteen: StatGame[] = [
  ...Array.from({ length: 8 }, (_, i) => g(`2026-01-${10 + i}`, "won", 60, 40)),
  ...Array.from({ length: 2 }, (_, i) => g(`2026-02-${10 + i}`, "drew", 50, 50)),
  ...Array.from({ length: 8 }, (_, i) => g(`2026-03-${10 + i}`, "lost", 40, 80)),
];
let r = memberRecord(eighteen);
assert.equal(r.played, 18);
assert.deepEqual([r.won, r.drawn, r.lost], [8, 2, 8]);
assert.equal(r.winRate, 44.4, "matches the local app's figure");

// Averages come only from games that carry both scores.
assert.equal(r.averageFor, 50);
assert.equal(r.averageAgainst, 58.9, "(8×40 + 2×50 + 8×80) / 18");
assert.equal(memberRecord([g("2026-01-01", "won")]).averageFor, null,
  "an outcome with no scores contributes no average");

// A game nobody scored is not a loss. It must not drag the win rate down.
r = memberRecord([g("2026-01-02", "won"), g("2026-01-03", null)]);
assert.equal(r.played, 1);
assert.equal(r.winRate, 100);

// The current run reads from the newest game backwards, whatever order they arrive in.
r = memberRecord([g("2026-01-01", "won"), g("2026-03-01", "lost"), g("2026-02-01", "lost")]);
assert.deepEqual(r.streak, { kind: "lost", length: 2 });

// A draw breaks a run rather than extending it.
r = memberRecord([g("2026-03-01", "won"), g("2026-02-01", "drew"), g("2026-01-01", "won")]);
assert.deepEqual(r.streak, { kind: "won", length: 1 });
assert.equal(r.longestWin, 1);

// The longest win run is found anywhere in the history, not just at the end.
r = memberRecord([
  g("2026-01-01", "won"), g("2026-01-02", "won"), g("2026-01-03", "won"),
  g("2026-01-04", "lost"), g("2026-01-05", "won"),
]);
assert.equal(r.longestWin, 3);
assert.deepEqual(r.streak, { kind: "won", length: 1 });

// Last five, newest first, as the local app writes it.
assert.equal(memberRecord(eighteen).lastFive, "0-0-5");

// Nothing played yet reads as nothing, never as zeroes that imply losses.
r = memberRecord([]);
assert.deepEqual([r.played, r.winRate, r.averageFor, r.streak, r.longestWin],
  [0, null, null, null, 0]);
assert.equal(r.lastFive, "0-0-0");

// The trend is oldest to newest, scored games only, capped.
const trend = scoreTrend([
  g("2026-01-01", "won", 60, 40), g("2026-01-02", "lost", 30, 70),
  g("2026-01-03", "won"), g("2026-01-04", "won", 55, 45),
]);
assert.deepEqual(trend.map((p) => p.date), ["2026-01-01", "2026-01-02", "2026-01-04"]);
assert.deepEqual(trend[0], { date: "2026-01-01", mine: 60, theirs: 40 });
assert.equal(scoreTrend(eighteen, 5).length, 5, "capped to the most recent");
assert.deepEqual(scoreTrend([]), []);

// Wording.
assert.equal(streakLabel({ kind: "won", length: 3 }), "Win streak");
assert.equal(streakLabel({ kind: "won", length: 1 }), "Won the last one");
assert.equal(streakLabel({ kind: "lost", length: 4 }), "Loss streak");
assert.equal(streakLabel(null), null);
assert.equal(streakLabel({ kind: "drew", length: 0 }), null);

console.log("member stats: all assertions passed");

// The "last five" figure is across those five, not across a career. The five
// most recent here are won, lost, lost, won, won, so recent form is 60% while
// the career rate is 66.7%, and the tile must show the former.
{
  const games: StatGame[] = [
    { date: "2026-06-01", outcome: "won", myScore: 20, theirScore: 10 },
    { date: "2026-06-02", outcome: "won", myScore: 20, theirScore: 10 },
    { date: "2026-06-03", outcome: "won", myScore: 20, theirScore: 10 },
    { date: "2026-06-04", outcome: "lost", myScore: 10, theirScore: 20 },
    { date: "2026-06-05", outcome: "lost", myScore: 10, theirScore: 20 },
    { date: "2026-06-06", outcome: "won", myScore: 20, theirScore: 10 },
  ];
  const r = memberRecord(games);
  assert.equal(r.lastFive, "3-0-2");
  assert.equal(r.lastFiveWinRate, 60);
  assert.equal(r.winRate, 66.7);
}

// Nobody has played: no rate rather than a zero that reads as "never wins".
assert.equal(memberRecord([]).lastFiveWinRate, null);

console.log("last five ok");
