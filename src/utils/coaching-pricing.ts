/**
 * What a coaching session costs this member, and how much of it points can
 * cover.
 *
 * A quote, not the charge. `club_coaching_bookings_price` (0157) recomputes
 * every figure here from the slot, the member's tier and their balance, so a
 * tampered field cannot buy a cheaper session. This mirrors that SQL exactly,
 * which is what stops the quote and the charge disagreeing — the same
 * deliberate duplication `priceTickets` carries, and the same reason it needs
 * a test.
 *
 * Pure. No I/O, no React.
 */

export type CoachingStanding = {
  /** Points the member can spend at this club. */
  points: number;
  /** Pounds per point, or null when the club runs no scheme. */
  pointValue: number | null;
  /** What share of a bill points may cover, from the member's tier. */
  capPercent: number;
  /** What the tier takes off coaching, before points. */
  discountPercent: number;
  currency: string;
};

export type CoachingPrice = {
  basePrice: number;
  tierDiscount: number;
  /** After the tier discount, before points. */
  payable: number;
  pointsOff: number;
  total: number;
  /** The most points this member could put towards this session. */
  maxPoints: number;
  /** False when there is nothing to offer, so the field can say nothing. */
  canRedeem: boolean;
};

const money = (value: number) => Math.round(value * 100) / 100;

/**
 * The slot's price as a number.
 *
 * Mirrors `price_from_text` in SQL: a club types "GBP 10", "£12.50", "Free" or
 * nothing at all, and anything that is not a number is nothing to pay. That is
 * the honest reading of a blank, and it is what stops a slot nobody priced
 * charging an invented figure.
 */
export function slotPrice(raw: string | null | undefined): number {
  const digits = String(raw ?? "").replace(/[^0-9.]/g, "");
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? money(value) : 0;
}

export function priceCoaching(
  standing: CoachingStanding, rawPrice: string | null | undefined, wanted: number,
): CoachingPrice {
  const basePrice = slotPrice(rawPrice);
  const pct = Math.max(0, Math.min(100, standing.discountPercent || 0));
  const tierDiscount = money(basePrice * pct / 100);
  const payable = Math.max(money(basePrice - tierDiscount), 0);

  const cap = Math.max(0, Math.min(100, standing.capPercent || 0));
  const value = standing.pointValue ?? 0;

  // Nothing to offer: a free session, a club with no scheme, a tier that takes
  // nothing off, or a member with no points. The field says nothing rather
  // than sitting there disabled with no reason.
  const canRedeem = payable > 0 && value > 0 && cap > 0 && standing.points > 0;
  if (!canRedeem) {
    return { basePrice, tierDiscount, payable, pointsOff: 0, total: payable,
             maxPoints: 0, canRedeem: false };
  }

  // The ceiling in points, which is what the trigger works out too: the share
  // of the bill the cap allows, divided by what a point is worth, floored.
  const ceiling = Math.floor(money(payable * cap / 100) / value);
  const maxPoints = Math.max(0, Math.min(standing.points, ceiling));

  const used = Math.max(0, Math.min(Math.trunc(wanted || 0), maxPoints));
  const pointsOff = money(used * value);

  return {
    basePrice, tierDiscount, payable,
    pointsOff,
    total: Math.max(money(payable - pointsOff), 0),
    maxPoints,
    canRedeem: maxPoints > 0,
  };
}
