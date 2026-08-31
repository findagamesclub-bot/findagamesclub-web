import assert from "node:assert/strict";
import { countUnrecorded, filterGames, tally } from "../game-filter";
import type { MyGame } from "@/services/games.service";

const make = (over: Partial<MyGame> & { id: number; date: string }): MyGame => ({
  club: { slug: "didcot", name: "Didcot Wargames", logoUrl: null },
  time: "19:00", title: "Warhammer 40k", opponentId: "p1", opponentName: "Joe Matthews",
  myScore: null, theirScore: null, myArmy: "", theirArmy: "",
  outcome: null, iBooked: true, played: true,
  ...over,
} as MyGame);

const games = [
  make({ id: 1, date: "2026-08-20", myScore: 90, theirScore: 10, outcome: "won",
         myArmy: "Death Guard" }),
  make({ id: 2, date: "2026-08-10", myScore: 60, theirScore: 88, outcome: "lost",
         opponentName: "Tom Allen" }),
  make({ id: 3, date: "2026-08-01" }),                              // played, no score
  make({ id: 4, date: "2026-12-01", played: false }),               // still to come
];

const ids = (rows: MyGame[]) => rows.map((r) => r.id);

// A game in the future is not "unrecorded": there is nothing to record yet.
assert.deepEqual(ids(filterGames(games, { filter: "unrecorded" })), [3]);
assert.equal(countUnrecorded(games), 1);

assert.deepEqual(ids(filterGames(games, { filter: "played" })), [1, 2]);
assert.deepEqual(ids(filterGames(games, { filter: "won" })), [1]);

// Search covers opponent, game, club and either army.
assert.deepEqual(ids(filterGames(games, { query: "tom" })), [2]);
assert.deepEqual(ids(filterGames(games, { query: "death guard" })), [1]);
assert.equal(filterGames(games, { query: "didcot" }).length, 4);
assert.deepEqual(filterGames(games, { query: "zzz" }), []);

// Newest first by default.
assert.deepEqual(ids(filterGames(games, {})), [4, 1, 2, 3]);
assert.deepEqual(ids(filterGames(games, { sort: "oldest" })), [3, 2, 1, 4]);
// By opponent name, then newest first inside each: three of these are
// against Joe Matthews, so his most recent leads and Tom Allen follows.
assert.deepEqual(ids(filterGames(games, { sort: "opponent" })), [4, 1, 3, 2]);

// The tally counts only games with a result, never the unplayed ones.
assert.deepEqual(tally(games), { played: 2, won: 1, drawn: 0, lost: 1 });

console.log("game-filter ok");
