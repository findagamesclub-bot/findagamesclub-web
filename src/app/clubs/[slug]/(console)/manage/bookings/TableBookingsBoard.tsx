"use client";

import { startTransition, useActionState, useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import UrlFilterBar from "@/components/ui/UrlFilterBar";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import TableBookingRow from "./TableBookingRow";
import TablePaymentDialog from "./TablePaymentDialog";
import { tablePaymentAction, type TablePaymentState } from "./actions";
import { PER_PAGE } from "@/utils/paging";
import { monthLabel, pickerOptions } from "@/utils/booking-facets";
import { formatMoney } from "@/utils/format";
import {
  TABLE_SORTS, TABLE_TABS, type TableBookingRow as Row,
  type TableSort, type TableTab,
} from "@/utils/table-bookings";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { TableBookingsResult } from "@/services/clubTableBookings.service";

/**
 * Every table the club has booked, filtered in SQL and paged in the address.
 *
 * A filtered list is then a link: an owner can send "everybody who still owes
 * me for a table" to whoever is chasing it.
 */
export default function TableBookingsBoard({
  slug, faction, view, filters,
}: {
  slug: string;
  faction: Faction;
  view: TableBookingsResult;
  filters: { tab: TableTab; sort: TableSort; query: string; month: string; page: number };
}) {
  const [state, submit, busy] =
    useActionState<TablePaymentState, FormData>(tablePaymentAction, {});
  useActionToast(state);

  const [sifting, setSifting] = useState(false);
  // Which HALF a save is running for. One flag across every row means either
  // all of them spin or, as shipped elsewhere once, none of them does — and
  // since 0221 a booking is two rows, so the booking's id alone would spin
  // both halves of one table for a press on one of them.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [paying, setPaying] = useState<Row | null>(null);

  // Closed on the answer landing, not on the click, or a refusal goes off the
  // screen with whatever was typed into it.
  useActionSuccess(state, () => setPaying(null));

  const send = (row: Row, fields: Record<string, string>) => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("bookingId", String(row.bookingId));
    data.set("side", row.side);
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    setPendingId(keyOf(row));
    startTransition(() => submit(data));
  };

  const counts = view.counts;
  // What is on this page, said as being on this page. A figure worked out from
  // twenty-five rows and labelled as the club's whole book is a number
  // somebody chases the wrong people with.
  const owed = view.rows
    .filter((row) => row.status === "booked" && row.paymentStatus === "unpaid")
    .reduce((sum, row) => sum + row.total, 0);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                          letterSpacing: "0.1em",
                          color: counts?.topay ? tokens.brass : tokens.inkMuted }}>
          {counts
            ? [
                // The month leads, because every figure beside it is about
                // that month and a count with no window on it is the figure
                // the client read as wrong on the analytics page.
                filters.month ? monthLabel(filters.month).toUpperCase() : null,
                // A row is one person's half of a table since 0221, not a
                // booking, so "55 BOOKED" would be counting something nobody
                // booked. Said as what the club is looking at: shares to
                // settle, of which some are still owed.
                `${counts.all} TO SETTLE`,
                counts.topay ? `${counts.topay} STILL TO PAY` : "NOTHING OUTSTANDING",
              ].filter(Boolean).join(" · ")
            : "THE COUNTS WOULD NOT LOAD"}
        </Typography>

        {owed > 0 ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {`${formatMoney(owed, "GBP")} to collect on this page`}
          </Typography>
        ) : null}
      </Stack>

      <UrlFilterBar
        query={filters.query}
        placeholder="Search by player, game or note"
        tab={filters.tab}
        tabs={TABLE_TABS.map((tab) => ({
          ...tab,
          // Zero rather than nothing when the read failed: the bar prints what
          // it is given, and `undefined` draws a blank where a number should be.
          count: counts ? counts[tab.value] : 0,
        }))}
        sort={filters.sort}
        sorts={TABLE_SORTS.map((sort) => ({ ...sort }))}
        // Only where the club has more than one month to tell apart. A picker
        // offering the one month that exists is a control that cannot narrow
        // anything, which is the rule the roster filters already follow.
        pickers={view.facets.months.length > 1 ? [{
          label: "Month", param: "month", value: filters.month,
          options: pickerOptions({
            any: "Every month", options: view.facets.months,
            picked: filters.month, label: monthLabel,
          }),
        }] : []}
        defaults={{ state: "all", sort: "newest", month: "" }}
        onBusy={setSifting}
      />

      <BusyOverlay busy={sifting} variant="dim" label="Filtering table bookings">
        <Stack spacing={1}>
          {view.failed ? (
            <Typography variant="body2" sx={{ color: tokens.danger, py: 2 }}>
              The list would not load. Reload the page and try again.
            </Typography>
          ) : view.rows.length === 0 ? (
            counts?.all === 0 ? (
              <EmptyState
                title="Nobody has booked a table yet"
                description="Every table anybody takes on any of your club nights turns up here, with what they owe you and what you recorded."
                action={{ label: "Your club nights", href: `/clubs/${slug}/bookings` }}
              />
            ) : (
              <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
                {filters.query
                  ? `Nobody matching "${filters.query}" in this group.`
                  : filters.month
                    ? `Nothing in this group in ${monthLabel(filters.month)}.`
                    : "Nothing in this group."}
              </Typography>
            )
          ) : null}

          {view.rows.map((row) => (
            <TableBookingRow key={keyOf(row)} row={row} faction={faction}
              busy={busy && pendingId === keyOf(row)}
              onPayment={() => setPaying(row)} />
          ))}
        </Stack>
      </BusyOverlay>

      <Pager page={filters.page} total={view.total} noun="shares"
        size={PER_PAGE.rows}
        href={{
          path: `/clubs/${slug}/manage/bookings`,
          params: {
            state: filters.tab === "all" ? undefined : filters.tab,
            q: filters.query || undefined,
            month: filters.month || undefined,
            sort: filters.sort === "newest" ? undefined : filters.sort,
          },
        }} />

      <TablePaymentDialog row={paying} saving={busy} onClose={() => setPaying(null)}
        onSave={(fields) => { if (paying) send(paying, fields); }} />
    </Stack>
  );
}

/**
 * A row's identity, which is no longer the booking's id.
 *
 * 0221 made this list one row per person per table, so the two halves of one
 * booking share an id and differ only by which seat they are.
 */
const keyOf = (row: Row) => `${row.bookingId}:${row.side}`;
