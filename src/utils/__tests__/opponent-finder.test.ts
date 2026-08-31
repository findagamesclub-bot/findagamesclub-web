import assert from "node:assert/strict";
import { suggestOpponents, winRate, type Candidate, type Viewer } from "../opponent-finder";

const viewer = (over: Partial<Viewer> = {}): Viewer => ({
  id: "me", games: ["Warhammer 40k"], playStyle: ["Casual"],
  played: 0, wins: 0, history: new Map(),
  ...over,
});

const candidate = (over: Partial<Candidate> & { id: string }): Candidate => ({
  name: over.id, games: [], playStyle: [], played: 0, wins: 0,
  ...over,
});

const names = (rows: ReturnType<typeof suggestOpponents>) => rows.map((r) => r.id);

// Nothing in common is not a recommendation.
assert.deepEqual(suggestOpponents(viewer(), [candidate({ id: "a" })]), []);

// You are never suggested to yourself.
assert.deepEqual(
  suggestOpponents(viewer(), [candidate({ id: "me", games: ["Warhammer 40k"] })]), []);

// A shared game is enough on its own, and is named.
{
  const [row] = suggestOpponents(viewer(), [candidate({ id: "a", games: ["Warhammer 40k"] })]);
  assert.equal(row.score, 14);            // 10 + min(1*4, 12)
  assert.deepEqual(row.sharedGames, ["warhammer 40k"]);
  assert.match(row.reasons[0], /^Shared games/);
}

// Matching is case-insensitive and ignores stray spacing.
assert.equal(
  suggestOpponents(viewer({ games: [" WARHAMMER 40K "] }),
    [candidate({ id: "a", games: ["warhammer 40k"] })]).length,
  1);

// History outweighs a shared game, and says how many times.
{
  const rows = suggestOpponents(
    viewer({ history: new Map([["a", 8]]) }),
    [candidate({ id: "a" }), candidate({ id: "b", games: ["Warhammer 40k"] })]);
  assert.deepEqual(names(rows), ["a", "b"]);
  assert.equal(rows[0].score, 42);        // 24 + min(8*4, 18)
  assert.match(rows[0].reasons[0], /played 8 times before/);
}

// One game played reads as "1 time", not "1 times".
assert.match(
  suggestOpponents(viewer({ history: new Map([["a", 1]]) }), [candidate({ id: "a" })])[0].reasons[0],
  /played 1 time before/);

// Two shared styles get legacy's own sentence.
assert.match(
  suggestOpponents(
    viewer({ playStyle: ["Casual", "Competitive"] }),
    [candidate({ id: "a", playStyle: ["Casual", "Competitive"] })])[0].reasons[0],
  /both enjoy casual and competitive/);

// Similar win rates score, and are only mentioned within ten points.
{
  const close = suggestOpponents(
    viewer({ played: 10, wins: 5 }),
    [candidate({ id: "a", played: 10, wins: 6 })]);
  assert.match(close[0].reasons.join(" "), /Similar win rates/);

  const far = suggestOpponents(
    viewer({ played: 10, wins: 1 }),
    [candidate({ id: "a", played: 10, wins: 9 })]);
  // Scored, but not claimed as a reason: an 80 point gap is not similar.
  assert.deepEqual(far, []);
}

// A tier that pays for placement is disclosed, never silent.
assert.match(
  suggestOpponents(viewer(), [candidate({ id: "a", priority: true })])[0].reasons[0],
  /priority placement/);

// Ties break on history, then on name.
{
  const rows = suggestOpponents(viewer(), [
    candidate({ id: "zoe", games: ["Warhammer 40k"] }),
    candidate({ id: "ada", games: ["Warhammer 40k"] }),
  ]);
  assert.deepEqual(names(rows), ["ada", "zoe"]);
}

// Four at most.
assert.equal(
  suggestOpponents(viewer(), Array.from({ length: 9 }, (_x, i) =>
    candidate({ id: `p${i}`, games: ["Warhammer 40k"] }))).length,
  4);

// Never played is a zero rate, not a division by zero.
assert.equal(winRate(0, 0), 0);
assert.equal(winRate(4, 1), 25);

console.log("opponent-finder ok");
