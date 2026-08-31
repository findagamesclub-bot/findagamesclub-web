import { amountOf } from "./cart-pricing";
import { formatMoney } from "./format";
import type { MembershipTier } from "@/types/clubDetail";

/**
 * What an item costs the person looking at it.
 *
 * The catalogue used to show one price and only reveal the member price in the
 * order dialog, so a member browsing the shop was quoted the price somebody
 * else pays. Rounded to pennies the same way place_merchandise_order rounds it,
 * or the card and the bill disagree.
 */
export function memberAmount(price: string | null, percent: number): number {
  const gross = amountOf(price);
  const off = Math.round(gross * clampPercent(percent)) / 100;
  return Math.max(gross - off, 0);
}

export function clampPercent(value: unknown): number {
  const n = Math.floor(Number(value ?? 0));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

/**
 * The best kit discount somebody could reach by upgrading, or null when their
 * tier is already the best on offer.
 *
 * Shown as "£22.50 with Premium" rather than hidden. A member cannot decide to
 * upgrade for a saving nobody ever told them about, which is the same reason a
 * locked discussion category is drawn with a padlock instead of vanishing.
 */
export function betterOffer(
  tiers: MembershipTier[],
  viewerTierKey: string | null,
  viewerPercent: number,
): { percent: number; tierLabel: string } | null {
  const mine = clampPercent(viewerPercent);
  let best: { percent: number; tierLabel: string } | null = null;

  tiers.forEach((tier) => {
    if (tier.key === viewerTierKey) return;
    const percent = clampPercent(
      (tier.benefitValues as Record<string, unknown>).merchandiseDiscountPercent,
    );
    if (percent <= mine) return;
    if (!best || percent > best.percent) best = { percent, tierLabel: tier.label };
  });

  return best;
}

/** The two lines a card shows under the name. */
export function priceLines(params: {
  price: string | null;
  discountPercent: number;
  tierLabel: string | null;
  offer: { percent: number; tierLabel: string } | null;
}): { was: string | null; now: string; note: string | null } {
  const gross = amountOf(params.price);

  // "Pay what you can", "TBC" and a blank all parse to zero. Discounting
  // nothing produces "£0 member price", which is worse than saying nothing.
  if (!gross) return { was: null, now: params.price || "Price TBC", note: null };

  const percent = clampPercent(params.discountPercent);
  if (percent > 0) {
    return {
      was: formatMoney(gross),
      now: formatMoney(memberAmount(params.price, percent)),
      note: params.tierLabel ? `${params.tierLabel} price` : "Member price",
    };
  }

  return {
    was: null,
    now: formatMoney(gross),
    note: params.offer
      ? `${formatMoney(memberAmount(params.price, params.offer.percent))} with ${params.offer.tierLabel}`
      : null,
  };
}
