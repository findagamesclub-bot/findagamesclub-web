"use client";

import { startTransition, useActionState, useState } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import UrlFilterBar from "@/components/ui/UrlFilterBar";
import { useActionToast } from "@/components/ui/Toaster";
import BookingRow from "./BookingRow";
import PaymentDialog from "./[eventId]/roster/PaymentDialog";
import CancelPlaceDialog from "./[eventId]/roster/CancelPlaceDialog";
import EditBookingDialog from "./[eventId]/roster/EditBookingDialog";
import { rosterAction, type RosterState } from "./[eventId]/roster/actions";
import { PER_PAGE } from "@/utils/paging";
import { formatMoney } from "@/utils/format";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { BookingsView } from "@/services/clubBookings.service";
import type { ClubBookingRow } from "@/types/eventEditor";

/**
 * Every booking the club holds, on one screen.
 *
 * The roster answers "who is coming on Saturday". This answers the question a
 * club with a few seasons behind it actually asks: who still owes me anything,
 * on anything. Filtered in SQL and paged in the URL, because a thousand rows
 * shipped to the browser to hide nine hundred is not a list, it is a download.
 */
export default function BookingsBoard({
  slug, view, faction,
}: {
  slug: string;
  view: BookingsView;
  faction: Faction;
}) {
  const [state, submit, busy] = useActionState<RosterState, FormData>(rosterAction, {});
  useActionToast(state);

  // The server is doing the filtering, so the page dims while it answers.
  const [sifting, setSifting] = useState(false);
  // Which booking a save is running for. Without it every row's button spins
  // at once, which says "everything is happening" rather than "this one is".
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [paying, setPaying] = useState<ClubBookingRow | null>(null);
  const [cancelling, setCancelling] = useState<ClubBookingRow | null>(null);
  const [editing, setEditing] = useState<ClubBookingRow | null>(null);

  const send = (eventId: number, bookingId: number, fields: Record<string, string>) => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("eventId", String(eventId));
    data.set("bookingId", String(bookingId));
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    setPendingId(bookingId);
    startTransition(() => submit(data));
  };

  const { counts, filters } = view;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                          letterSpacing: "0.1em",
                          color: counts.reserved ? tokens.brass : tokens.inkMuted }}>
          {counts.reserved
            ? `${counts.all} BOOKED · ${counts.reserved} STILL TO PAY`
            : `${counts.all} BOOKED · ALL PAID`}
        </Typography>

        {/* Off this page only, and it says so. A figure worked out from
            twenty-five rows and labelled as the club's whole book would be a
            number somebody chases the wrong people with. */}
        {view.owed.people ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {`${formatMoney(view.owed.amount, "GBP")} to collect on this page`}
          </Typography>
        ) : null}
      </Stack>

      <UrlFilterBar
        query={filters.query}
        placeholder="Search by name, email or reference"
        tab={filters.tab}
        tabs={[
          { value: "all", label: "All", count: counts.all },
          { value: "reserved", label: "To pay", count: counts.reserved },
          { value: "paid", label: "Paid", count: counts.paid },
          { value: "checkedin", label: "Checked in", count: counts.checkedin },
          { value: "cancelled", label: "Cancelled", count: counts.cancelled },
        ]}
        sort={filters.sort}
        sorts={[
          { value: "newest", label: "Newest first" },
          { value: "name", label: "By name" },
          { value: "value", label: "Biggest first" },
        ]}
        second={view.events.length > 1 ? {
          label: "Event",
          param: "event",
          value: String(filters.eventId || 0),
          options: [
            { value: "0", label: "Every event" },
            ...view.events.map((event) => ({
              value: String(event.id), label: `${event.title} (${event.bookings})`,
            })),
          ],
        } : undefined}
        // Matches what the pager leaves out, so the same view has one address
        // however the reader arrived at it.
        defaults={{ state: "all", sort: "newest", event: "0" }}
        onBusy={setSifting}
      />

      <BusyOverlay busy={sifting} variant="dim" label="Filtering bookings">
        <Stack spacing={1}>
          {view.rows.length === 0 ? (
            counts.all === 0 ? (
              <EmptyState
                title="Nobody has booked anything yet"
                description="Every ticket anybody takes on any of your events turns up here, with what they owe you and whether they have arrived."
              />
            ) : (
              <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
                {filters.query
                  ? `Nobody matching "${filters.query}" in this group.`
                  : "Nothing in this group."}
              </Typography>
            )
          ) : null}

          {view.rows.map((row) => (
            <BookingRow key={row.bookingId} slug={slug} row={row} faction={faction}
              busy={busy && pendingId === row.bookingId}
              onCheckIn={(arrived) => send(row.eventId, row.bookingId, {
                intent: "check-in", arrived: arrived ? "yes" : "no",
              })}
              onPayment={() => setPaying(row)}
              onCancel={() => setCancelling(row)}
              onEdit={() => setEditing(row)}
              onRefund={(status) => send(row.eventId, row.bookingId, {
                intent: "refund", refundStatus: status,
              })}
            />
          ))}
        </Stack>
      </BusyOverlay>

      {/* Paged by address, so a page of results is a link somebody can send. */}
      <Pager page={filters.page} total={view.total} noun="bookings"
        size={PER_PAGE.rows}
        href={{
          path: `/clubs/${slug}/manage/events`,
          params: {
            tab: "bookings",
            state: filters.tab === "all" ? undefined : filters.tab,
            q: filters.query || undefined,
            event: filters.eventId ? String(filters.eventId) : undefined,
            sort: filters.sort === "newest" ? undefined : filters.sort,
          },
        }} />

      <PaymentDialog row={paying} saving={busy} onClose={() => setPaying(null)}
        onSave={(fields) => {
          if (!paying) return;
          const row = paying;
          setPaying(null);
          send(row.eventId, row.bookingId,
            { intent: "payment", total: String(row.total), ...fields });
        }} />

      <CancelPlaceDialog row={cancelling} saving={busy} onClose={() => setCancelling(null)}
        onConfirm={(reason) => {
          if (!cancelling) return;
          const row = cancelling;
          setCancelling(null);
          send(row.eventId, row.bookingId, { intent: "cancel", reason });
        }} />

      <EditBookingDialog row={editing} saving={busy} onClose={() => setEditing(null)}
        onSave={(fields) => {
          if (!editing) return;
          const row = editing;
          setEditing(null);
          send(row.eventId, row.bookingId, { intent: "edit", ...fields });
        }} />
    </Stack>
  );
}
