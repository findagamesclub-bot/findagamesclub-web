/**
 * What a table costs the person booking it.
 *
 * Mirrors club_bookings_price() in 0043, which is the authority. The page has
 * been quoting the club's headline price to everybody while the trigger charged
 * the member's own: a Didcot Premium member saw "£5 a table" and was booked at
 * £4.50. Both sides round to pennies the same way so the quote and the booking
 * cannot disagree.
 */

export type BookingStanding = {
  /** The club's pay as you play price. */
  basePrice: number;
  currency: string;
  /** Taken off by the viewer's tier. 100 when the tier waives the fee. */
  discountPercent: number;
  tierLabel: string | null;
  /** Points held at this club. */
  points: number;
  /** Pounds per point, or null when the club never set one. */
  pointValue: number | null;
  /** Share of a bill points may cover. Zero means points are not currency here. */
  redemptionCapPercent: number;
  /** Points a booking earns at this club. */
  earnPerBooking: number;
};

export type BookingPrice = {
  basePrice: number;
  discountPercent: number;
  discountAmount: number;
  /** After the tier, before points. */
  payable: number;
  maxPoints: number;
  pointsOff: number;
  total: number;
  /** The tier covers the whole fee, so there is nothing to pay or to redeem. */
  free: boolean;
};

const pennies = (n: number) => Math.round(n * 100) / 100;

const clamp = (value: unknown) => {
  const n = Math.floor(Number(value ?? 0));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
};

export function priceBooking(standing: BookingStanding, points = 0): BookingPrice {
  const base = Math.max(0, Number(standing.basePrice) || 0);
  const percent = clamp(standing.discountPercent);
  const discountAmount = pennies(base * percent / 100);
  const payable = pennies(Math.max(base - discountAmount, 0));

  const canRedeem = payable > 0
    && Boolean(standing.pointValue)
    && standing.redemptionCapPercent > 0
    && standing.points > 0;

  const ceiling = pennies(payable * clamp(standing.redemptionCapPercent) / 100);
  const maxPoints = canRedeem
    ? Math.max(0, Math.min(standing.points, Math.floor(ceiling / (standing.pointValue || 1))))
    : 0;

  const used = Math.max(0, Math.min(maxPoints, Math.floor(points)));
  const pointsOff = pennies(used * (standing.pointValue ?? 0));

  return {
    basePrice: base,
    discountPercent: percent,
    discountAmount,
    payable,
    maxPoints,
    pointsOff,
    total: pennies(Math.max(payable - pointsOff, 0)),
    free: payable === 0,
  };
}

/**
 * The price as one item in the club's facts strip.
 *
 * No full stops: it sits between "19:00 - 22:30" and "1 table" in a list
 * separated by middots, and sentence punctuation inside one item made the whole
 * strip read as broken. Three forms, because three different things are true:
 * the membership covers it, the tier discounts it, or there is no membership.
 */
export function priceSummary(standing: BookingStanding, price: BookingPrice): string {
  const money = (n: number) => `£${n.toFixed(2)}`;

  if (price.free) {
    return standing.tierLabel
      ? `free with ${standing.tierLabel}, usually ${money(price.basePrice)}`
      : "free";
  }
  if (price.discountPercent > 0) {
    return `${money(price.total)} a table, usually ${money(price.basePrice)}`;
  }
  return `${money(price.total)} a table`;
}
