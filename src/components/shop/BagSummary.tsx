"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { formatPence } from "@/utils/format";
import type { BagTotal } from "@/utils/merch-bag";
import { tokens, type Faction } from "@/lib/tokens";
import type { ShopStanding } from "@/types/clubExtras";

/** Everything that comes off the price, and the button that commits to it. */
export default function BagSummary({
  bag, standing, faction, busy, points, onPoints, notes, onNotes, onCheckout,
}: {
  bag: BagTotal;
  standing: ShopStanding;
  faction: Faction;
  busy: boolean;
  points: number;
  onPoints: (value: number) => void;
  notes: string;
  onNotes: (value: string) => void;
  onCheckout: () => void;
}) {
  const problems = bag.lines.filter((line) => line.problem);
  const canOrder = bag.lines.length > 0 && problems.length === 0 && !busy;

  // Nothing in the bag has a price on it, so there is no total to show. A bold
  // "Total £0" above "this has no price yet" is the contradiction the whole
  // change was meant to remove.
  const allQuoted = bag.lines.length > 0 && bag.quotedCount === bag.lines.length;

  return (
    <Stack spacing={1.75}
      sx={{ p: 2, borderTop: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>

      <PointsField standing={standing} bag={bag} points={points} onPoints={onPoints} />

      <TextField size="small" label="Anything the club should know?" multiline minRows={2}
        value={notes} onChange={(event) => onNotes(event.target.value)}
        helperText="Sizes, colours, when you need it by." />

      <Stack spacing={0.5}>
        {!allQuoted ? <Row label="Subtotal" value={formatPence(bag.subtotal)} /> : null}
        {!allQuoted && bag.tierDiscount > 0 ? (
          <Row tone={tokens.positive}
            label={`${standing.tierLabel ?? "Member"} discount · ${standing.discountPercent}%`}
            value={`− ${formatPence(bag.tierDiscount)}`} />
        ) : null}
        {!allQuoted && bag.pointsOff > 0 ? (
          <Row tone={tokens.positive} label={`${points} points`}
            value={`− ${formatPence(bag.pointsOff)}`} />
        ) : null}

        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline",
                                     pt: 0.75, borderTop: `1px solid ${tokens.rule}` }}>
          <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>Total</Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                            fontSize: allQuoted ? "0.95rem" : "1.2rem",
                            color: allQuoted ? tokens.inkMuted : undefined }}>
            {allQuoted ? "To be confirmed" : formatPence(bag.total)}
          </Typography>
        </Stack>

        {bag.quotedCount > 0 ? (
          <Typography variant="caption" sx={{ color: tokens.brass, fontWeight: 600 }}>
            {allQuoted
              ? bag.quotedCount === 1
                ? "The club has not put a price on this yet. They will confirm it before you pay."
                : "The club has not put prices on these yet. They will confirm before you pay."
              : bag.quotedCount === 1
                ? "One item has no price yet, so it is not in this total. The club will quote it."
                : `${bag.quotedCount} items have no price yet, so they are not in this total. The club will quote them.`}
          </Typography>
        ) : null}

        {standing.earnPerOrder > 0 ? (
          <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
            This order earns you {standing.earnPerOrder} loyalty points.
          </Typography>
        ) : null}
      </Stack>

      {problems.length ? (
        <Alert severity="warning" sx={{ py: 0.25 }}>
          Sort the lines above out before ordering.
        </Alert>
      ) : null}

      <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
        This puts a request in with the club. They confirm the price and arrange
        payment with you directly.
      </Typography>

      <Button variant="contained" size="large" fullWidth loading={busy}
        loadingPosition="start" disabled={!canOrder} onClick={onCheckout}
        sx={{ backgroundColor: faction.base, "&:hover": { backgroundColor: faction.deep } }}>
        Place the order
      </Button>
    </Stack>
  );
}

/**
 * Points, or why not.
 *
 * Hiding the field when a club sets its redemption cap to zero is what made the
 * client report the whole feature as missing: Didcot's cap is 0, so nobody
 * there had ever seen it. Saying so is cheap and answers the question.
 */
function PointsField({
  standing, bag, points, onPoints,
}: {
  standing: ShopStanding;
  bag: BagTotal;
  points: number;
  onPoints: (value: number) => void;
}) {
  if (bag.maxPoints > 0) {
    return (
      <TextField
        size="small" type="number" label="Points to use" fullWidth
        value={points || ""}
        onChange={(event) =>
          onPoints(Math.max(0, Math.min(bag.maxPoints, Number(event.target.value) || 0)))}
        helperText={`You have ${standing.points}. Up to ${bag.maxPoints} on this order.`}
        slotProps={{ htmlInput: { min: 0, max: bag.maxPoints } }}
      />
    );
  }

  const why = standing.redemptionCapPercent <= 0 || !standing.pointValue
    ? "This club does not put loyalty points towards merchandise."
    : standing.points <= 0
      ? "You have no loyalty points at this club yet."
      : "This order is too small to take points off.";

  return <Typography variant="caption" sx={{ color: tokens.inkMuted }}>{why}</Typography>;
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
