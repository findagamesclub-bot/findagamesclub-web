import assert from "node:assert/strict";
import { offerable } from "../placing-list";
import type { MemberList } from "@/services/resultArmies.service";

const list = (over: Partial<MemberList>): MemberList => ({
  id: 4, profileId: "member-1", name: "My Sororitas shelf",
  factionId: "adepta-sororitas", faction: "Adepta Sororitas",
  detachments: ["Hallowed Martyrs"], disposition: "Priority Assets",
  points: 2000, version: 1, ...over,
});

const LISTS = [list({ id: 4 }), list({ id: 9, profileId: "member-2" })];

// The whole item, with the real number off the client's own data. A placing
// imported from legacy carries legacy's own list id, which `army_lists` has
// never had, and seeding it put it straight back on the hidden field.
assert.equal(offerable(LISTS, "member-1", 1777071784864485), null);

// A real link to one of this player's lists is kept, or saving a correct row
// would quietly unlink it.
assert.equal(offerable(LISTS, "member-1", 4), 4);

// Somebody else's list is not offerable, which is what arises when the club
// corrects the name on a row that already had one.
assert.equal(offerable(LISTS, "member-1", 9), null);
assert.equal(offerable(LISTS, "member-2", 9), 9);

// An unlinked row cannot hold a list at all: the database refuses one against
// a free-text name, so a dialog offering to keep it would be lying.
assert.equal(offerable(LISTS, null, 4), null);

// Nothing saved stays nothing.
assert.equal(offerable(LISTS, "member-1", null), null);

// A club with the builder off has no lists to offer. The hidden field is not
// rendered there either, so the stored link is left alone rather than cleared,
// which is the three-state contract the action already carries: absent means
// leave it, "" means take it off.
assert.equal(offerable([], "member-1", 4), null);

console.log("placing-list: all pass");
