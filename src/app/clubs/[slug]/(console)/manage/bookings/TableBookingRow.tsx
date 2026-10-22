"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import StatusChip from "@/components/ui/StatusChip";
import PriceBreakdown from "@/components/ui/PriceBreakdown";
import { formatMoney } from "@/utils/format";
import { nightLabel } from "@/utils/dates";
import { tableNumber } from "@/utils/table-number";
import {
  tableBookingTag, tableIsFree, tableIsLive, type TableBookingRow as Row,
} from "@/utils/table-bookings";
import { display, mono, tokens, type Faction } from "@/lib/tokens";

/**
 * One table, and what was paid for it.
 *
 * A row rather than a card, because this is a money list a club works down
 * rather than a set of things to compare. The whole sum is under it through
 * `PriceBreakdown`, which is the one reading of a price everywhere else in
 * this app already uses, so a club asking "why is it £4.50" gets the same
 * answer the member got at the desk.
 */
export default function TableBookingRow({
  row, faction, busy, onPayment,
}: {
  row: Row;
  faction: Faction;
  busy: boolean;
  onPayment: () => void;
}) {
  const tag = tableBookingTag(row);
  const live = tableIsLive(row);
  const free = tableIsFree(row);

  return (
    <Stack
      sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 1.5, backgroundColor: tokens.paper,
            border: `1px solid ${tokens.rule}`, opacity: live ? 1 : 0.72 }}>
      <Box sx={{ display: "grid", gap: { xs: 1, md: 2 }, alignItems: "center",
                 gridTemplateColumns: { xs: "1fr auto", md: "minmax(0, 2fr) minmax(0, 2fr) auto" } }}>
        <Stack spacing={0.2} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: display, fontWeight: 700, fontSize: "1rem" }}
            noWrap>
            {row.bookedName}
            {row.opponentName ? (
              <Box component="span" sx={{ color: tokens.inkMuted, fontWeight: 400 }}>
                {` v ${row.opponentName}`}
              </Box>
            ) : null}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                            letterSpacing: "0.06em", color: tokens.inkMuted }}>
            {[nightLabel(row.sessionDate), `TABLE ${tableNumber(row.tableIndex)}`,
              row.gameTitle].filter(Boolean).join(" · ").toUpperCase()}
          </Typography>
        </Stack>

        <Stack spacing={0.2} sx={{ minWidth: 0, gridColumn: { xs: "1 / -1", md: "auto" } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}
            useFlexGap>
            {/* The chip says "Nothing to pay" on a free table, so this does
                not say it again. What it shows instead is the price the tier
                took off, struck through, which is the figure a club wants when
                it is looking at what a membership is worth. A club charging
                nothing at all has neither, and says neither. */}
            {!free || row.priced.subtotal > 0 ? (
              <Typography variant="body2"
                sx={{ color: !live || free ? tokens.inkMuted
                        : row.paymentStatus !== "unpaid" ? tokens.positive : tokens.ink,
                      textDecoration: live && !free ? "none" : "line-through" }}>
                {formatMoney(free ? row.priced.subtotal : row.total,
                             row.priced.currency ?? "GBP")}
                {row.paymentMethod ? ` (${row.paymentMethod})` : ""}
              </Typography>
            ) : null}
            {tag ? <StatusChip label={tag.label} tone={tag.tone} /> : null}
          </Stack>

          {/* What the club wrote beside the money, which the member reads too. */}
          {row.paymentNote ? (
            <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
              {row.paymentNote}
            </Typography>
          ) : null}
        </Stack>

        <Box sx={{ justifySelf: "end" }}>
          {/* A cancelled table has nothing to settle, and a free one has
              nothing to take. Offering a button on either is offering to do
              something that cannot happen. */}
          {live && !free ? (
            <Button size="small" variant={row.paymentStatus === "unpaid" ? "outlined" : "text"}
              loading={busy} loadingPosition="start" onClick={onPayment}
              aria-label={busy
                ? `Saving the payment for ${row.bookedName}`
                : `Record the payment for ${row.bookedName} on ${nightLabel(row.sessionDate)}`}
              sx={{ whiteSpace: "nowrap",
                    ...(row.paymentStatus === "unpaid"
                      ? { borderColor: tokens.rule, color: tokens.ink,
                          "&:hover": { borderColor: faction.base, color: faction.deep } }
                      : { color: tokens.inkMuted }) }}>
              {row.paymentStatus === "unpaid" ? "Mark paid" : "Payment"}
            </Button>
          ) : null}
        </Box>
      </Box>

      {/* Why it is that figure and not the club's headline price. Drawn only
          where something came off, so a full price explains itself. */}
      {live && !free ? (
        <Box sx={{ pt: 1 }}>
          <PriceBreakdown priced={row.priced} compact />
        </Box>
      ) : null}
    </Stack>
  );
}
