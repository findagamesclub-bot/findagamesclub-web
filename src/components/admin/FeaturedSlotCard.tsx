"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { FeaturedSlot } from "@/services/featured.service";
import { formatPence } from "@/utils/format";
import { shortDate } from "@/utils/dates";
import { clubIdentity } from "@/utils/club-identity";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * One slot a club bought on the homepage.
 *
 * The three words it wears are the three the When picker offers, because a
 * status is one vocabulary: a filter that called a booked slot "upcoming"
 * while the chip beside it said "Booked" would be two names for one fact.
 */
export default function FeaturedSlotCard({
  slot, today, onPay, onRemove,
}: {
  slot: FeaturedSlot;
  today: string;
  /** Absent on a slot given away, which has nothing to settle. */
  onPay: (() => void) | null;
  onRemove: () => void;
}) {
  const { faction, monogram } =
    clubIdentity(slot.clubSlug || slot.clubName, slot.clubName);
  const live = slot.startsOn <= today && slot.endsOn >= today;

  return (
    <Stack spacing={1.5}
      sx={{ height: "100%", p: 2, borderRadius: 1.5,
            border: `1px solid ${tokens.rule}`,
            backgroundColor: tokens.paper,
            // A slot that has finished is still worth finding, and is not
            // worth the same weight as one running now.
            opacity: live ? 1 : 0.72 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Box aria-hidden sx={{
          flexShrink: 0, width: 40, height: 40, borderRadius: 1.25,
          display: "grid", placeItems: "center",
          backgroundColor: faction.base, color: "#FFFFFF",
          fontFamily: mono, fontSize: "0.78rem", fontWeight: 700 }}>
          {monogram}
        </Box>
        <Stack spacing={0.2} sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontFamily: display, fontWeight: 700,
                            fontSize: "1rem", minWidth: 0,
                            overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap" }}>
            {slot.clubName}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                            color: tokens.inkMuted }}>
            {`${shortDate(slot.startsOn)} to ${shortDate(slot.endsOn)}`}
          </Typography>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }} useFlexGap>
        {live ? (
          <Chip size="small" label="Running now"
            sx={{ fontSize: "0.68rem", fontWeight: 700,
                  bgcolor: tokens.positive, color: "#fff" }} />
        ) : slot.startsOn > today ? (
          <Chip size="small" variant="outlined" label="Booked"
            sx={{ fontSize: "0.68rem", fontWeight: 700,
                  color: tokens.inkMuted, borderColor: tokens.rule }} />
        ) : (
          <Chip size="small" variant="outlined" label="Finished"
            sx={{ fontSize: "0.68rem", fontWeight: 700,
                  color: tokens.inkMuted, borderColor: tokens.rule }} />
        )}
        <Chip size="small" variant="outlined"
          label={formatPence(slot.pricePence, slot.currency)}
          sx={{ fontSize: "0.68rem", fontWeight: 700,
                color: tokens.inkMuted, borderColor: tokens.rule }} />
        {/* Only where there is a price. A slot given away has nothing to
            settle, so "not paid" would be a bill. */}
        {slot.pricePence > 0 ? (
          <Chip size="small" variant={slot.paidAt ? "filled" : "outlined"}
            label={slot.paidAt ? "Paid" : "Not paid yet"}
            sx={{ fontSize: "0.68rem", fontWeight: 700,
                  ...(slot.paidAt
                    ? { bgcolor: tokens.positive, color: "#fff" }
                    : { color: tokens.brass, borderColor: tokens.brass }) }} />
        ) : null}
      </Stack>

      {slot.note ? (
        <Typography sx={{ fontSize: "0.86rem", color: tokens.inkMuted }}>
          {slot.note}
        </Typography>
      ) : null}

      {/* Pushed down so Remove sits on the same line on every card in a row,
          however long the note above it ran. */}
      <Box sx={{ flex: 1 }} />
      <Stack direction="row" spacing={1}
        sx={{ pt: 1.25, borderTop: `1px solid ${tokens.rule}`,
              alignItems: "center", justifyContent: "space-between" }}>
        {/* Do-this-first, then the one that ends something, which is the
            button order every card in this console uses. */}
        {onPay ? (
          <Button variant="outlined" size="small" onClick={onPay}
            sx={{ borderColor: tokens.rule, color: tokens.ink }}>
            {slot.paidAt ? "Payment" : "Record payment"}
          </Button>
        ) : <span />}
        <Button variant="text" size="small" onClick={onRemove}
          sx={{ color: tokens.danger }}>
          Remove
        </Button>
      </Stack>
    </Stack>
  );
}
