import "server-only";

import * as extras from "@/repositories/clubExtras.repository";
import * as loyaltyRepo from "@/repositories/loyalty.repository";
import * as repo from "@/repositories/bookings.repository";
import type { BookingStanding } from "@/utils/booking-pricing";

/**
 * What a booking actually earns, which is not the club's base milestone.
 *
 * Mirrors award_loyalty since 0042: (base + the tier's bonus) x its multiplier,
 * with the multiplier floored at 1. Showing the bare base would tell a Premium
 * member at Didcot they earn 5 when the ledger gives them 20.
 */
function earnedPoints(base: number, benefits: Record<string, unknown> | undefined): number {
  const safeBase = Math.max(0, Math.floor(Number(base) || 0));
  if (safeBase <= 0 || !benefits) return safeBase;

  const bonus = Math.max(0, Math.floor(Number(benefits.bonusGameBookingPoints ?? 0)) || 0);
  const multiplier = Math.max(1, Number(benefits.loyaltyEarnMultiplier ?? 1) || 1);
  return Math.max(0, Math.round((safeBase + bonus) * multiplier));
}

/**
 * What a table costs this member, and what they may pay with.
 *
 * Presentation only. club_bookings_price() recomputes every figure at insert
 * time from the club's own settings, so nothing here can change what is
 * charged. It exists because the page was quoting the club's headline price to
 * everybody while the trigger charged the member's own.
 */
export async function getBookingStanding(
  clubId: number,
  profileId: string,
): Promise<BookingStanding> {
  const [settings, discountPercent, tier, loyalty, points] = await Promise.all([
    repo.findBookingSettings(clubId),
    repo.findBookingDiscountPercent(clubId, profileId),
    extras.findMemberTier(clubId, profileId),
    loyaltyRepo.findSettings(clubId),
    extras.findPointBalance(clubId, profileId),
  ]);

  return {
    basePrice: Number(settings?.table_booking_price ?? 0),
    currency: settings?.price_currency ?? "GBP",
    discountPercent,
    tierLabel: tier?.tier_label ?? null,
    points,
    pointValue: loyalty?.enabled && loyalty.point_value !== null
      ? Number(loyalty.point_value) : null,
    redemptionCapPercent: Math.max(0, Math.min(100, Math.floor(Number(
      (tier?.benefits as Record<string, unknown> | undefined)?.loyaltyRedemptionCapPercent ?? 0,
    )) || 0)),
    earnPerBooking: earnedPoints(
      loyalty?.enabled
        ? Number((loyalty.milestones as Record<string, unknown> | null)?.gameBooking ?? 0)
        : 0,
      tier?.benefits as Record<string, unknown> | undefined,
    ),
  };
}
