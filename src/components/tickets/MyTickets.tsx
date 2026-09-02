"use client";

import { useActionState, useRef, useState } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import TicketStub from "./TicketStub";
import { cancelTicketAction, type CancelState } from "@/app/tickets/actions";
import { tokens, type Faction } from "@/lib/tokens";
import type { EventBooking } from "@/types/ticket";
import { PER_PAGE } from "@/utils/paging";

type Entry = { booking: EventBooking; faction: Faction; monogram: string };

/** The member's own tickets, newest first, with a way to give one back. */
export default function MyTickets({ live, past }: { live: Entry[]; past: Entry[] }) {
  const [state, submit, busy] = useActionState<CancelState, FormData>(cancelTicketAction, {});
  useActionToast(state);
  const [confirming, setConfirming] = useState<EventBooking | null>(null);
  // Cancelled tickets only ever accumulate, and they are the half nobody is
  // looking for. Live ones are few by definition, so they stay on one screen.
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(past, PER_PAGE.rich, top);

  return (
    <Stack spacing={3}>

      {live.map((entry) => (
        <Stack key={entry.booking.id} spacing={1}>
          <NextLink href={`/tickets/${entry.booking.reference}`} style={{ textDecoration: "none" }}>
            <TicketStub {...entry} />
          </NextLink>
          <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
            <Button component={NextLink} size="small" variant="text"
              href={`/clubs/${entry.booking.clubSlug}/events/${entry.booking.legacyId}`}>
              View the event
            </Button>
            <Button size="small" variant="text" disabled={busy}
              onClick={() => setConfirming(entry.booking)}
              sx={{ color: tokens.danger }}>
              Cancel
            </Button>
          </Stack>
        </Stack>
      ))}

      {past.length ? (
        <Box sx={{ pt: 1 }}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                            letterSpacing: "0.12em", color: tokens.inkMuted, mb: 1.5 }}>
            CANCELLED
          </Typography>
          <Stack ref={top} spacing={2}>
            {paged.shown.map((entry) => <TicketStub key={entry.booking.id} {...entry} />)}
          </Stack>
          <Pager page={paged.page} total={paged.total} noun="cancelled tickets"
            size={6} onChange={paged.goTo} />
        </Box>
      ) : null}

      <Dialog open={Boolean(confirming)} onClose={() => setConfirming(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancel this booking?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.95rem" }}>
            {confirming
              ? `Your place at ${confirming.eventTitle} goes back into the pool, and the
                 reference ${confirming.reference} stops being valid. Rebooking later is
                 possible only if tickets are still available.`
              : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirming(null)} variant="text">Keep it</Button>
          <Box component="form" action={submit} onSubmit={() => setConfirming(null)}>
            <input type="hidden" name="bookingId" value={confirming?.id ?? ""} />
            <Button type="submit" variant="contained" color="error" loading={busy}
              loadingPosition="start">
              Cancel the booking
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
