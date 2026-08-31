"use client";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { formatPence } from "@/utils/format";
import { priceBooking, type BookingStanding } from "@/utils/booking-pricing";
import { tokens } from "@/lib/tokens";

/**
 * What this table costs you, and what you can pay with.
 *
 * Deliberately the same rows, wording and order as the merchandise bag. A
 * member should not have to learn two ways of reading a discount, and the tier
 * line is the answer to "why is this cheaper than the price on the page".
 */
export default function BookingPricePanel({
  standing, points, onPoints,
}: {
  standing: BookingStanding;
  points: number;
  onPoints: (value: number) => void;
}) {
  const price = priceBooking(standing, points);

  return (
    <Stack spacing={1.25}
      sx={{ p: 1.75, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
            backgroundColor: tokens.surface }}>

      {price.maxPoints > 0 ? (
        <TextField
          size="small" type="number" label="Points to use" fullWidth
          name="redeemPoints"
          value={points || ""}
          onChange={(event) =>
            onPoints(Math.max(0, Math.min(price.maxPoints, Number(event.target.value) || 0)))}
          helperText={`You have ${standing.points}. Up to ${price.maxPoints} on this booking.`}
          slotProps={{ htmlInput: { min: 0, max: price.maxPoints } }}
        />
      ) : (
        <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
          {reasonPointsAreOut(standing, price.free)}
        </Typography>
      )}

      <Stack spacing={0.5}>
        <Row label="Pay as you play" value={formatPence(price.basePrice)} />

        {price.discountPercent > 0 ? (
          <Row
            tone={tokens.positive}
            label={price.discountPercent >= 100
              // A waived fee is not a 100% discount in anybody's head. It is
              // the thing their membership already paid for.
              ? `Included in ${standing.tierLabel ?? "your membership"}`
              : `${standing.tierLabel ?? "Member"} discount · ${price.discountPercent}%`}
            value={`− ${formatPence(price.discountAmount)}`}
          />
        ) : null}

        {price.pointsOff > 0 ? (
          <Row tone={tokens.positive} label={`${points} points`}
            value={`− ${formatPence(price.pointsOff)}`} />
        ) : null}

        <Stack direction="row"
          sx={{ justifyContent: "space-between", alignItems: "baseline",
                pt: 0.75, borderTop: `1px solid ${tokens.rule}` }}>
          <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
            {price.free ? "Nothing to pay" : "You pay"}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", fontWeight: 700 }}>
            {formatPence(price.total)}
          </Typography>
        </Stack>

        {standing.earnPerBooking > 0 ? (
          <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
            This booking earns you {standing.earnPerBooking} loyalty points.
          </Typography>
        ) : null}
      </Stack>

      <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
        The club takes payment on the night. Nothing is charged here.
      </Typography>
    </Stack>
  );
}

/** Why the points field is absent, rather than it just not being there. */
function reasonPointsAreOut(standing: BookingStanding, free: boolean): string {
  if (free) return "Your membership covers this table, so there is nothing to spend points on.";
  if (standing.redemptionCapPercent <= 0 || !standing.pointValue) {
    return "This club does not put loyalty points towards table bookings.";
  }
  if (standing.points <= 0) return "You have no loyalty points at this club yet.";
  return "This table is too cheap to take points off.";
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Stack direction="row" spacing={2}
      sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
      <Typography variant="body2" sx={{ color: tone ?? tokens.inkMuted }}>{label}</Typography>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem", color: tone }}>
        {value}
      </Typography>
    </Stack>
  );
}
