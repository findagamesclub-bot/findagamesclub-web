import "server-only";

import * as extras from "@/repositories/clubExtras.repository";
import * as loyaltyRepo from "@/repositories/loyalty.repository";
import * as repo from "@/repositories/bookings.repository";
import { tierBookingDiscount } from "@/utils/booking-pricing";
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

/**
 * One member of the roster, with what their own tier takes off their half.
 *
 * 0221 splits a table between the people on it and prices each half off that
 * person's tier, so the booking screen cannot say what the other seat owes
 * without this. One read of the club's tiers rather than one call per member:
 * `booking_discount_percent` is a round trip and a roster is forty of them.
 */
export type RosterShare = {
  id: string;
  name: string;
  discountPercent: number;
  tierLabel: string | null;
};

export async function withBookingShares(
  clubId: number,
  members: { profileId: string; fullName: string; tierKey: string | null }[],
): Promise<RosterShare[]> {
  if (!members.length) return [];

  // A club whose tiers will not load still gets a bookable screen: everybody
  // reads as paying their half in full, which is what the database charges
  // anybody without a tier anyway.
  const tiers = await repo.findTierBookingBenefits(clubId).catch(() => []);
  const byKey = new Map(tiers.map((tier) => [tier.tier_key, tier]));

  return members.map((member) => {
    const tier = member.tierKey ? byKey.get(member.tierKey) : undefined;
    return {
      id: member.profileId,
      name: member.fullName,
      discountPercent: tierBookingDiscount(tier?.benefits),
      tierLabel: tier?.label ?? null,
    };
  });
}
