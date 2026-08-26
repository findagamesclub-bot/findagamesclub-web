import { describeTierBenefits } from "./tier-benefits";
import { billingOptions } from "./membership-billing";
import { formatPrice } from "./format";
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
      // The importer stores the legacy object of typed keys, not a list of
      // sentences. Array.isArray was always false here, so every tier card
      // rendered with no benefits at all.
      benefits: describeTierBenefits(t.benefits),
      billingOptions: billingOptions(t.billing_options, t.price ?? "", t.price_duration),
      eventDiscountPercent: eventDiscountPercent(t.benefits),
      reservedCategories: reservedCategories(t.benefits),
    }));
}
