import assert from "node:assert/strict";

import { parseSmartSearch } from "../smart-search";

/**
 * The box turns a sentence into directory filters. It had no test, and the hole
 * it hid was this: `q` was the recognised games and facilities and nothing
 * else, so anything the parser could not classify was thrown away. Typing a
 * club's name filtered nothing and the page answered with the whole directory
 * under "Applied your search without adding extra filters."
 */

const options = {
  cities: ["Didcot", "Newcastle", "Oxford", "Liverpool"],
  formats: [
    { slug: "board-games", label: "Board games" },
    { slug: "miniatures", label: "Miniatures" },
    { slug: "family-games", label: "Family games" },
  ],
  days: ["Monday", "Tuesday", "Wednesday", "Thursday"],
  facets: ["Warhammer 40,000", "Kill Team", "Catan", "Parking", "Step-free access"],
  withinMiles: ["5", "10", "20", "50"],
  reviewRatings: ["2", "3", "4"],
};

const parse = (q: string) => parseSmartSearch(q, options);

// ---------------------------------------------- a club name is a search term

// The one that shipped broken: nothing recognised, so nothing was searched.
assert.equal(parse("Northern Dice Society").q, "Northern Dice Society");
assert.equal(parse("Northern Dice Society").city, "");
assert.equal(parse("Northern Dice Society").format, "");

// A name plus a town keeps both, rather than listing every club in the town.
{
  const r = parse("Northern Dice Society in Newcastle");
  assert.equal(r.city, "Newcastle");
  assert.match(r.q, /northern dice society/i);
}

// ------------------------------------------- and none of the old cases move

// A game it knows is still an exact facet, with no stray words added.
assert.equal(parse("Warhammer 40,000").q, "Warhammer 40,000");
assert.equal(parse("clubs playing Catan").q, "Catan");

// A format is a format, not a search term.
{
  const r = parse("board games in Didcot");
  assert.equal(r.format, "board-games");
  assert.equal(r.city, "Didcot");
  assert.equal(r.q, "");
}

// A day, a radius and a rating are filters, and leave nothing behind.
{
  const r = parse("Kill Team on Thursday within 20 miles of Oxford");
  assert.equal(r.day, "Thursday");
  assert.equal(r.withinMiles, "20");
  assert.equal(r.q, "Kill Team");
}
{
  const r = parse("4 star clubs near Liverpool");
  assert.equal(r.reviewRating, "4");
  assert.equal(r.q, "");
}

// Generic words alone are not a search. "clubs near me" must not search for
// "me", which postcodes.io answers with Pity Me in County Durham.
assert.equal(parse("clubs near me").q, "");
assert.equal(parse("find a club").q, "");

// The readback only claims filters it actually set.
assert.match(parse("board games in Didcot").summary, /Didcot/);
assert.match(parse("Northern Dice Society").summary, /without adding extra filters/);

console.log("smart-search: all assertions passed");
