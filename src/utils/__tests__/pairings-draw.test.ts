import assert from "node:assert/strict";

import { drawRound, drawSummary, shuffle, uniquePlayers } from "../pairings-draw";

const player = (name: string) => ({ profileId: null, name });

// A pinned "random" so the draw is reproducible: always take the last item.
const last = () => 0.999999;

// --- shuffle -------------------------------------------------------------

{
  const items = [1, 2, 3, 4];
  const out = shuffle(items, last);
  assert.deepEqual(items, [1, 2, 3, 4], "the input is not mutated");
  assert.equal(out.length, 4);
  assert.deepEqual([...out].sort(), [1, 2, 3, 4], "nobody is lost or duplicated");
}

{
  // A real shuffle over 200 runs must not always return the same order.
  const orders = new Set<string>();
  for (let i = 0; i < 200; i++) orders.add(shuffle([1, 2, 3, 4]).join(""));
  assert.ok(orders.size > 1, "Math.random actually shuffles");
}

// --- an even turnout -----------------------------------------------------

{
  const matches = drawRound([player("Ann"), player("Ben"), player("Cat"), player("Dan")], last);
  assert.equal(matches.length, 2);
  assert.deepEqual(matches.map((m) => m.table), ["1", "2"], "tables count from 1");
  assert.ok(matches.every((m) => m.playerTwo), "nobody sits out");

  const names = matches.flatMap((m) => [m.playerOne.name, m.playerTwo!.name]).sort();
  assert.deepEqual(names, ["Ann", "Ben", "Cat", "Dan"], "everybody plays once");
}

// --- an odd turnout ------------------------------------------------------

{
  const matches = drawRound([player("Ann"), player("Ben"), player("Cat")], last);
  assert.equal(matches.length, 2);
  assert.equal(matches.filter((m) => !m.playerTwo).length, 1, "exactly one bye");
  assert.equal(matches[1]!.playerTwo, null, "the bye is the last table");
}

// --- one row per person ---------------------------------------------------

{
  // What the client hit: six bookings under one account, so six copies of the
  // same person in the draw, paired with each other and once with themselves.
  const sixBookings = [
    { profileId: "p1", name: "Gulnabi Afridi" },
    { profileId: "p1", name: "Gulnabi Afridi" },
    { profileId: "p1", name: "Gulnabi Afridi" },
    { profileId: "p2", name: "Joe Matthews" },
  ];
  assert.deepEqual(uniquePlayers(sixBookings).map((p) => p.name),
    ["Gulnabi Afridi", "Joe Matthews"]);

  const matches = drawRound(sixBookings, last);
  assert.equal(matches.length, 1, "two people is one table, not four");
  assert.notEqual(matches[0]!.playerOne.name, matches[0]!.playerTwo?.name,
    "and nobody plays themselves");
}

{
  // Booked at the door with no account, twice, spelled differently.
  const walkIns = [
    { profileId: null, name: "Pete H" },
    { profileId: null, name: "  pete h  " },
    { profileId: null, name: "Peter Hill" },
  ];
  assert.deepEqual(uniquePlayers(walkIns).map((p) => p.name), ["Pete H", "Peter Hill"],
    "the same name folded is the same person; a different name is not");
}

{
  // Two different people who happen to share a name are told apart by account.
  const namesakes = [
    { profileId: "a", name: "Chris Green" },
    { profileId: "b", name: "Chris Green" },
  ];
  assert.equal(uniquePlayers(namesakes).length, 2, "the account decides when there is one");
}

{
  assert.deepEqual(uniquePlayers([{ profileId: null, name: "  " }]), [],
    "a booking with no name on it is nobody");
}

// --- the empties ---------------------------------------------------------

{
  assert.deepEqual(drawRound([], last), [], "nobody in, nothing out");
  assert.deepEqual(drawRound([player("  "), player("")], last), [], "blank names are not players");

  const one = drawRound([player("Ann")], last);
  assert.equal(one.length, 1);
  assert.equal(one[0]!.playerTwo, null, "one person is a bye, not a dropped row");
}

// --- the summary ---------------------------------------------------------

{
  assert.equal(drawSummary([]), "Nobody to pair yet.");
  assert.equal(drawSummary(drawRound([player("Ann"), player("Ben")], last)), "1 table");
  assert.equal(
    drawSummary(drawRound([player("Ann"), player("Ben"), player("Cat")], last)),
    "1 table and one bye",
  );
  assert.equal(
    drawSummary(drawRound(
      [player("Ann"), player("Ben"), player("Cat"), player("Dan"), player("Eve")], last,
    )),
    "2 tables and one bye",
  );
}

console.log("pairings-draw: all assertions passed");
