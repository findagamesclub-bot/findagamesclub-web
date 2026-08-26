import { resolveMembershipSettings, settingsFromRow, type MembershipSettingsRow } from "./booking-settings";
import type { MembershipBenefits, MembershipSettings } from "@/types/booking";

/**
 * Fold a member's tier into their club's settings.
 *
 * Ported from _membership_benefits_for_membership (club_store.py:14361-14392).
 * Three fields merge, and each merges DIFFERENTLY — this is the part a later
 * tidy-up will flatten and get wrong:
 *
 *   advanceBookingDates  = club setting  PLUS tier.extraAdvanceBookingDates
 *   eventAdvanceDays     = club setting  PLUS tier.priorityEventAdvanceDays
 *   loyaltyRedemptionCap = MAX(club setting, tier's own cap)
 *
 * The rest are taken from the club settings alone; a tier cannot narrow them.
 */
function num(benefits: Record<string, unknown>, key: string): number {
  const n = Number(benefits[key]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function resolveBenefits(
  tierBenefits: unknown,
  settingsRow: Partial<Record<keyof MembershipSettings, unknown>> | null | undefined,
): MembershipBenefits {
  const settings = resolveMembershipSettings(settingsRow);

  // The importer stores the legacy object of typed keys. An array default
  // (0008 sets '[]') reads as no benefits at all rather than throwing.
  const b: Record<string, unknown> =
    tierBenefits && typeof tierBenefits === "object" && !Array.isArray(tierBenefits)
      ? (tierBenefits as Record<string, unknown>)
      : {};

  return {
    advanceBookingDates: settings.advanceBookingDates + num(b, "extraAdvanceBookingDates"),
    eventAdvanceDays: settings.eventAdvanceDays + num(b, "priorityEventAdvanceDays"),
    loyaltyRedemptionCapPercent: Math.min(
      100,
      Math.max(settings.loyaltyRedemptionCapPercent, num(b, "loyaltyRedemptionCapPercent")),
    ),

    // Straight from the club. A paid tier does not get fewer of these.
    maxUpcomingBookings: settings.upcomingBookingLimit,
    lookingForGameFutureDates: settings.lookingForGameFutureDates,
    lookingForGamePostLimit: settings.lookingForGamePostLimit,

    bookingDiscountPercent: Math.min(100, num(b, "bookingDiscountPercent")),
    waiveGameBookingFee: b.waiveGameBookingFee === true,
  };
}

/** Legacy's own wording, so the UI copy matches the rule. */
export function upcomingBookingLimitReached(benefits: MembershipBenefits, held: number) {
  // 0 is unlimited (club_store.py:3259), not "none allowed".
  if (benefits.maxUpcomingBookings <= 0) return null;
  if (held < benefits.maxUpcomingBookings) return null;
  return `Your current membership tier allows ${benefits.maxUpcomingBookings} upcoming bookings at once.`;
}

/** resolveBenefits, taking the database row shape directly. */
export function benefitsFromRow(
  tierBenefits: unknown,
  row: MembershipSettingsRow | null | undefined,
): MembershipBenefits {
  const settings = settingsFromRow(row);
  return resolveBenefits(tierBenefits, {
    basicLabel: settings.basicLabel,
    advanceBookingDates: settings.advanceBookingDates,
    // Already resolved, so pass through unchanged — resolveMembershipSettings
    // is idempotent for every field except this one, where 0 is meaningful and
    // a second pass would leave it alone anyway.
    upcomingBookingLimit: settings.upcomingBookingLimit,
    eventAdvanceDays: settings.eventAdvanceDays,
    lookingForGameFutureDates: settings.lookingForGameFutureDates,
    lookingForGamePostLimit: settings.lookingForGamePostLimit,
    loyaltyRedemptionCapPercent: settings.loyaltyRedemptionCapPercent,
  });
}
