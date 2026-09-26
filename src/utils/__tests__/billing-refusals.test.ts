import assert from "node:assert/strict";
import { billingRefusal } from "../billing-refusals";

{
  // Every code the four migrations raise turns into a sentence, and none of
  // them leaks the code itself onto somebody's screen.
  const codes = [
    "PAYMENT_NEEDS_AMOUNT", "SUBSCRIPTION_NOT_FOUND", "SUBSCRIPTION_CANCELLED",
    "SUBSCRIPTION_NEEDS_OWNER", "LISTING_NOT_PAID", "FEATURED_OVERLAPS",
    "FEATURED_BAD_DATES", "CLUB_NOT_FOUND", "CLUB_HAS_OWNER", "CLUB_NEEDS_NAME",
    "CLUB_NEEDS_CITY", "CLAIM_NOT_FOUND", "CLAIM_ALREADY_ANSWERED",
    "CLAIM_NEEDS_REASON",
  ];
  for (const code of codes) {
    const said = billingRefusal(new Error(code));
    assert.ok(said.length > 0, code);
    assert.doesNotMatch(said, /[A-Z]{4,}_[A-Z]/, `${code} leaked its code`);
  }
}

{
  assert.match(billingRefusal(new Error("NOT_PERMITTED")), /not yours/);
  assert.match(billingRefusal(new Error('row-level security policy')), /not yours/);
  assert.match(
    billingRefusal(new Error('duplicate key value violates "club_claims_one_open"')),
    /already have a claim/);
}

{
  // Anything unrecognised still says what to do, and never "an error occurred".
  const said = billingRefusal(new Error("kaboom 42P01"));
  assert.match(said, /Try again/);
  assert.doesNotMatch(said, /error occurred/i);
  assert.ok(billingRefusal(null).length > 0);
}

console.log("billing-refusals: all assertions passed");
