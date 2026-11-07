"use client";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { formatPounds } from "@/utils/format";
import {
  priceBooking, priceShare, splitTable,
  type BookingStanding, type OpponentShare,
} from "@/utils/booking-pricing";
import { tokens } from "@/lib/tokens";
import { pointsCapNote } from "@/utils/points-cap";
import { paymentNote } from "@/utils/payment-note";

/**
 * What this table costs, split between the people who are on it.
 *
 * The client, item gg: "one member may have a membership tier that gives them
 * table costs for free, but the other member may only have a basic membership
 * and not this perk. In that scenario, the member with the tier which gives
 * free games should show as included in their membership, and the other member
 * should show as having to pay 50% of the table cost fee."
 *
 * So the panel answers for both seats and not just the reader's. A member
 * whose own half is covered still needs to know their opponent owes £2.50,
 * because the club is going to ask one of them for it at the door.
 *
 * Deliberately the same rows, wording and order as the merchandise bag. A
 * member should not have to learn two ways of reading a discount, and the tier
 * line is the answer to "why is this cheaper than the price on the page".
 */
export default function BookingPricePanel({
  standing, points, onPoints, opponent = null,
}: {
  standing: BookingStanding;
  points: number;
  onPoints: (value: number) => void;
  /** Whoever is down to play them, which is what halves the fee. */
  opponent?: OpponentShare | null;
}) {
  const sharing = opponent !== null;
  const price = priceBooking(standing, points, sharing);
  const halves = splitTable(standing.basePrice, sharing);
  const theirs = opponent
    ? priceShare(halves.away, opponent.discountPercent)
    : null;

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
          helperText={pointsCapNote(standing.points, price.maxPoints,
            standing.redemptionCapPercent)}
          slotProps={{ htmlInput: { min: 0, max: price.maxPoints } }}
        />
      ) : (
        <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
          {reasonPointsAreOut(standing, price.free)}
        </Typography>
      )}

      <Stack spacing={0.5}>
        {/* The table's own price leads when it is being shared, because
            "£2.50" on its own is not a figure anybody can check against the
            price on the club's page. */}
        {sharing ? (
          <Row label="Pay as you play, the table" value={formatPounds(standing.basePrice)} />
        ) : null}
        <Row label={sharing ? "Your half" : "Pay as you play"}
          value={formatPounds(price.basePrice)} />

        {price.discountPercent > 0 ? (
          <Row
            tone={tokens.positive}
            label={price.discountPercent >= 100
              // A waived fee is not a 100% discount in anybody's head. It is
              // the thing their membership already paid for.
              ? `Included in ${standing.tierLabel ?? "your membership"}`
              : `${standing.tierLabel ?? "Member"} discount · ${price.discountPercent}%`}
            value={`− ${formatPounds(price.discountAmount)}`}
          />
        ) : null}

        {price.pointsOff > 0 ? (
          <Row tone={tokens.positive} label={`${points} points`}
            value={`− ${formatPounds(price.pointsOff)}`} />
        ) : null}

        <Stack direction="row"
          sx={{ justifyContent: "space-between", alignItems: "baseline",
                pt: 0.75, borderTop: `1px solid ${tokens.rule}` }}>
          <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
            {price.free ? "Nothing to pay" : "You pay"}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", fontWeight: 700 }}>
            {formatPounds(price.total)}
          </Typography>
        </Stack>

        {/* The other seat. A club collects both halves at the door, so a
            member whose own is covered still has to know what is owed on the
            table they booked. */}
        {opponent && theirs ? (
          <Stack spacing={0.25}
            sx={{ pt: 0.75, mt: 0.25, borderTop: `1px dashed ${tokens.rule}` }}>
            <Row
              tone={theirs.payable === 0 ? tokens.positive : undefined}
              label={theirs.payable === 0
                ? `${opponent.name} · included in ${opponent.tierLabel ?? "their membership"}`
                : `${opponent.name} pays`}
              value={formatPounds(theirs.payable)}
            />
            {theirs.payable > 0 && theirs.discountPercent > 0 ? (
              <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
                {`${opponent.tierLabel ?? "Their tier"} takes `}
                {formatPounds(theirs.discountAmount)} off their half.
              </Typography>
            ) : null}
            {!opponent.isMember ? (
              <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
                A guest has no membership here, so their half is the full share.
              </Typography>
            ) : null}
          </Stack>
        ) : (
          <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
            Nobody is down to play you yet, so this is the whole table. Name
            somebody and you each pay half, priced off your own memberships.
          </Typography>
        )}

        {standing.earnPerBooking > 0 ? (
          <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
            This booking earns you {standing.earnPerBooking} loyalty points.
          </Typography>
        ) : null}
      </Stack>

      <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
        Nothing is charged here. {paymentNote()}
      </Typography>
    </Stack>
  );
}

/** Why the points field is absent, rather than it just not being there. */
function reasonPointsAreOut(standing: BookingStanding, free: boolean): string {
  if (free) return "Your membership covers your half, so there is nothing to spend points on.";
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
