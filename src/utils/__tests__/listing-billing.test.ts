import assert from "node:assert/strict";

import {
  BILLING_TABS, STANDINGS, isStanding, methodLabel, needsAttention, ownerStanding,
  planDays, standingLabel, standingTone, suggestedAmount,
} from "../listing-billing";

{
  // Every standing the view can emit has a label and a tone. A missing one puts
  // a column value like "awaiting_payment" on a club's own billing page.
  for (const s of STANDINGS) {
    assert.ok(standingLabel(s), `${s} has no label`);
    assert.doesNotMatch(standingLabel(s), /_/, `${s} leaks the column value`);
    assert.ok(standingTone(s), `${s} has no tone`);
    assert.ok(ownerStanding(s).length > 0, `${s} tells the club nothing`);
  }

  // And an unknown one degrades rather than blanking.
  assert.equal(standingLabel("teleported"), "teleported");
  assert.equal(standingTone("teleported"), "neutral");
  assert.equal(isStanding("teleported"), false);
}

{
  // Only money owed and a listing that cannot go live are an admin's work. A
  // paid-up club is not, and neither is one that closed its account.
  assert.deepEqual(STANDINGS.filter(needsAttention),
    ["awaiting_payment", "in_grace", "lapsed"]);

  // Overdue leads, because it is money already late.
  assert.equal(BILLING_TABS[0]!.key, "in_grace");
  assert.equal(BILLING_TABS[BILLING_TABS.length - 1]!.key, "all");
  for (const tab of BILLING_TABS) {
    assert.ok(tab.key === "all" || isStanding(tab.key), `${tab.key} is not a standing`);
  }
}

{
  // The sentences that carry a date, and the same ones with nothing to quote.
  assert.match(ownerStanding("active", { paidTo: "14 Oct 2026" }), /14 Oct 2026/);
  assert.match(ownerStanding("in_grace", { graceEnds: "21 Sep 2026" }), /21 Sep 2026/);
  assert.ok(ownerStanding("active").length > 0);
  assert.ok(ownerStanding("in_grace").length > 0);

  // A lapsed club that is still in the directory must not be told it is out of
  // it. That depends on the auto-hide switch, so the sentence has to ask.
  assert.match(ownerStanding("lapsed", { hidden: true }), /out of the directory/);
  assert.doesNotMatch(ownerStanding("lapsed", { hidden: false }), /out of the directory/);

  // A free listing is told it owes nothing, not shown a flag name.
  assert.match(ownerStanding("not_required"), /free/i);
}

{
  // Legacy's own numbers, and legacy's own default when the word is anything
  // else (`next_renewal_date`, listing_billing.py:104).
  assert.equal(planDays("yearly"), 365);
  assert.equal(planDays("YEARLY"), 365);
  assert.equal(planDays("monthly"), 30);
  assert.equal(planDays(""), 30);
  assert.equal(planDays(null), 30);
  assert.equal(planDays(undefined), 30);
}

{
  const settings = { monthly_price_pence: 1500, yearly_price_pence: 15000 };

  // What the subscription itself says wins, because that is what the club
  // agreed to. A price change must not re-quote an existing subscription.
  assert.equal(suggestedAmount({ price_pence: 1200, plan_interval: "monthly" }, settings), 1200);

  // Only with nothing on the row does it fall back to today's price.
  assert.equal(suggestedAmount({ price_pence: 0, plan_interval: "yearly" }, settings), 15000);
  assert.equal(suggestedAmount({ price_pence: null, plan_interval: "monthly" }, settings), 1500);
  assert.equal(suggestedAmount({}, settings), 1500);
}

{
  assert.equal(methodLabel("bank_transfer"), "Bank transfer");
  assert.doesNotMatch(methodLabel("bank_transfer"), /_/);
  assert.equal(methodLabel("carrier_pigeon"), "carrier_pigeon");
}

console.log("listing-billing: all assertions passed");

// ---------------------------------------------------------------- cost lines

import { listingCostLine, listingSubmitNote } from "../listing-billing";

// Off is the shipping state, and the two marketing pages said this as a fixed
// string until charging was switched on and it stopped being true.
assert.equal(
  listingCostLine({ enabled: false, monthly_price_pence: 1500, yearly_price_pence: 15000 }),
  "Free to list.");

assert.equal(
  listingCostLine({ enabled: true, monthly_price_pence: 1500, yearly_price_pence: 15000 }),
  "£15 a month to list, or £150 a year.");

// Pence that are not whole pounds keep their pennies.
assert.equal(
  listingCostLine({ enabled: true, monthly_price_pence: 1250, yearly_price_pence: 0 }),
  "£12.50 a month to list.");

// One plan only says one plan.
assert.equal(
  listingCostLine({ enabled: true, monthly_price_pence: 0, yearly_price_pence: 9900 }),
  "£99 a year to list.");

// Charging on with no price is nothing worth saying.
assert.equal(
  listingCostLine({ enabled: true, monthly_price_pence: 0, yearly_price_pence: 0 }),
  null);

// What happens next has to match where it actually lands.
assert.match(
  listingSubmitNote({ enabled: true, monthly_price_pence: 1500, yearly_price_pence: 15000 }),
  /how to pay/);
assert.match(
  listingSubmitNote({ enabled: false, monthly_price_pence: 1500, yearly_price_pence: 15000 }),
  /either way/);

console.log("listing-billing cost lines: all assertions passed");
