"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
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
import BusyOverlay from "@/components/ui/BusyOverlay";
import FilterBar from "@/components/account/FilterBar";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import TicketStub from "./TicketStub";
import { cancelTicketAction, type CancelState } from "@/app/tickets/actions";
import {
  canCancel, countTickets, filterTickets, type TicketSort, type TicketTab,
} from "@/utils/ticket-filter";
import { formatMoney } from "@/utils/format";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { EventBooking } from "@/types/ticket";
import { PER_PAGE } from "@/utils/paging";

type Entry = { booking: EventBooking; faction: Faction; monogram: string };

/**
 * The member's own tickets, with the three questions they actually ask.
 *
 * What am I going to, what do I still owe, and where is that reference. The
 * same bar as the memberships, coaching and orders lists, because somebody who
 * has met one of those has met this.
 */
export default function MyTickets({
  entries, today,
}: {
  entries: Entry[];
  /** London's today, so a ticket does not change group at midnight. */
  today: string;
}) {
  const [state, submit, busy] = useActionState<CancelState, FormData>(cancelTicketAction, {});
  useActionToast(state);
  const [confirming, setConfirming] = useState<EventBooking | null>(null);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TicketTab>("upcoming");
  const [sort, setSort] = useState<TicketSort>("soonest");
  const [sifting, startSift] = useTransition();

  const bookings = useMemo(() => entries.map((e) => e.booking), [entries]);
  const counts = useMemo(() => countTickets(bookings, today), [bookings, today]);
  const results = useMemo(
    () => filterTickets(entries.map((e) => ({ ...e.booking, entry: e })),
                        { tab, query, sort, today }),
    [entries, tab, query, sort, today]);

  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PER_PAGE.rich, top);

  // What is still owed across everything, which is the one number a member
  // cannot work out by looking.
  const owed = useMemo(() => bookings
    .filter((b) => b.status !== "cancelled" && b.paymentStatus === "unpaid")
    .reduce((n, b) => n + b.total, 0), [bookings]);

  return (
    <Stack spacing={2.5} ref={top}>
      {owed > 0 ? (
        <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.brass }}>
          {`${counts.topay} STILL TO PAY · ${formatMoney(owed, "GBP")}`}
        </Typography>
      ) : null}

      <FilterBar
        query={query}
        onQuery={(value) => startSift(() => setQuery(value))}
        placeholder="Search by event, club or reference"
        tabs={[
          { value: "upcoming" as const, label: "Coming up", count: counts.upcoming },
          { value: "topay" as const, label: "To pay", count: counts.topay },
          { value: "paid" as const, label: "Paid", count: counts.paid },
          { value: "past" as const, label: "Past", count: counts.past },
          { value: "cancelled" as const, label: "Cancelled", count: counts.cancelled },
          { value: "all" as const, label: "All", count: counts.all },
        ]}
        filter={tab}
        onFilter={(value) => startSift(() => setTab(value))}
        sorts={[
          { value: "soonest" as const, label: "Soonest first" },
          { value: "latest" as const, label: "Latest first" },
          { value: "booked" as const, label: "Recently booked" },
        ]}
        sort={sort}
        onSort={(value) => startSift(() => setSort(value))}
      />

      <BusyOverlay busy={busy || sifting} variant="dim" label="Updating your tickets">
        <Stack spacing={3}>
          {results.length === 0 ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
              {query ? `Nothing matching "${query}".` : "Nothing in this group."}
            </Typography>
          ) : null}

          {paged.shown.map((row) => {
            const entry = row.entry;
            return (
              <Stack key={entry.booking.id} spacing={1}>
                <NextLink href={`/tickets/${entry.booking.reference}`}
                  style={{ textDecoration: "none" }}>
                  <TicketStub booking={entry.booking} faction={entry.faction}
                    monogram={entry.monogram} />
                </NextLink>
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
                  <Button component={NextLink} size="small" variant="text"
                    href={`/clubs/${entry.booking.clubSlug}/events/${entry.booking.legacyId}`}>
                    View the event
                  </Button>
                  {/* Giving back a place at something that already happened
                      means nothing, so the button is not there to press. */}
                  {canCancel(entry.booking, today) ? (
                    <Button size="small" variant="text" disabled={busy}
                      onClick={() => setConfirming(entry.booking)}
                      sx={{ color: tokens.danger }}>
                      Cancel
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      </BusyOverlay>

      <Pager page={paged.page} total={paged.total} noun="tickets"
        size={PER_PAGE.rich} onChange={paged.goTo} />

      <Dialog open={Boolean(confirming)} onClose={() => setConfirming(null)}
        maxWidth="xs" fullWidth>
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
