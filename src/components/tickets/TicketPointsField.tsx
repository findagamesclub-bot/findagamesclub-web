"use client";

import PointsField from "@/components/ui/PointsField";
import type { TicketPrice, TicketStanding } from "@/utils/ticket-pricing";

/**
 * Points towards event tickets.
 *
 * The control itself is `PointsField`, shared with the table booking desk and
 * with coaching, because it is the same decision in all three places. This
 * file stays as the one that knows what a ticket order's figures are called.
 *
 * The figures are a quote. checkout_event_cart recomputes every one of them
 * from the club's settings and the member's balance, so a tampered field
 * cannot buy a cheaper ticket. `priceTickets` mirrors that SQL exactly, which
 * is what stops the quote and the charge disagreeing.
 */
export default function TicketPointsField({
  standing, price, points, onPoints,
}: {
  standing: TicketStanding;
  /** Priced by the parent, so every figure on the page comes from one call. */
  price: TicketPrice;
  points: number;
  onPoints: (value: number) => void;
}) {
  // Nothing to offer: not a member here, no points, or the club does not take
  // them off tickets. Saying nothing beats a disabled field with no reason.
  if (!price.canRedeem) return null;

  return (
    <PointsField
      name="redeemPoints"
      held={standing.points}
      max={price.maxPoints}
      capPercent={standing.redemptionCapPercent}
      value={points}
      pointsOff={price.pointsOff}
      currency={standing.currency}
      onChange={onPoints}
    />
  );
}
