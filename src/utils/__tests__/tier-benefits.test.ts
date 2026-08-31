import assert from "node:assert/strict";
import { describeTierBenefits, groupTierBenefits } from "../tier-benefits";

const premium = {
  eventDiscountPercent: 5,
  merchandiseDiscountPercent: 10,
  coachingDiscountPercent: 10,
  maxUpcomingBookings: 4,
  extraAdvanceBookingDates: 2,
  priorityEventAdvanceDays: 30,
  lookingForGamePostLimit: 2,
  rivalryToolsAccess: true,
  merchandiseAccess: true,
  coachingBookingAccess: true,
};

const groups = groupTierBenefits(premium);
assert.deepEqual(groups.map((g) => g.group), ["savings", "access", "tools"],
  "savings leads: money is the most concrete reason to pick a tier");

const by = Object.fromEntries(groups.map((g) => [g.group, g.items]));
assert.deepEqual(by.savings, ["5% off event tickets", "10% off merchandise", "10% off coaching"]);
assert.ok(by.access.includes("Up to 4 upcoming bookings"));
assert.ok(by.access.includes("Event tickets 30 days early"));
assert.ok(by.tools.includes("Rivalry tracking"));

// Nothing is lost or duplicated by grouping.
const flat = describeTierBenefits(premium);
const grouped = groups.flatMap((g) => g.items);
assert.deepEqual([...grouped].sort(), [...flat].sort(), "grouping must not drop a perk");

// An empty group is dropped rather than rendered as a heading with nothing in it.
assert.deepEqual(groupTierBenefits({ eventDiscountPercent: 5 }).map((g) => g.group), ["savings"]);

// A tier with nothing switched on has no panel at all.
assert.deepEqual(groupTierBenefits({}), []);
assert.deepEqual(groupTierBenefits(null), []);

console.log("tier-benefits ok");
