/**
 * What a cart of tickets costs after the tier and after points.
 *
 * Mirrors checkout_event_cart in 0050, which is the authority: the same cap,
 * the same floor, the same rounding. If the two disagree, the member is quoted
 * one figure and charged another, which is the bug this file exists to avoid.
 */

export type TicketStanding = {
  /** Every line added up, before anything is taken off. */
  subtotal: number;
  currency: string;
  /** The tier's event ticket discount. */
  discountPercent: number;
  tierLabel: string | null;
  /** Points held at this club. Zero for anyone who is not a member of it. */
  points: number;
  /** Pounds per point, or null when the club never set one. */
  pointValue: number | null;
  /** Share of a bill points may cover. Zero means points are not currency here. */
  redemptionCapPercent: number;
};

export type TicketPrice = {
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  /** After the tier, before points. */
  payable: number;
  maxPoints: number;
  pointsOff: number;
  total: number;
  /** Whether the points field is worth showing at all. */
  canRedeem: boolean;
};

const pennies = (n: number) => Math.round(n * 100) / 100;

const clamp = (value: unknown) => {
  const n = Math.floor(Number(value ?? 0));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
};

export function priceTickets(standing: TicketStanding, points = 0): TicketPrice {
  const subtotal = Math.max(0, Number(standing.subtotal) || 0);
  const percent = clamp(standing.discountPercent);
  const discountAmount = pennies(subtotal * percent / 100);
  const payable = pennies(Math.max(subtotal - discountAmount, 0));

  const canRedeem = payable > 0
    && Boolean(standing.pointValue)
    && standing.redemptionCapPercent > 0
    && standing.points > 0;

  const ceiling = pennies(payable * clamp(standing.redemptionCapPercent) / 100);
  const maxPoints = canRedeem
    ? Math.max(0, Math.min(standing.points, Math.floor(ceiling / (standing.pointValue || 1))))
    : 0;

  const used = Math.max(0, Math.min(maxPoints, Math.floor(Number(points) || 0)));
  const pointsOff = pennies(used * (standing.pointValue ?? 0));

  return {
    subtotal,
    discountPercent: percent,
    discountAmount,
    payable,
    maxPoints,
    pointsOff,
    total: pennies(Math.max(payable - pointsOff, 0)),
    // A cap that floors to zero points is not a redemption anybody can make,
    // so the field stays hidden rather than refusing after they have typed.
    canRedeem: canRedeem && maxPoints > 0,
  };
}
