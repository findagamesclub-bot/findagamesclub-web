import assert from "node:assert/strict";
import { priceCoaching, slotPrice, type CoachingStanding } from "../coaching-pricing";

// --------------------------------------- the slot's price, as clubs type it
{
  // Mirrors `price_from_text` in 0157, and the SQL suite pins the same cases.
  assert.equal(slotPrice("GBP 10"), 10);
  assert.equal(slotPrice("£12.50"), 12.5);
  assert.equal(slotPrice("8"), 8);
  // Anything unreadable is nothing to pay, which is the honest reading of a
  // blank: a club that has not named a price is not charging here.
  assert.equal(slotPrice("Free"), 0);
  assert.equal(slotPrice(""), 0);
  assert.equal(slotPrice(null), 0);
  assert.equal(slotPrice(undefined), 0);
}

const basic: CoachingStanding = {
  points: 400, pointValue: 0.05, capPercent: 50,
  discountPercent: 10, currency: "GBP",
};

// ------------------------- the tier discount, which nothing applied before
{
  const quote = priceCoaching(basic, "GBP 10", 0);
  assert.equal(quote.basePrice, 10);
  assert.equal(quote.tierDiscount, 1);
  assert.equal(quote.payable, 9);
  assert.equal(quote.total, 9);
  // The SQL agrees: stage12-coaching-points asserts 10 / 10% / 1.00 / 9.00.
}

// ----------------------------------------- the cap, and asking for too much
{
  // £9 payable, cap 50% is £4.50, at 0.05 a point that is 90 points.
  const quote = priceCoaching(basic, "GBP 10", 200);
  assert.equal(quote.maxPoints, 90);
  assert.equal(quote.pointsOff, 4.5);
  assert.equal(quote.total, 4.5);
  // Trimmed rather than refused: the member gets what they are allowed, which
  // is what the trigger does too.

  const some = priceCoaching(basic, "GBP 10", 20);
  assert.equal(some.pointsOff, 1);
  assert.equal(some.total, 8);
}

// ----------------------------------- a balance smaller than the cap wins
{
  const broke = priceCoaching({ ...basic, points: 30 }, "GBP 10", 100);
  assert.equal(broke.maxPoints, 30, "never more than they hold");
  assert.equal(broke.pointsOff, 1.5);
}

// ------------------------------------------- nothing to offer says nothing
{
  // A free session.
  assert.equal(priceCoaching(basic, "Free", 50).canRedeem, false);
  // A club with no points scheme.
  assert.equal(priceCoaching({ ...basic, pointValue: null }, "GBP 10", 50).canRedeem, false);
  // A tier that takes nothing off.
  assert.equal(priceCoaching({ ...basic, capPercent: 0 }, "GBP 10", 50).canRedeem, false);
  // A member with none.
  assert.equal(priceCoaching({ ...basic, points: 0 }, "GBP 10", 50).canRedeem, false);

  // And a session the tier has already made free has nothing left to take.
  const freeToMe = priceCoaching({ ...basic, discountPercent: 100 }, "GBP 10", 50);
  assert.equal(freeToMe.payable, 0);
  assert.equal(freeToMe.canRedeem, false);
  assert.equal(freeToMe.total, 0);
}

// ------------------------------------------------ a cap that rounds to none
{
  // £1.11 less the tier's 10% is £1.00; a 10% cap on that is 10p, which at
  // 0.05 a point is 2 points. Not zero, so it is offered.
  const thin = priceCoaching({ ...basic, capPercent: 10 }, "GBP 1.11", 10);
  assert.equal(thin.payable, 1);
  assert.equal(thin.canRedeem, true);
  assert.equal(thin.maxPoints, 2);

  // Under a penny of allowance is nothing, and the field goes rather than
  // offering a point that buys nothing.
  const none = priceCoaching({ ...basic, capPercent: 1 }, "GBP 1", 10);
  assert.equal(none.maxPoints, 0);
  assert.equal(none.canRedeem, false);
}

// ------------------------------------------------------- money stays money
{
  // Thirds of a penny must not creep in: every figure is rounded to 2dp.
  const odd = priceCoaching({ ...basic, discountPercent: 33 }, "GBP 9.99", 7);
  for (const n of [odd.basePrice, odd.tierDiscount, odd.payable, odd.pointsOff, odd.total]) {
    assert.equal(Math.round(n * 100) / 100, n, `${n} is not a money figure`);
  }
  assert.ok(odd.total >= 0);
}

console.log("coaching-pricing: all pass");
