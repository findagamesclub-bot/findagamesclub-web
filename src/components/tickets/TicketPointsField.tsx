"use client";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { TicketPrice, TicketStanding } from "@/utils/ticket-pricing";
import { formatMoney } from "@/utils/format";
import { tokens } from "@/lib/tokens";

/**
 * Points towards event tickets.
 *
 * The same control and the same wording as the table booking desk, because it
 * is the same decision: how much of this do you want to pay with points.
 *
 * The figures here are a quote. checkout_event_cart recomputes every one of
 * them from the club's settings and the member's balance, so a tampered field
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

  const money = (n: number) => formatMoney(n, standing.currency);

  return (
    <Stack spacing={1.25}
      sx={{ p: 1.75, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
            backgroundColor: tokens.surface }}>
      <TextField
        size="small" type="number" label="Points to use" fullWidth
        name="redeemPoints"
        value={points || ""}
        onChange={(event) =>
          onPoints(Math.max(0, Math.min(price.maxPoints, Number(event.target.value) || 0)))}
        helperText={`You have ${standing.points}. Up to ${price.maxPoints} on this order.`}
        slotProps={{ htmlInput: { min: 0, max: price.maxPoints } }}
      />

      {price.pointsOff > 0 ? (
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <Typography variant="body2" sx={{ color: tokens.positive }}>
            {`${points} ${points === 1 ? "point" : "points"} off`}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem",
                            color: tokens.positive, fontWeight: 700 }}>
            {`− ${money(price.pointsOff)}`}
          </Typography>
        </Stack>
      ) : null}
    </Stack>
  );
}
