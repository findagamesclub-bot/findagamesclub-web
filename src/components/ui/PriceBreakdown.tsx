import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { hasBreakdown, priceRows, savedLine, type Priced } from "@/utils/price-lines";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * What was charged and what came off it, drawn one way.
 *
 * The client found the same gap in four places at once: "please check all
 * these cases where we show pricing, as it is not consistent when membership
 * or loyalty discounts are applied." Every checkout already showed the lines
 * and every screen afterwards showed a bare total, so a member could see why
 * they were paying £4.05 at the desk and never again.
 *
 * One component, so the desk and the dashboard cannot drift. `compact` is the
 * same facts on one line, for a row in a list where four would not fit; it is
 * a density, not a second treatment.
 */
export default function PriceBreakdown({
  priced, labels, compact = false, dense = false,
}: {
  priced: Priced;
  /** A table booking is not a subtotal: the desk says "Pay as you play". */
  labels?: { subtotal?: string; total?: string };
  compact?: boolean;
  /** Tighter rows, for inside a card footer rather than a checkout panel. */
  dense?: boolean;
}) {
  if (compact) {
    const line = savedLine(priced);
    if (!line) return null;
    return (
      <Typography sx={{ fontSize: "0.75rem", fontFamily: display, lineHeight: 1.6,
                        color: tokens.positive }}>
        {line}
      </Typography>
    );
  }

  const rows = priceRows(priced, labels);

  return (
    <Stack spacing={dense ? 0.25 : 0.5}>
      {rows.map((row) => {
        const total = row.key === "total";
        return (
          <Stack key={row.key} direction="row" spacing={2}
            sx={{
              justifyContent: "space-between",
              alignItems: "baseline",
              ...(total && rows.length > 2
                ? { pt: 0.75, borderTop: `1px solid ${tokens.rule}` }
                : {}),
            }}>
            <Typography
              variant="body2"
              sx={{
                color: row.saving ? tokens.positive : tokens.inkMuted,
                ...(total ? { fontFamily: display, fontWeight: 700, color: tokens.ink } : {}),
              }}>
              {row.label}
            </Typography>
            {/* Mono so the figures line up down the column, which is the
                whole reason a breakdown is easier to read than a sentence. */}
            <Typography sx={{
              fontFamily: mono,
              fontSize: total ? (dense ? "0.95rem" : "1.05rem") : "0.84rem",
              fontWeight: total ? 700 : 400,
              color: row.saving ? tokens.positive : undefined,
              flexShrink: 0,
            }}>
              {row.value}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

/** Whether drawing one would say anything. A full price explains itself. */
export { hasBreakdown };
