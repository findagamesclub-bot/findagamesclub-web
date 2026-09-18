"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import CheckoutForm from "./CheckoutForm";
import { formatMoney } from "@/utils/format";
import { priceTickets, type TicketStanding } from "@/utils/ticket-pricing";
import { canAddMore } from "@/utils/ticket-quantity";
import { tokens, type Faction } from "@/lib/tokens";
import type { BuyableTicket, EventCart } from "@/types/ticket";

/**
 * The tickets you are holding, and the way to reserve them.
 *
 * The same drawer the shop uses, for the same reason the client gave: a
 * checkout on its own page takes somebody off the event they are still reading
 * and makes going back to add a second ticket a two-page round trip. Here the
 * event stays behind it.
 *
 * `/checkout` stays where it is. It is a real address somebody may have, and
 * it renders the same form.
 */
export default function TicketDrawer({
  open, onClose, cart, tickets, standing, faction,
  slug, eventKey, eventId, fullName, email, onQuantity, onRemove,
}: {
  open: boolean;
  onClose: () => void;
  /** The cart the buyer is looking at, which may be a beat ahead of the server. */
  cart: EventCart;
  /**
   * The types on sale, for what is left of each. Without it the drawer's plus
   * counted past the last place and the refusal did not arrive until checkout.
   */
  tickets: BuyableTicket[];
  /** What they may pay with. Null while it is still being worked out. */
  standing: TicketStanding | null;
  faction: Faction;
  slug: string;
  eventKey: string;
  eventId: number;
  fullName: string;
  email: string;
  onQuantity: (ticketTypeId: number, quantity: number) => void;
  onRemove: (ticketTypeId: number) => void;
}) {
  // One figure for the whole drawer. The points field used to hold its own
  // state, which left the summary and the button quoting different totals.
  const [points, setPoints] = useState(0);
  const money = (n: number) => formatMoney(n, cart.currency);

  /**
   * The money always comes from the cart in front of the buyer; the standing
   * only says what they may spend against it.
   *
   * Taking the subtotal from the standing looked tidier and was wrong twice
   * over: it is the server's snapshot from the last load, so a stepper pressed
   * since then did not move the Reserve figure, and on a slow connection the
   * button could quote a total for a cart that no longer existed.
   */
  const priced = {
    subtotal: cart.subtotal,
    currency: cart.currency,
    discountPercent: cart.discountPercent,
    tierLabel: cart.tierLabel ?? null,
    points: standing?.points ?? 0,
    pointValue: standing?.pointValue ?? null,
    redemptionCapPercent: standing?.redemptionCapPercent ?? 0,
  };
  const price = priceTickets(priced, points);
  const count = cart.lines.reduce((n, l) => n + l.quantity, 0);
  const remainingOf = (ticketTypeId: number) =>
    tickets.find((t) => t.id === ticketTypeId)?.remaining ?? null;

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 480, md: 560 } } } }}>
      <Stack sx={{ height: "100%" }}>
        <Stack direction="row" spacing={2}
          sx={{ p: 2, alignItems: "center", justifyContent: "space-between",
                borderBottom: `1px solid ${tokens.rule}` }}>
          <Typography variant="h3" sx={{ fontSize: "1.15rem" }}>
            Your tickets{count ? ` · ${count}` : ""}
          </Typography>
          <IconButton onClick={onClose} aria-label="Close your tickets">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Stack spacing={2} sx={{ p: 2, flex: 1, overflowY: "auto", minHeight: 0 }}>
          {cart.lines.length === 0 ? (
            <Typography variant="body2"
              sx={{ color: tokens.inkMuted, py: 4, textAlign: "center" }}>
              Nothing held yet. Add a ticket from the event.
            </Typography>
          ) : null}

          {cart.lines.map((line) => (
            <Stack key={line.ticketTypeId} spacing={0.75}
              sx={{ pb: 1.5, borderBottom: `1px solid ${tokens.rule}` }}>
              <Stack direction="row" spacing={1.5}
                sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2">{line.label}</Typography>
                  {/* What one costs, so a line total is arithmetic the reader
                      can follow rather than a number to trust. */}
                  <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
                    {`${line.quantity} × ${money(line.unitAmount)}`}
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                                  flexShrink: 0 }}>
                  {money(line.lineTotal)}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1}
                sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Stack direction="row"
                  sx={{ alignItems: "center", border: `1px solid ${tokens.rule}`,
                        borderRadius: 999 }}>
                  {/* Not disabled while a save is in flight: the figure has
                      already moved and the server is catching up. Greying it
                      out under the finger is exactly what the shop does not
                      do. */}
                  <IconButton size="small" disabled={line.quantity <= 1}
                    aria-label={`One fewer ${line.label}`}
                    onClick={() => onQuantity(line.ticketTypeId, line.quantity - 1)}>
                    <RemoveIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                  <Box sx={{ minWidth: 28, textAlign: "center" }}>
                    <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                      {line.quantity}
                    </Typography>
                  </Box>
                  <IconButton size="small"
                    disabled={!canAddMore(line.quantity, remainingOf(line.ticketTypeId))}
                    aria-label={`One more ${line.label}`}
                    onClick={() => onQuantity(line.ticketTypeId, line.quantity + 1)}>
                    <AddIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Stack>

                <IconButton size="small"
                  aria-label={`Remove ${line.label}`}
                  onClick={() => onRemove(line.ticketTypeId)}>
                  <DeleteOutlinedIcon sx={{ fontSize: 19, color: tokens.inkMuted }} />
                </IconButton>
              </Stack>
            </Stack>
          ))}

          {cart.lines.length ? (
            <Stack spacing={0.5}>
              <Row label="Tickets" value={money(cart.subtotal)} />
              {cart.discountAmount > 0 ? (
                <Row
                  label={`${cart.tierLabel ?? "Member"} discount`}
                  value={`− ${money(cart.discountAmount)}`}
                  tone={tokens.positive}
                />
              ) : null}
              {price.pointsOff > 0 ? (
                <Row label="Points" value={`− ${money(price.pointsOff)}`}
                  tone={tokens.positive} />
              ) : null}
            </Stack>
          ) : null}
        </Stack>

        {cart.lines.length ? (
          <Box sx={{ p: 2, borderTop: `1px solid ${tokens.rule}`,
                     backgroundColor: tokens.surface }}>
            <CheckoutForm
              slug={slug} eventKey={eventKey} eventId={eventId}
              fullName={fullName} email={email} currency={cart.currency}
              faction={faction} standing={priced} price={price}
              points={points} onPoints={setPoints} showPaymentNote={false}
            />
          </Box>
        ) : null}
      </Stack>
    </Drawer>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
      <Typography variant="body2" sx={{ color: tone ?? tokens.inkMuted }}>{label}</Typography>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: tone }}>
        {value}
      </Typography>
    </Stack>
  );
}
