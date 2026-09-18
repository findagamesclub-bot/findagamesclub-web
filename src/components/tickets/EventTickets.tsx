"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import Badge from "@mui/material/Badge";
import TicketRow from "./TicketRow";
import TicketDrawer from "./TicketDrawer";
import { ticketAction, type TicketState } from "@/app/clubs/[slug]/(console)/events/[eventId]/actions";
import { formatMoney } from "@/utils/format";
import { changeCartLine } from "@/utils/cart-pricing";
import { allowedQuantity } from "@/utils/ticket-quantity";
import type { TicketStanding } from "@/utils/ticket-pricing";
import { tokens, type Faction } from "@/lib/tokens";
import type { BuyableTicket, EventCart } from "@/types/ticket";

/**
 * The ticket desk for one event.
 *
 * The cart lives on the server, keyed to the buyer, so it survives a reload and
 * a different device. Steppers write straight to it rather than holding a local
 * basket that could disagree with what checkout actually charges.
 *
 * Reserving happens in a drawer over the event, the way the shop's bag does.
 * A checkout on its own page took somebody off the thing they were still
 * reading, and going back to add a second ticket was a two-page round trip.
 */
export default function EventTickets({
  tickets, cart, standing, faction, slug, eventKey, eventId, signedIn, hasEnded,
  cancelled, fullName, email, myBookingReference, myBookingCount = 0,
}: {
  tickets: BuyableTicket[];
  cart: EventCart | null;
  /** What they may pay with. Null for anybody who cannot spend anything. */
  standing: TicketStanding | null;
  faction: Faction;
  slug: string;
  eventKey: string;
  eventId: number;
  signedIn: boolean;
  hasEnded: boolean;
  /** Called off. Closes the desk the same way a finished event does. */
  cancelled: boolean;
  fullName: string;
  email: string;
  myBookingReference: string | null;
  /** Somebody can book twice, so one reference is not the whole story. */
  myBookingCount?: number;
}) {
  // An async action rather than `useActionState`, because `useOptimistic` only
  // holds its value for as long as the transition that set it is still
  // running. A dispatch inside a plain `startTransition` returns immediately,
  // so React ended the transition on the same tick and threw the optimistic
  // quantity away before it ever painted. Awaiting the action inside the
  // transition is what keeps it on screen until the server answers.
  const [state, setState] = useState<TicketState>({});
  const [, startAction] = useTransition();
  useActionToast(state);
  const [open, setOpen] = useState(false);

  // The cart the buyer is looking at, which runs a moment ahead of the one on
  // the server. A stepper that waits on a round trip before the number moves
  // reads as broken next to the shop's bag, and the shop's bag is the
  // experience the client asked for.
  //
  // React discards this the moment the action settles, so the server stays the
  // authority and a refusal snaps the figure back rather than leaving a lie on
  // screen.
  const [shown, showAhead] = useOptimistic(
    cart, (_current: EventCart | null, next: EventCart) => next);

  const count = shown?.lines.reduce((n, l) => n + l.quantity, 0) ?? 0;
  const heldOf = (ticketTypeId: number) =>
    shown?.lines.find((line) => line.ticketTypeId === ticketTypeId)?.quantity ?? 0;

  // Nothing closes the drawer on a successful reservation, because checkout
  // redirects to the confirmation and the page goes with it. Taking the last
  // ticket out leaves it open on its empty state, the same as the shop's bag:
  // a drawer that shuts itself when you remove something reads as a mistake
  // you cannot undo.

  /**
   * One way in for every stepper, so the drawer and the ticket list cannot
   * disagree about what is held.
   */
  const change = (ticketTypeId: number, quantity: number) => {
    const ticket = tickets.find((t) => t.id === ticketTypeId);
    // Clamped here too, so the number never shows a figure the server is about
    // to trim. The service applies the same rule against a fresher count, and
    // the database locks the type at checkout.
    const wanted = ticket
      ? allowedQuantity(quantity, ticket.remaining, ticket.label).quantity
      : Math.max(0, Math.floor(quantity));

    const data = new FormData();
    data.set("intent", wanted <= 0 ? "remove" : "set");
    data.set("slug", slug);
    data.set("eventKey", eventKey);
    data.set("eventId", String(eventId));
    data.set("ticketTypeId", String(ticketTypeId));
    if (wanted > 0) data.set("quantity", String(wanted));

    startAction(async () => {
      if (ticket) {
        showAhead(changeCartLine(shown, {
          ticketTypeId, label: ticket.label, price: ticket.price,
          unitAmount: ticket.unitAmount,
        }, wanted));
      }
      const result = await ticketAction({}, data);
      // Only refusals are worth saying. The shop says nothing when something
      // goes in the bag, because the number moving and the button changing are
      // the answer, and a toast on every plus is noise over the top of it.
      setState(result.error ? result : {});
    });
  };

  // Before the finished test, so an event called off last month says it was
  // called off rather than that it finished. The banner at the top of the page
  // carries the club's reason; this is the desk agreeing with it, which it did
  // not: it went on selling the last place under a cancellation notice.
  if (cancelled) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        This event was called off, so tickets are closed.
      </Typography>
    );
  }

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

      {/* No overlay on the steppers. They answer instantly from the optimistic
          cart, and a scrim over the whole page for a plus button was the thing
          that made this feel unlike the shop. */}
      <Stack spacing={2.5}>
          {/* Padded, so the notches have room to bite into the ground. */}
          <Box sx={{ display: "grid", gap: 2.5, px: 1.5,
                     gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", md: "minmax(0, 1fr)" } }}>
          {tickets.map((t) => (
            <TicketRow key={t.id} ticket={t} held={heldOf(t.id)} faction={faction}
              signedIn={signedIn} onChange={change} />
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

      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Tickets are reserved with the club. Payment is taken either before the event
        or on the day, depending on the club.
      </Typography>

      {/* Pinned to the window rather than the page, the same as the shop's bag:
          as a sticky element in the grid it drifted past the container's edge
          on a wide screen. It is also the only feedback that an Add worked, so
          the drawer never barges open on its own. */}
      {shown && shown.lines.length && !open ? (
        <Box sx={{ position: "fixed", right: { xs: 16, md: 28 }, bottom: { xs: 16, md: 28 },
                   zIndex: (theme) => theme.zIndex.drawer - 1 }}>
          <Badge badgeContent={count} color="error" overlap="rectangular">
            <Button variant="contained" size="large"
              startIcon={<ConfirmationNumberIcon />}
              onClick={() => setOpen(true)}
              sx={{ backgroundColor: faction.base, boxShadow: 6, borderRadius: 999, px: 2.5,
                    "&:hover": { backgroundColor: faction.deep } }}>
              Your tickets · {formatMoney(shown.total, shown.currency)}
            </Button>
          </Badge>
        </Box>
      ) : null}

      {shown ? (
        <TicketDrawer
          open={open}
          onClose={() => setOpen(false)}
          cart={shown}
          tickets={tickets}
          standing={standing}
          faction={faction}
          slug={slug}
          eventKey={eventKey}
          eventId={eventId}
          fullName={fullName}
          email={email}
          onQuantity={change}
          onRemove={(id) => change(id, 0)}
        />
      ) : null}

    </Stack>
  );
}
