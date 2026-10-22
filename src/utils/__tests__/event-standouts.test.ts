import assert from "node:assert/strict";
import { mostTaken, standouts, undefeated } from "../event-standouts";
import type { EventGroupRow, EventPlayer } from "@/services/meta.service";

const g = (over: Partial<EventGroupRow>): EventGroupRow => ({
  label: "Adepta Sororitas", parent: "", players: 1, appearances: 1,
  games: 2, wins: 1, winRate: 50, earlySignal: false, ...over,
});
const p = (over: Partial<EventPlayer>): EventPlayer => ({
  profileId: null, player: "Ann Lee", faction: "Adepta Sororitas",
  games: 3, wins: 3, draws: 0, losses: 0, ...over,
});

// Most TAKEN, not best. A faction two people brought leads one that went
// unbeaten in a single game, because the question is what was popular.
assert.equal(mostTaken([
  g({ label: "Orks", players: 1, winRate: 100 }),
  g({ label: "Adepta Sororitas", players: 2, winRate: 25 }),
])!.label, "Adepta Sororitas");

// A tie on people goes to the one with more armies behind it, then by name,
// so the answer is stable rather than whatever order SQL handed back.
assert.equal(mostTaken([
  g({ label: "Orks", players: 2, appearances: 2 }),
  g({ label: "Aeldari", players: 2, appearances: 5 }),
])!.label, "Aeldari");
assert.equal(mostTaken([]), null);

// A draw is not a loss, so somebody who drew every round is still undefeated.
// That is what the word means at a tournament and it is easy to get wrong by
// filtering on wins.
assert.deepEqual(undefeated([
  p({ player: "Ann Lee", wins: 3, losses: 0 }),
  p({ player: "Ben Shah", wins: 0, draws: 3, losses: 0 }),
  p({ player: "Cat Moss", wins: 2, losses: 1 }),
]).map((x) => x.player), ["Ann Lee", "Ben Shah"]);

// Somebody with no scored games has not gone undefeated, they have not played.
assert.deepEqual(undefeated([p({ games: 0, wins: 0, losses: 0 })]), []);

{
  const out = standouts({
    factions: [g({ label: "Adepta Sororitas", players: 2 })],
    detachments: [g({ label: "Hallowed Martyrs", players: 1 })],
    dispositions: [g({ label: "Disruption", players: 1 })],
    players: [p({ player: "Ann Lee" }), p({ player: "Ben Shah", wins: 1, losses: 2 })],
  });
  const by = (label: string) => out.find((s) => s.label === label)!;
  assert.equal(by("Played").value, "2");
  assert.equal(by("Undefeated").value, "1");
  assert.equal(by("Undefeated").note, "Ann Lee");
  assert.equal(by("Most taken army").note, "taken by 2 players");
  // One player is one player. The singular slip has reached a tile, a list
  // header, a unit count and a disposition picker, so it gets a test here.
  assert.equal(by("Most taken detachment").note, "taken by 1 player");
}

// Nothing recorded means no tiles at all, rather than a row of zeroes.
assert.deepEqual(standouts({ factions: [], detachments: [], dispositions: [], players: [] }), []);

// And an event with armies but no scored game says what was taken without
// claiming anybody played: the two player tiles need a scored game to exist.
{
  const out = standouts({
    factions: [g({ label: "Orks", players: 4, games: 0, winRate: null })],
    detachments: [], dispositions: [], players: [],
  });
  assert.deepEqual(out.map((s) => s.label), ["Most taken army"]);
}

console.log("event-standouts: all pass");
