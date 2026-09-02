import { describeTierBenefits, groupTierBenefits } from "./tier-benefits";
import { billingOptions } from "./membership-billing";
import { formatPrice } from "./format";
import { amountOf } from "./cart-pricing";
import { reservedCategories } from "./discussion-categories";
import type { MembershipTier } from "@/types/clubDetail";

/** The tier row as both the club page and the event page select it. */
export type TierRow = {
  tier_key: string;
  label: string;
  price: string | null;
  price_duration: string;
  description: string | null;
  is_basic: boolean;
  position: number;
  benefits: unknown;
  billing_options: unknown;
};

/**
 * Taken off event tickets for members on this tier.
 *
 * describeTierBenefits turns the object into sentences, which loses the number,
 * so the ticket code reads it from here instead of parsing prose back.
 */
/**
 * A tier with nothing to pay.
 *
 * Blank, "TBC" and "Free" all mean no price, and so does a price that works
 * out at zero. Everything else is a paid tier however it is labelled.
 */
export function isFreeTier(price: string | null | undefined): boolean {
  const shown = formatPrice(price);
  if (!shown) return true;
  if (/free/i.test(shown)) return true;
  return amountOf(shown) === 0;
}

export function eventDiscountPercent(benefits: unknown): number {
  if (!benefits || typeof benefits !== "object" || Array.isArray(benefits)) return 0;
  const raw = Number((benefits as Record<string, unknown>).eventDiscountPercent ?? 0);
  return Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.floor(raw))) : 0;
}

/**
 * Position is the ladder — a tier further down the club's list is higher — so
 * the order this returns is load-bearing, not cosmetic. ticketBlockedReason
 * compares indexes in it.
 */
export function toMembershipTiers(rows: TierRow[]): MembershipTier[] {
  return [...rows]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((t) => ({
      key: t.tier_key,
      label: t.label,
      price: formatPrice(t.price),
      priceDuration: t.price_duration,
      description: t.description,
      isBasic: t.is_basic,
      isFree: isFreeTier(t.price),
      // The importer stores the legacy object of typed keys, not a list of
      // sentences. Array.isArray was always false here, so every tier card
      // rendered with no benefits at all.
      benefits: describeTierBenefits(t.benefits),
      benefitGroups: groupTierBenefits(t.benefits),
      benefitValues:
        t.benefits && typeof t.benefits === "object" && !Array.isArray(t.benefits)
          ? (t.benefits as Record<string, unknown>)
          : {},
      billingOptions: billingOptions(t.billing_options, t.price ?? "", t.price_duration),
      eventDiscountPercent: eventDiscountPercent(t.benefits),
      reservedCategories: reservedCategories(t.benefits),
    }));
}
