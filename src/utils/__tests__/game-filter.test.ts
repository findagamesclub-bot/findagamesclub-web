import assert from "node:assert/strict";
import { countUnrecorded, filterGames, gameMonths, tally } from "../game-filter";
import type { MyGame } from "@/services/games.service";

const make = (over: Partial<MyGame> & { id: number; date: string }): MyGame => ({
  club: { slug: "didcot", name: "Didcot Wargames", logoUrl: null },
  time: "19:00", title: "Warhammer 40k", opponentId: "p1", opponentName: "Joe Matthews",
  myScore: null, theirScore: null, myArmy: "", theirArmy: "",
  outcome: null, iBooked: true, played: true,
  payment: { status: "unpaid", total: 5, currency: "GBP" },
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

// --- The month -------------------------------------------------------------

// Three of these are August and one is December, so narrowing to August is
// the whole point of the picker: before this, the page read the newest
// twenty-five and a month filter would have answered about the twenty-five.
assert.deepEqual(ids(filterGames(games, { month: "2026-08" })), [1, 2, 3]);
assert.deepEqual(ids(filterGames(games, { month: "2026-12" })), [4]);
// A month the member has nothing in narrows to nothing rather than to
// everything, which is the failure mode a missing guard gives.
assert.deepEqual(filterGames(games, { month: "2019-03" }), []);
// Whitespace out of an address is not a month of its own.
assert.deepEqual(ids(filterGames(games, { month: "  2026-12  " })), [4]);
// And an empty month is every game, not none.
assert.equal(filterGames(games, { month: "" }).length, 4);

// The two axes narrow together rather than one replacing the other.
assert.deepEqual(ids(filterGames(games, { month: "2026-08", filter: "won" })), [1]);

// Only months with games in them, newest first, each saying what it holds.
assert.deepEqual(gameMonths(games), [
  { value: "2026-12", label: "Dec 2026 (1)" },
  { value: "2026-08", label: "Aug 2026 (3)" },
]);
assert.deepEqual(gameMonths([]), []);

// --- The money -------------------------------------------------------------

const money = [
  make({ id: 10, date: "2026-08-20", payment: { status: "unpaid", total: 5, currency: "GBP" } }),
  make({ id: 11, date: "2026-08-19",
         payment: { status: "paid_on_the_door", total: 5, currency: "GBP" } }),
  make({ id: 12, date: "2026-08-18",
         payment: { status: "paid_in_advance", total: 5, currency: "GBP" } }),
  // Their tier waived the fee. Not an unpaid table, and counting it as one is
  // how somebody is chased for money their membership covered.
  make({ id: 13, date: "2026-08-17", payment: { status: "unpaid", total: 0, currency: "GBP" } }),
];

assert.deepEqual(ids(filterGames(money, { money: "topay" })), [10]);
assert.deepEqual(ids(filterGames(money, { money: "paid" })), [11, 12]);
assert.deepEqual(ids(filterGames(money, { money: "free" })), [13]);
assert.equal(filterGames(money, { money: "any" }).length, 4);

// The three groups partition, so a club's own screen and this one cannot
// disagree about how many tables are outstanding.
assert.equal(
  filterGames(money, { money: "topay" }).length
  + filterGames(money, { money: "paid" }).length
  + filterGames(money, { money: "free" }).length,
  money.length,
);

// A free table marked paid is still nothing to pay, never both.
const waived = [make({ id: 14, date: "2026-08-16",
  payment: { status: "paid_on_the_door", total: 0, currency: "GBP" } })];
assert.deepEqual(ids(filterGames(waived, { money: "free" })), [14]);
assert.deepEqual(filterGames(waived, { money: "paid" }), []);

console.log("game-filter ok");
