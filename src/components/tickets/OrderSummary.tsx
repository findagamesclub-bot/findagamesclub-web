import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatMoney } from "@/utils/format";
import { tokens, type Faction } from "@/lib/tokens";
import type { TicketPrice } from "@/utils/ticket-pricing";
import type { EventCart } from "@/types/ticket";

/**
 * What is being bought and what it comes to.
 *
 * The total here is the one on the button, computed from the same
 * `priceTickets` call, because a checkout that shows two different totals is
 * asking somebody to guess which one they will be charged.
 */
export default function OrderSummary({
  cart, price, tierLabel, faction,
}: {
  cart: EventCart;
  price: TicketPrice;
  tierLabel: string | null;
  faction: Faction;
}) {
  const money = (n: number) => formatMoney(n, cart.currency);

  return (
    <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
               backgroundColor: tokens.paper }}>
      <Stack sx={{ px: 2.5, pt: 2, pb: 1.5 }} spacing={1}>
        {cart.lines.map((line) => (
          <Stack key={line.ticketTypeId} direction="row" spacing={2}
            sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "baseline", minWidth: 0 }}>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                                fontSize: "0.85rem", color: faction.deep }}>
                {line.quantity}&times;
              </Typography>
              <Typography variant="body2">{line.label}</Typography>
            </Stack>
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>
              {money(line.lineTotal)}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Divider />

      <Stack spacing={0.75} sx={{ px: 2.5, py: 2 }}>
        <Row label="Subtotal" value={money(price.subtotal)} />

        {price.discountAmount > 0 ? (
          <Row tone={tokens.positive}
            label={`${tierLabel ?? "Member"} discount · ${price.discountPercent}%`}
            value={`− ${money(price.discountAmount)}`} />
        ) : null}

        {/* Only once they have actually put some in, so an untouched checkout
            does not carry a line reading "0 points off − £0.00". */}
        {price.pointsOff > 0 ? (
          <Row tone={tokens.positive} label="Loyalty points"
            value={`− ${money(price.pointsOff)}`} />
        ) : null}

        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline",
                                     pt: 0.75, borderTop: `1px solid ${tokens.rule}` }}>
          <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>Total</Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.35rem", fontWeight: 700 }}>
            {money(price.total)}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between" }}>
      <Typography variant="body2" sx={{ color: tone ?? tokens.inkMuted }}>{label}</Typography>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: tone }}>
        {value}
      </Typography>
    </Stack>
  );
}
