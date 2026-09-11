import assert from "node:assert/strict";
import { higherTiers } from "../membership-tiers";
import type { MembershipTier } from "@/types/clubDetail";

const at = (key: string) => ({ key }) as MembershipTier;
const ladder = [at("basic"), at("premium"), at("life")];

// Position is the ladder, so only what sits after theirs is offered.
assert.deepEqual(higherTiers(ladder, "basic").map((t) => t.key), ["premium", "life"]);
assert.deepEqual(higherTiers(ladder, "premium").map((t) => t.key), ["life"]);
// The top of the ladder has nowhere to go. This is what keeps the empty footer
// strip off the card, so it is the assertion that matters most here.
assert.deepEqual(higherTiers(ladder, "life"), []);
// On no tier is below all of it.
assert.deepEqual(higherTiers(ladder, null).map((t) => t.key), ["basic", "premium", "life"]);
// A tier the club has since removed reads the same way.
assert.deepEqual(higherTiers(ladder, "gone").map((t) => t.key), ["basic", "premium", "life"]);
// One tier is never a choice.
assert.deepEqual(higherTiers([at("only")], "only"), []);

console.log("higher-tiers: all assertions passed");
