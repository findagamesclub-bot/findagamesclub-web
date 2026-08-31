import assert from "node:assert/strict";
import { betterOffer, clampPercent, memberAmount, priceLines } from "../shop-pricing";
import type { MembershipTier } from "@/types/clubDetail";

const tier = (key: string, label: string, percent: number): MembershipTier => ({
  key, label, price: null, priceDuration: "", description: null, isBasic: key === "basic",
  benefits: [], benefitGroups: [], benefitValues: { merchandiseDiscountPercent: percent },
  billingOptions: [], eventDiscountPercent: 0, reservedCategories: [],
});

const TIERS = [tier("basic", "Basic", 0), tier("premium", "Premium", 10)];

// memberAmount
assert.equal(memberAmount("£25", 10), 22.5);
assert.equal(memberAmount("£15", 10), 13.5);
assert.equal(memberAmount("£25", 0), 25);
// Pennies rounded before subtracting, as the SQL does. 33% of £19.99 unrounded
// leaves a total with six decimal places on it.
assert.equal(memberAmount("£19.99", 33), 19.99 - Math.round(19.99 * 33) / 100);
assert.equal(memberAmount(null, 10), 0);

assert.equal(clampPercent("10"), 10);
assert.equal(clampPercent(-5), 0);
assert.equal(clampPercent(140), 100);
assert.equal(clampPercent(undefined), 0);

// betterOffer
assert.deepEqual(betterOffer(TIERS, "basic", 0), { percent: 10, tierLabel: "Premium" });
assert.equal(betterOffer(TIERS, "premium", 10), null, "already on the best tier");
assert.equal(betterOffer(TIERS, null, 0)?.tierLabel, "Premium", "signed out sees the offer");

// priceLines
assert.deepEqual(priceLines({ price: "£25", discountPercent: 10, tierLabel: "Premium", offer: null }),
  { was: "£25", now: "£22.50", note: "Premium price" });

assert.deepEqual(
  priceLines({ price: "£25", discountPercent: 0, tierLabel: "Basic",
              offer: { percent: 10, tierLabel: "Premium" } }),
  { was: null, now: "£25", note: "£22.50 with Premium" });

// A price that is not a number must not become "£0 member price".
assert.deepEqual(priceLines({ price: "Pay what you can", discountPercent: 10, tierLabel: "P", offer: null }),
  { was: null, now: "Pay what you can", note: null });
assert.deepEqual(priceLines({ price: null, discountPercent: 10, tierLabel: "P", offer: null }),
  { was: null, now: "Price TBC", note: null });

console.log("shop-pricing ok");
