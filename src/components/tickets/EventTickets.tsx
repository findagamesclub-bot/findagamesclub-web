"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import TicketRow from "./TicketRow";
import BusyOverlay from "@/components/ui/BusyOverlay";
import LinkProgress from "@/components/ui/LinkProgress";
import TicketCart from "./TicketCart";
import { ticketAction, type TicketState } from "@/app/clubs/[slug]/events/[eventId]/actions";
import { formatMoney } from "@/utils/format";
import { tokens, type Faction } from "@/lib/tokens";
import type { BuyableTicket, EventCart } from "@/types/ticket";

/**
 * The ticket desk for one event.
 *
 * The cart lives on the server, keyed to the buyer, so it survives a reload and
 * a different device. Steppers write straight to it rather than holding a local
 * basket that could disagree with what checkout actually charges.
 */
export default function EventTickets({
  tickets, cart, faction, slug, eventKey, eventId, signedIn, hasEnded,
  myBookingReference, myBookingCount = 0,
}: {
  tickets: BuyableTicket[];
  cart: EventCart | null;
  faction: Faction;
  slug: string;
  eventKey: string;
  eventId: number;
  signedIn: boolean;
  hasEnded: boolean;
  myBookingReference: string | null;
  /** Somebody can book twice, so one reference is not the whole story. */
  myBookingCount?: number;
}) {
  const [state, dispatch, busy] = useActionState<TicketState, FormData>(ticketAction, {});
  useActionToast(state);
  const count = cart?.lines.reduce((n, l) => n + l.quantity, 0) ?? 0;

  // Same rule as the booking row: a success message is a confirmation of
  // something you just did, so it clears itself. The stepper is the durable
  // record. Derived rather than copied into state, so the effect only ever sets
  // state from the timer — copying it would be a render triggering a render.
  const [dismissed, setDismissed] = useState<TicketState | null>(null);
  const notice = state.notice && dismissed !== state ? state.notice : null;

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setDismissed(state), 4000);
    return () => clearTimeout(timer);
  }, [notice, state]);

  const send = (intent: string, fields: Record<string, string | number>) => {
    const data = new FormData();
    data.set("intent", intent);
    data.set("slug", slug);
    data.set("eventKey", eventKey);
    data.set("eventId", String(eventId));
    for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
    // The steppers are buttons, not a form, so the transition has to be
    // explicit or `busy` never flips and they stay clickable mid-request.
    startTransition(() => dispatch(data));
  };

  if (hasEnded) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        This event has finished, so tickets are closed.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <ConfirmationNumberIcon sx={{ fontSize: 18, color: tokens.brass }} />
        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                          letterSpacing: "0.14em", color: tokens.inkMuted, fontWeight: 700 }}>
          TICKETS
        </Typography>
      </Stack>

      {myBookingReference ? (
        <Alert severity="success" icon={<ConfirmationNumberIcon fontSize="inherit" />}
          action={
            <Button component={NextLink}
              href={myBookingCount > 1 ? "/tickets" : `/tickets/${myBookingReference}`}
              size="small" color="inherit">
              {myBookingCount > 1 ? "View all" : "View"}
            </Button>
          }>
          {myBookingCount > 1 ? (
            <>
              You have <strong>{myBookingCount}</strong> bookings for this event. The most
              recent is <strong>{myBookingReference}</strong>.
            </>
          ) : (
            <>You are booked in. Your reference is <strong>{myBookingReference}</strong>.</>
          )}
        </Alert>
      ) : null}

      {notice ? <Alert severity="success" sx={{ fontSize: "0.85rem" }}>{notice}</Alert> : null}

      {/*
        The basket leads and pins itself.
        Under a long list of ticket types the total and the way out end up below
        the fold — with ten types you would scroll past all of them to reach the
        one button you came for.
      */}
      {cart && cart.lines.length ? (
        <Box sx={{ px: 1.5, position: { md: "sticky" }, top: { md: 96 }, zIndex: 1,
                   display: { xs: "none", md: "block" } }}>
          <TicketCart
            cart={cart}
            faction={faction}
            busy={busy}
            checkoutHref={`/clubs/${slug}/events/${eventKey}/checkout`}
            onRemove={(id) => send("remove", { ticketTypeId: id })}
          />
        </Box>
      ) : null}

      <BusyOverlay busy={busy} label="Updating your tickets">
        <Stack spacing={2.5}>
          {/* Padded, so the notches have room to bite into the ground. */}
          <Box sx={{ display: "grid", gap: 2.5, px: 1.5,
                     gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "1fr" } }}>
          {tickets.map((t) => (
            <TicketRow key={t.id} ticket={t} faction={faction} busy={busy} signedIn={signedIn}
              onChange={(id, quantity) =>
                quantity <= 0
                  ? send("remove", { ticketTypeId: id })
                  : send("set", { ticketTypeId: id, quantity })
              } />
          ))}
          </Box>

          {!signedIn ? (
            <Box sx={{ px: 1.5 }}>
              <NextLink href={`/auth/sign-in?next=/clubs/${slug}/events/${eventKey}`}
                style={{ textDecoration: "none" }}>
                <Button fullWidth variant="contained"
                  sx={{ backgroundColor: faction.base,
                        "&:hover": { backgroundColor: faction.deep } }}>
                  Sign in to book
                </Button>
              </NextLink>
            </Box>
          ) : null}

        </Stack>
      </BusyOverlay>

      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Tickets are reserved with the club. Payment is taken either before the event
        or on the day, depending on the club.
      </Typography>

      {/*
        On a phone the sidebar is just more page, so the basket becomes a bar
        pinned to the bottom of the screen — the total and the way out stay
        reachable however far down the list somebody is.
      */}
      {cart && cart.lines.length ? (
        <Box
          sx={{
            display: { xs: "block", md: "none" },
            position: "fixed", left: 0, right: 0, bottom: 0,
            zIndex: (theme) => theme.zIndex.appBar,
            px: 2, py: 1.5,
            backgroundColor: tokens.paper,
            borderTop: `1px solid ${tokens.rule}`,
            boxShadow: "0 -4px 18px rgba(16,27,45,0.12)",
          }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Stack spacing={0} sx={{ minWidth: 0 }}>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem",
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                {count} {count === 1 ? "TICKET" : "TICKETS"}
              </Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem",
                                fontWeight: 700, lineHeight: 1.1 }}>
                {formatMoney(cart.total, cart.currency)}
              </Typography>
            </Stack>

            <NextLink href={`/clubs/${slug}/events/${eventKey}/checkout`}
              style={{ textDecoration: "none", flex: 1 }}>
              <LinkProgress
                label="Checkout"
                pendingLabel="Opening checkout"
                fullWidth
                variant="contained"
                disabled={busy}
                sx={{ backgroundColor: faction.base,
                      "&:hover": { backgroundColor: faction.deep } }}
              />
            </NextLink>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
