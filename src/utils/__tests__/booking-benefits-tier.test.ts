import assert from "node:assert/strict";
import { resolveBenefits } from "../booking-benefits";

// Didcot: the club allows 2 bookings and 1 open post; Premium grants 4 and 2.
const club = {
  advanceBookingDates: 4,
  upcomingBookingLimit: 2,
  eventAdvanceDays: 90,
  lookingForGameFutureDates: 2,
  lookingForGamePostLimit: 1,
  loyaltyRedemptionCapPercent: 100,
};

const premium = resolveBenefits({
  maxUpcomingBookings: 4,
  lookingForGameFutureDates: 2,
  lookingForGamePostLimit: 2,
}, club);

assert.equal(premium.maxUpcomingBookings, 4, "the tier's larger allowance is honoured");
assert.equal(premium.lookingForGamePostLimit, 2, "and its extra open post");
assert.equal(premium.lookingForGameFutureDates, 2, "equal values are unchanged");

// A tier that says nothing keeps the club's numbers.
const basic = resolveBenefits({ maxUpcomingBookings: 0, lookingForGamePostLimit: 0 }, club);
assert.equal(basic.maxUpcomingBookings, 2);
assert.equal(basic.lookingForGamePostLimit, 1);

// A tier can never narrow what the club allows.
const mean = resolveBenefits({ maxUpcomingBookings: 1, lookingForGamePostLimit: 0 }, club);
assert.equal(mean.maxUpcomingBookings, 2, "a tier does not take the club's allowance away");

// No tier benefits at all, and the array shape the importer sometimes writes.
assert.equal(resolveBenefits(null, club).maxUpcomingBookings, 2);
assert.equal(resolveBenefits([], club).lookingForGamePostLimit, 1);

// The three that merge differently still do.
assert.equal(resolveBenefits({ extraAdvanceBookingDates: 2 }, club).advanceBookingDates, 6,
  "advance dates add");
assert.equal(resolveBenefits({ priorityEventAdvanceDays: 30 }, club).eventAdvanceDays, 120,
  "event days add");
assert.equal(
  resolveBenefits({ loyaltyRedemptionCapPercent: 10 }, { ...club, loyaltyRedemptionCapPercent: 50 })
    .loyaltyRedemptionCapPercent, 50, "the cap takes the larger");

console.log("booking benefits: all assertions passed");
