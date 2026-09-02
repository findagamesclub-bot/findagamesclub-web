import assert from "node:assert/strict";
import { buildTierComparison } from "../tier-comparison";
import type { MembershipTier } from "@/types/clubDetail";

const tier = (label: string, isBasic: boolean, benefitValues: Record<string, unknown>): MembershipTier => ({
  key: label.toLowerCase(), label, price: null, priceDuration: "", description: null,
  isBasic, isFree: isBasic, benefits: [], benefitGroups: [], benefitValues,
  billingOptions: [], eventDiscountPercent: 0, reservedCategories: [],
});

const tiers = [
  tier("Basic", true, { eventDiscountPercent: 5 }),      // set, but basic never counts
  tier("Premium", false, { eventDiscountPercent: 10, rivalryToolsAccess: true }),
];
const rows = buildTierComparison(tiers);
const by = Object.fromEntries(rows.map((r) => [r.label, r.values]));

// Everything a member gets whatever they pay is stated, not inferred from blanks.
assert.deepEqual(by["Club member access"], ["Yes", "Yes"]);
assert.deepEqual(by["Earn loyalty points"], ["Yes", "Yes"]);

// Basic is what nothing buys you, so it never counts as an extra even when set.
assert.deepEqual(by["Event ticket discount"], [null, "10%"],
  "the basic column must stay empty for an extra");

assert.deepEqual(by["Rivalry tracking"], [null, "Yes"]);

// A row nobody offers is dropped, not shown empty across every column.
assert.equal("Coaching discount" in by, false);
assert.equal("Club merchandise" in by, false);

// Bonus points collapse into one readable cell.
{
  const r = buildTierComparison([
    tier("Basic", true, {}),
    tier("Gold", false, { bonusMembershipApprovalPoints: 20, bonusGameBookingPoints: 5 }),
  ]);
  const bonus = r.find((x) => x.label === "Bonus loyalty points");
  assert.deepEqual(bonus?.values, [null, "join +20, booking +5"]);
}

// No tiers, no table.
assert.deepEqual(buildTierComparison([]), []);

console.log("tier-comparison ok");
