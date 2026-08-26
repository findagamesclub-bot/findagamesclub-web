import assert from "node:assert/strict";
import { categoryOptions, reservedCategories, tierRank } from "../discussion-categories";
import { buildPoll, parsePoll, tally } from "../poll";

const TIERS = [
  { label: "Basic Membership", reserved: [] as string[] },
  { label: "Premium Membership", reserved: ["Premium Membership"] },
];
const CATEGORIES = ["Warhammer 40k", "Painting", "Premium Membership"];

// reservedCategories
assert.deepEqual(reservedCategories({ privateDiscussionCategories: ["A", " B "] }), ["A", "B"]);
assert.deepEqual(reservedCategories({ privateDiscussionCategories: "nope" }), []);
assert.deepEqual(reservedCategories(null), []);
assert.deepEqual(reservedCategories([]), [], "a jsonb array is not the benefits object");

// A basic member sees the reserved board, locked, with the tier that opens it.
const basic = categoryOptions({ categories: CATEGORIES, tiers: TIERS, viewerRank: 0, canManageClub: false });
assert.equal(basic.filter((c) => c.lockedBy === null).length, 2);
assert.equal(basic.find((c) => c.label === "Premium Membership")?.lockedBy, "Premium Membership");

// Premium opens it.
const premium = categoryOptions({ categories: CATEGORIES, tiers: TIERS, viewerRank: 1, canManageClub: false });
assert.ok(premium.every((c) => c.lockedBy === null));

// The club passes everything, whatever tier it holds.
const owner = categoryOptions({ categories: CATEGORIES, tiers: TIERS, viewerRank: -1, canManageClub: true });
assert.ok(owner.every((c) => c.lockedBy === null));

// Someone with no tier is below every reservation.
const none = categoryOptions({ categories: CATEGORIES, tiers: TIERS, viewerRank: -1, canManageClub: false });
assert.equal(none.find((c) => c.label === "Premium Membership")?.lockedBy, "Premium Membership");

// Case and padding come from a club's own typing, not from us.
const messy = categoryOptions({
  categories: ["  premium membership  "],
  tiers: TIERS, viewerRank: 0, canManageClub: false,
});
assert.equal(messy[0].lockedBy, "Premium Membership");

// Claimed by two tiers: the harder one wins, or the lock is trivially beaten.
const doubled = categoryOptions({
  categories: ["Inner circle"],
  tiers: [
    { label: "Basic", reserved: ["Inner circle"] },
    { label: "Premium", reserved: ["Inner circle"] },
  ],
  viewerRank: 0, canManageClub: false,
});
assert.equal(doubled[0].lockedBy, "Premium");

assert.equal(tierRank([{ key: "basic" }, { key: "premium" }] as never, "premium"), 1);
assert.equal(tierRank([{ key: "basic" }] as never, null), -1);
assert.equal(tierRank([{ key: "basic" }] as never, "gone"), -1, "a deleted tier is no tier");

// --- polls ---
const poll = buildPoll("Best primer?", ["Chaos Black", " Wraithbone ", ""]);
assert.deepEqual(poll, {
  question: "Best primer?",
  options: [{ key: "o1", label: "Chaos Black" }, { key: "o2", label: "Wraithbone" }],
});

assert.equal(buildPoll("Just one?", ["Only"]), null, "a poll needs two answers");
assert.equal(buildPoll("", ["A", "B"]), null);
assert.equal(buildPoll("Too many", Array.from({ length: 12 }, (_, i) => `x${i}`))!.options.length, 8);

assert.deepEqual(parsePoll(poll), poll);
assert.equal(parsePoll({ question: "Q", options: [{ key: "a", label: "A" }] }), null);
assert.equal(parsePoll("not an object"), null);
assert.equal(parsePoll(null), null);

const result = tally(poll!, [{ optionKey: "o1" }, { optionKey: "o1" }, { optionKey: "o2" }], "o2");
assert.equal(result.total, 3);
assert.equal(result.options[0].votes, 2);
assert.equal(result.options[0].percent, 67);
assert.equal(result.myVote, "o2");

const empty = tally(poll!, [], null);
assert.equal(empty.total, 0);
assert.equal(empty.options[0].percent, 0, "no votes must not divide by zero");

// A vote for an option that has since gone is not counted into any bar.
const stale = tally(poll!, [{ optionKey: "gone" }], null);
assert.equal(stale.total, 0);

console.log("all passing");
