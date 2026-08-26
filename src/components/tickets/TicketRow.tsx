"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import LockIcon from "@mui/icons-material/Lock";
import { tokens, type Faction } from "@/lib/tokens";
import type { BuyableTicket } from "@/types/ticket";

/**
 * One ticket type, drawn as a ticket.
 *
 * The notched stub is the design system's silhouette for this object, and it
 * is the only place it appears at full size — which is what makes the section
 * read as tickets rather than as a price list. A sold-out stub keeps its
 * notches and drops to the page ground, so the shape stays even when the thing
 * is gone.
 *
 * A blocked ticket stays on the page with the reason showing. Hiding it is
 * what legacy does, and it leaves a member who could upgrade with no way to
 * learn that the tier exists.
 */
const NOTCH = 20;

export default function TicketRow({
  ticket, faction, busy, signedIn, onChange,
}: {
  ticket: BuyableTicket;
  faction: Faction;
  busy: boolean;
  signedIn: boolean;
  onChange: (ticketTypeId: number, quantity: number) => void;
}) {
  // Signed out there is nowhere to put a ticket, so no stub offers Add. One
  // prompt under the list is the way in, rather than four buttons that fail.
  const blocked = !signedIn || Boolean(ticket.blockedReason) || ticket.soldOut;
  const atStock = ticket.remaining !== null && ticket.inCart >= ticket.remaining;
  const low = ticket.remaining !== null && ticket.remaining > 0 && ticket.remaining <= 5;
  const chosen = ticket.inCart > 0;

  const notch = {
    position: "absolute" as const,
    top: "50%",
    width: NOTCH,
    height: NOTCH,
    borderRadius: "50%",
    // The page ground, so the bite reads as taken out of the stub.
    backgroundColor: tokens.surface,
    border: `1px solid ${chosen ? faction.base : tokens.rule}`,
    transform: "translateY(-50%)",
  };

  return (
    <Stack
      aria-disabled={ticket.soldOut || undefined}
      sx={{
        position: "relative",
        height: "100%",
        borderRadius: 1.5,
        border: `1px solid ${chosen ? faction.base : tokens.rule}`,
        backgroundColor: ticket.soldOut ? tokens.surface : tokens.paper,
        opacity: blocked && !ticket.soldOut ? 0.82 : 1,
        transition: "border-color 150ms ease, background-color 150ms ease",
      }}
    >
      {/* The bites. Clipped by the card's own rounding at the edges. */}
      <Box aria-hidden sx={{ ...notch, left: -NOTCH / 2,
                             clipPath: "inset(0 0 0 50%)" }} />
      <Box aria-hidden sx={{ ...notch, right: -NOTCH / 2,
                             clipPath: "inset(0 50% 0 0)" }} />

      <Stack spacing={0.6} sx={{ px: { xs: 2, sm: 2.5 }, pt: 2, pb: 1.5, flex: 1 }}>
        <Stack direction="row" spacing={2}
          sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
          <Typography variant="subtitle1" sx={{ lineHeight: 1.25, minWidth: 0 }}>
            {ticket.label}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.35rem",
                            fontWeight: 700, lineHeight: 1, flexShrink: 0,
                            color: ticket.soldOut ? tokens.inkMuted : tokens.ink }}>
            {ticket.price ?? "Free"}
          </Typography>
        </Stack>

        {ticket.audienceLabel ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {ticket.audienceLabel}
          </Typography>
        ) : null}

        {ticket.soldOut ? (
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                            letterSpacing: "0.1em", color: tokens.danger, fontWeight: 700 }}>
            SOLD OUT
          </Typography>
        ) : ticket.remaining !== null ? (
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                            letterSpacing: "0.08em",
                            color: low ? tokens.brass : tokens.inkMuted,
                            fontWeight: low ? 700 : 400 }}>
            {ticket.remaining} LEFT
          </Typography>
        ) : null}

        {ticket.blockedReason && !ticket.soldOut && signedIn ? (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "flex-start", pt: 0.25 }}>
            <LockIcon sx={{ fontSize: 15, color: tokens.inkMuted, flexShrink: 0, mt: 0.2 }} />
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {ticket.blockedReason}
            </Typography>
          </Stack>
        ) : null}
      </Stack>

      {/* The tear, and the action below it. */}
      {!blocked ? (
        <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2, pt: 1.5, mt: "auto",
                   borderTop: `2px dashed ${tokens.rule}` }}>
          {chosen ? (
            // A stepper rather than a quantity box: nobody types "3" for
            // tickets, and a text field means validating what they typed.
            <Stack direction="row" spacing={0}
              sx={{ alignItems: "center", justifyContent: "space-between",
                    border: `1px solid ${faction.base}`, borderRadius: 999, px: 0.5 }}>
              <IconButton size="small" disabled={busy}
                onClick={() => onChange(ticket.id, ticket.inCart - 1)}
                aria-label={`One fewer ${ticket.label}`}>
                <RemoveIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <Typography aria-live="polite"
                sx={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1rem" }}>
                {ticket.inCart} in your basket
              </Typography>
              <IconButton size="small" disabled={busy || atStock}
                onClick={() => onChange(ticket.id, ticket.inCart + 1)}
                aria-label={`One more ${ticket.label}`}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Stack>
          ) : (
            <Button fullWidth variant="contained" disabled={busy}
              startIcon={<AddIcon />}
              onClick={() => onChange(ticket.id, 1)}
              sx={{ backgroundColor: faction.base,
                    "&:hover": { backgroundColor: faction.deep } }}>
              Add
            </Button>
          )}
        </Box>
      ) : null}
    </Stack>
  );
}
