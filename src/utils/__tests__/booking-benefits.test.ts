/**
 * Booking limits and tier merging.
 *
 * Run with: npx tsx src/utils/__tests__/booking-benefits.test.ts
 * Values checked against the three real clubs in the database.
 */

import { resolveMembershipSettings, DEFAULT_SETTINGS } from "../booking-settings";
import { resolveBenefits, benefitsFromRow, upcomingBookingLimitReached } from "../booking-benefits";

let failed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` +
    (ok ? "" : `\n        got ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`));
}

// --- the asymmetry: five fields coerce 0 to a default, one does not ---
const zeroed = resolveMembershipSettings({
  advanceBookingDates: 0, upcomingBookingLimit: 0, eventAdvanceDays: 0,
  lookingForGameFutureDates: 0, lookingForGamePostLimit: 0, loyaltyRedemptionCapPercent: 0,
});
check("0 advanceBookingDates falls back to 4", zeroed.advanceBookingDates, 4);
check("0 eventAdvanceDays falls back to 365", zeroed.eventAdvanceDays, 365);
check("0 lookingForGameFutureDates falls back to 2", zeroed.lookingForGameFutureDates, 2);
check("0 lookingForGamePostLimit falls back to 1", zeroed.lookingForGamePostLimit, 1);
check("0 loyalty cap falls back to 100", zeroed.loyaltyRedemptionCapPercent, 100);
check("0 upcomingBookingLimit STAYS 0 (unlimited)", zeroed.upcomingBookingLimit, 0);

check("a missing row is all defaults", resolveMembershipSettings(null), DEFAULT_SETTINGS);

// --- the three real clubs ---
const didcot = resolveBenefits({}, { advanceBookingDates: 4, upcomingBookingLimit: 2,
  eventAdvanceDays: 90, lookingForGameFutureDates: 2, lookingForGamePostLimit: 1,
  loyaltyRedemptionCapPercent: 100 });
check("Didcot allows 2 upcoming bookings", didcot.maxUpcomingBookings, 2);

const ironDice = resolveBenefits({}, { advanceBookingDates: 4, upcomingBookingLimit: 0,
  eventAdvanceDays: 365, lookingForGameFutureDates: 2, lookingForGamePostLimit: 1,
  loyaltyRedemptionCapPercent: 100 });
check("Iron Dice is uncapped", ironDice.maxUpcomingBookings, 0);
check("uncapped never blocks, even at 99 held", upcomingBookingLimitReached(ironDice, 99), null);
check("Didcot blocks at 2 held",
  upcomingBookingLimitReached(didcot, 2),
  "Your current membership tier allows 2 upcoming bookings at once.");
check("Didcot allows the 2nd booking", upcomingBookingLimitReached(didcot, 1), null);

// --- the three merge rules, each different ---
const premium = resolveBenefits(
  { extraAdvanceBookingDates: 3, priorityEventAdvanceDays: 30,
    loyaltyRedemptionCapPercent: 60, bookingDiscountPercent: 10 },
  { advanceBookingDates: 4, eventAdvanceDays: 90, loyaltyRedemptionCapPercent: 50 });
check("advance dates ADD  (4 + 3)", premium.advanceBookingDates, 7);
check("event days ADD     (90 + 30)", premium.eventAdvanceDays, 120);
check("loyalty cap is MAX (50 vs 60)", premium.loyaltyRedemptionCapPercent, 60);

const weakTier = resolveBenefits({ loyaltyRedemptionCapPercent: 20 },
  { loyaltyRedemptionCapPercent: 50 });
check("a tier cannot lower the club's cap", weakTier.loyaltyRedemptionCapPercent, 50);
check("cap never exceeds 100",
  resolveBenefits({ loyaltyRedemptionCapPercent: 900 }, { loyaltyRedemptionCapPercent: 100 })
    .loyaltyRedemptionCapPercent, 100);

// --- benefits arriving as the wrong shape must not throw ---
check("array benefits read as none", resolveBenefits([], null).bookingDiscountPercent, 0);
check("null benefits read as none", resolveBenefits(null, null).bookingDiscountPercent, 0);
check("garbage numbers clamp to 0", resolveBenefits({ bookingDiscountPercent: -5 }, null)
  .bookingDiscountPercent, 0);

// --- database rows go through two resolve passes; prove that changes nothing ---
// The real Iron Dice row: 0 means uncapped and must survive both passes.
const ironRow = benefitsFromRow(null, {
  basic_label: "Basic Member", advance_booking_dates: 4, upcoming_booking_limit: 0,
  event_advance_days: 365, looking_for_game_future_dates: 2,
  looking_for_game_post_limit: 1, loyalty_redemption_cap_percent: 100 });
check("row: Iron Dice stays uncapped through both passes", ironRow.maxUpcomingBookings, 0);
check("row: Didcot's 2 survives",
  benefitsFromRow(null, { advance_booking_dates: 4, upcoming_booking_limit: 2,
    event_advance_days: 90, looking_for_game_future_dates: 2,
    looking_for_game_post_limit: 1, loyalty_redemption_cap_percent: 100 }).maxUpcomingBookings, 2);
check("row: a zeroed row still gets the defaults",
  benefitsFromRow(null, { advance_booking_dates: 0, event_advance_days: 0 }).advanceBookingDates, 4);
check("row: a missing row equals no row",
  benefitsFromRow(null, null), resolveBenefits(null, null));
check("row: tier extras still add on top of a row",
  benefitsFromRow({ extraAdvanceBookingDates: 3 }, { advance_booking_dates: 4 }).advanceBookingDates, 7);

console.log(failed ? `\n${failed} FAILING` : "\nall passing");
process.exit(failed ? 1 : 0);
