import assert from "node:assert/strict";
import { yearlySaving, perMonth } from "../membership-billing";
import type { BillingOption } from "@/types/payment";

const opt = (cadence: string, price: string): BillingOption =>
  ({ id: cadence, label: cadence, price, cadence });

// Didcot Basic: £10 a month against £100 a year is two months free.
assert.deepEqual(yearlySaving([opt("month", "£10"), opt("year", "£100")]),
  { amount: 20, percent: 17 });

// Didcot Premium: £15 vs £150.
assert.deepEqual(yearlySaving([opt("month", "£15"), opt("year", "£150")]),
  { amount: 30, percent: 17 });

// G Matthews prices its year ABOVE twelve months. No badge is better than
// "save -£210", so this must return null rather than a negative.
assert.equal(yearlySaving([opt("month", "£30"), opt("year", "£150")])?.amount, 210);
assert.equal(yearlySaving([opt("month", "£10"), opt("year", "£130")]), null,
  "a dearer year must not claim a saving");
assert.equal(yearlySaving([opt("month", "£10"), opt("year", "£120")]), null,
  "breaking even is not a saving");

// Nothing to compare.
assert.equal(yearlySaving([opt("month", "£10")]), null);
assert.equal(yearlySaving([]), null);

assert.equal(perMonth([opt("year", "£100")]), "£8.33 a month");
assert.equal(perMonth([opt("month", "£10")]), null);

console.log("membership-pricing ok");
