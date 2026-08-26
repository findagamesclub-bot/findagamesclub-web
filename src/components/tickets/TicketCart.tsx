"use client";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import CloseIcon from "@mui/icons-material/Close";
import LinkProgress from "@/components/ui/LinkProgress";
import { formatMoney } from "@/utils/format";
import { tokens, type Faction } from "@/lib/tokens";
import type { EventCart } from "@/types/ticket";

/** The cart, priced. Same numbers the checkout freezes onto the booking. */
export default function TicketCart({
  cart, faction, checkoutHref, busy, onRemove,
}: {
  cart: EventCart;
  faction: Faction;
  checkoutHref: string;
  busy: boolean;
  onRemove: (ticketTypeId: number) => void;
}) {
  const count = cart.lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <Box
      sx={{
        border: `1px solid ${tokens.rule}`,
        borderTop: `3px solid ${faction.base}`,
        borderRadius: 1.5,
        backgroundColor: tokens.paper,
        overflow: "hidden",
      }}
    >
      <Stack direction="row" spacing={1}
        sx={{ px: 2, py: 1.25, alignItems: "baseline", justifyContent: "space-between",
              backgroundColor: tokens.surface, borderBottom: `1px solid ${tokens.rule}` }}>
        <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          Your tickets
        </Typography>
        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.74rem",
                          letterSpacing: "0.08em", color: tokens.inkMuted }}>
          {count} {count === 1 ? "TICKET" : "TICKETS"}
        </Typography>
      </Stack>

      <Stack sx={{ px: 2, py: 1 }}>
        {cart.lines.map((line) => (
          <Stack key={line.ticketTypeId} direction="row" spacing={1.5}
            sx={{ py: 1, alignItems: "center", justifyContent: "space-between" }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "baseline", minWidth: 0 }}>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.85rem",
                                color: faction.deep, flexShrink: 0 }}>
                {line.quantity}&times;
              </Typography>
              <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis",
                                                whiteSpace: "nowrap" }}>
                {line.label}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>
                {formatMoney(line.lineTotal, cart.currency)}
              </Typography>
              <IconButton size="small" disabled={busy}
                onClick={() => onRemove(line.ticketTypeId)}
                aria-label={`Remove ${line.label}`}>
                <CloseIcon sx={{ fontSize: 15, color: tokens.inkMuted }} />
              </IconButton>
            </Stack>
          </Stack>
        ))}
      </Stack>

      <Divider />

      <Stack spacing={0.75} sx={{ px: 2, py: 1.5 }}>
        <Row label="Subtotal" value={formatMoney(cart.subtotal, cart.currency)} />

        {cart.discountAmount > 0 ? (
          <Row
            label={`${cart.tierLabel ?? "Member"} discount · ${cart.discountPercent}%`}
            value={`− ${formatMoney(cart.discountAmount, cart.currency)}`}
            tone={tokens.positive}
          />
        ) : null}

        <Stack direction="row" spacing={2}
          sx={{ pt: 0.75, alignItems: "baseline", justifyContent: "space-between",
                borderTop: `1px solid ${tokens.rule}` }}>
          <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>Total</Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.3rem", fontWeight: 700 }}>
            {formatMoney(cart.total, cart.currency)}
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ px: 2, pb: 2 }}>
        <NextLink href={checkoutHref} style={{ textDecoration: "none" }}>
          <LinkProgress
            label="Continue to checkout"
            pendingLabel="Opening checkout"
            fullWidth
            variant="contained"
            disabled={busy || count === 0}
            sx={{ backgroundColor: faction.base,
                  "&:hover": { backgroundColor: faction.deep } }}
          />
        </NextLink>
      </Box>
    </Box>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
      <Typography variant="body2" sx={{ color: tone ?? tokens.inkMuted }}>{label}</Typography>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: tone }}>
        {value}
      </Typography>
    </Stack>
  );
}
