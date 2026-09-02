import assert from "node:assert/strict";
import { isFreeTier } from "../membership-tiers";

// Nothing set is nothing to pay.
assert.equal(isFreeTier(null), true);
assert.equal(isFreeTier(undefined), true);
assert.equal(isFreeTier(""), true);
assert.equal(isFreeTier("   "), true);
// The club has not decided yet, so it cannot be charged for.
assert.equal(isFreeTier("TBC"), true);
assert.equal(isFreeTier("N/A"), true);
// Said in words, or priced at nothing.
assert.equal(isFreeTier("Free"), true);
assert.equal(isFreeTier("free"), true);
assert.equal(isFreeTier("£0"), true);
assert.equal(isFreeTier("GBP 0"), true);
assert.equal(isFreeTier("0"), true);

// The case the client caught: an entry tier that costs money is a paid tier,
// whatever it is called and whichever tier is the default.
assert.equal(isFreeTier("£10"), false);
assert.equal(isFreeTier("GBP 15"), false);
assert.equal(isFreeTier("£12.50"), false);
assert.equal(isFreeTier("£10 / month"), false);

console.log("isFreeTier: all assertions passed");
