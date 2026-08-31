import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ClubLogo from "@/components/clubs/ClubLogo";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";
import type { MyOrder } from "@/services/myActivity.service";

const STATUS: Record<string, { label: string; tone: string; bg: string }> = {
  placed: { label: "With the club", tone: "#5c4310", bg: tokens.brassSoft },
  paid: { label: "Paid, ready to collect", tone: "#5c4310", bg: tokens.brassSoft },
  fulfilled: { label: "Collected", tone: "#1B5E20", bg: "#E7F3E8" },
  cancelled: { label: "Cancelled", tone: tokens.inkMuted, bg: tokens.surface },
};

const money = (amount: number) => `£${amount.toFixed(2).replace(/\.00$/, "")}`;

/** Lines shown before the card stops and counts the rest. */
const SHOW_ITEMS = 3;

/**
 * One kit order.
 *
 * Clubs hand kit over in person, so the status that matters is whether the
 * club still has it. What a tier or loyalty points took off is spelled out,
 * since that is why the total is not the sum of the lines above it.
 */
export default function OrderCard({ order }: { order: MyOrder }) {
  const state = STATUS[order.status]
    ?? { label: order.status, tone: tokens.inkMuted, bg: tokens.surface };
  const pieces = order.items.reduce((n, item) => n + item.quantity, 0);
  const shown = order.items.slice(0, SHOW_ITEMS);
  const hidden = order.items.length - shown.length;
  const allQuoted = order.items.length > 0 && order.items.every((item) => item.quoted);

  return (
    <Stack sx={{ height: "100%", borderRadius: 2, overflow: "hidden",
                 backgroundColor: tokens.paper,
                 opacity: order.status === "cancelled" ? 0.74 : 1,
                 border: `1px solid ${
                   order.status === "paid" || order.status === "placed"
                     ? tokens.brass : tokens.rule}` }}>
      <Stack direction="row" spacing={1.75}
        sx={{ px: 2.25, py: 1.75, alignItems: "center",
              borderBottom: `1px solid ${tokens.rule}` }}>
        <ClubLogo slug={order.club.slug} name={order.club.name}
          logoUrl={order.club.logoUrl} size={38} ring={tokens.rule} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: display, fontSize: "1rem", fontWeight: 700 }} noWrap>
            {order.club.name}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                            letterSpacing: "0.06em", color: tokens.inkMuted }}>
            {`ORDERED ${(shortDate(order.placedAt) ?? "").toUpperCase()}`}
          </Typography>
        </Box>

        <Chip size="small" label={state.label}
          sx={{ bgcolor: state.bg, color: state.tone, fontWeight: 700,
                fontSize: "0.68rem", flexShrink: 0 }} />
      </Stack>

      <Stack sx={{ px: 2.25, py: 1.25 }}>
        {shown.map((item) => (
          <Stack key={item.id} direction="row" spacing={1.25}
            sx={{ py: 0.75, alignItems: "baseline",
                  "&:not(:last-of-type)": { borderBottom: `1px solid ${tokens.rule}` } }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.8rem", color: tokens.brass,
                              fontWeight: 700, flexShrink: 0 }}>
              {`${item.quantity}×`}
            </Typography>
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
              {item.name}
            </Typography>
            <Typography sx={{ fontFamily: mono, flexShrink: 0,
                              fontSize: item.quoted ? "0.72rem" : "0.84rem",
                              color: item.quoted ? tokens.inkMuted : undefined }}>
              {item.quoted ? "To be priced" : money(item.lineTotal)}
            </Typography>
          </Stack>
        ))}
        {hidden > 0 ? (
          <Typography variant="body2" sx={{ pt: 1, color: tokens.inkMuted }}>
            {`and ${hidden} more ${hidden === 1 ? "line" : "lines"}`}
          </Typography>
        ) : null}
      </Stack>

      <Stack direction="row" spacing={1.5}
        sx={{ mt: "auto", px: 2.25, py: 1.5, alignItems: "center",
              borderTop: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", color: tokens.inkMuted }}>
            {`${pieces} ITEM${pieces === 1 ? "" : "S"}`}
          </Typography>
          {order.saved > 0 ? (
            <Typography variant="body2" sx={{ color: "#1B5E20" }} noWrap>
              {`${money(order.saved)} off${order.tierLabel ? ` as ${order.tierLabel}` : ""}`}
            </Typography>
          ) : null}
        </Box>

        {/* An order where the club named no price is not an order for nothing.
            Same rule as the bag: never show £0 for "they have not said yet". */}
        <Typography sx={{ fontFamily: mono, fontWeight: 700, flexShrink: 0,
                          fontSize: allQuoted ? "0.78rem" : "1.05rem",
                          color: allQuoted ? tokens.inkMuted : undefined }}>
          {allQuoted ? "To be confirmed" : money(order.total)}
        </Typography>

        <NextLink href={`/clubs/${order.club.slug}/shop`} style={{ textDecoration: "none" }}>
          <Button size="small" variant="text" sx={{ minWidth: 0, px: 0.5, flexShrink: 0 }}>
            Shop
          </Button>
        </NextLink>
      </Stack>
    </Stack>
  );
}
