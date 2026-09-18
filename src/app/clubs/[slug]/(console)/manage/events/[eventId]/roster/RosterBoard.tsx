"use client";

import { startTransition, useActionState, useMemo, useRef, useState, useTransition }
  from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/account/FilterBar";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { PER_PAGE } from "@/utils/paging";
import { useActionToast } from "@/components/ui/Toaster";
import RosterRow from "./RosterRow";
import PaymentDialog from "./PaymentDialog";
import CancelPlaceDialog from "./CancelPlaceDialog";
import EditBookingDialog from "./EditBookingDialog";
import { rosterAction, type RosterState } from "./actions";
import {
  countDoorRows, filterDoorRows, owed,
  type DoorRow, type DoorSort, type DoorTab,
} from "@/utils/door-list";
import { formatMoney } from "@/utils/format";
import { mono, tokens, type Faction } from "@/lib/tokens";

/**
 * The list a club works from on the day.
 *
 * Same bar as every other list in the console, because a club that has met the
 * orders queue has met this. The one thing on top is what is still owed, which
 * is the number somebody at the door actually needs.
 */
export default function RosterBoard({
  slug, eventId, rows, faction,
}: {
  slug: string;
  eventId: number;
  rows: DoorRow[];
  faction: Faction;
}) {
  const [state, submit, busy] = useActionState<RosterState, FormData>(rosterAction, {});
  useActionToast(state);

  const [tab, setTab] = useState<DoorTab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<DoorSort>("name");
  const [sifting, startSift] = useTransition();

  // Which booking a save is running for. Without it every row's button spins
  // at once, which says "everything is happening" rather than "this one is".
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [paying, setPaying] = useState<DoorRow | null>(null);
  const [cancelling, setCancelling] = useState<DoorRow | null>(null);
  const [editing, setEditing] = useState<DoorRow | null>(null);

  const counts = useMemo(() => countDoorRows(rows), [rows]);
  const results = useMemo(
    () => filterDoorRows(rows, { tab, query, sort }), [rows, tab, query, sort]);
  const due = useMemo(() => owed(rows), [rows]);

  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PER_PAGE.rows, top);

  const send = (bookingId: number, fields: Record<string, string>) => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("eventId", String(eventId));
    data.set("bookingId", String(bookingId));
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    setPendingId(bookingId);
    startTransition(() => submit(data));
  };

  if (!rows.length) {
    return (
      <EmptyState
        title="Nobody has booked yet"
        description="People appear here as they take places, with what each of them owes you and whether they have turned up."
      />
    );
  }

  return (
    <Stack spacing={2} ref={top}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                          letterSpacing: "0.1em",
                          color: due.people ? tokens.brass : tokens.inkMuted }}>
          {due.people
            ? `${counts.all} BOOKED · ${due.people} STILL TO PAY · ${formatMoney(due.amount, "GBP")}`
            : `${counts.all} BOOKED · ALL PAID`}
        </Typography>

        <Button component="a" href={`/clubs/${slug}/manage/events/${eventId}/roster/export`}
          size="small" variant="outlined" startIcon={<DownloadIcon />}
          sx={{ alignSelf: { xs: "stretch", sm: "auto" } }}>
          Export the door list
        </Button>
      </Stack>

      <FilterBar
        query={query}
        onQuery={(value) => startSift(() => setQuery(value))}
        placeholder="Search by name, email or reference"
        tabs={[
          { value: "all" as const, label: "All", count: counts.all },
          { value: "reserved" as const, label: "To pay", count: counts.reserved },
          { value: "paid" as const, label: "Paid", count: counts.paid },
          { value: "checkedin" as const, label: "Checked in", count: counts.checkedin },
          { value: "cancelled" as const, label: "Cancelled", count: counts.cancelled },
        ]}
        filter={tab}
        onFilter={(value) => startSift(() => setTab(value))}
        sorts={[
          { value: "name" as const, label: "By name" },
          { value: "newest" as const, label: "Newest first" },
          { value: "value" as const, label: "Biggest first" },
        ]}
        sort={sort}
        onSort={(value) => startSift(() => setSort(value))}
      />

      <BusyOverlay busy={busy || sifting} variant="dim" label="Saving">
        <Stack spacing={1}>
          {results.length === 0 ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
              {query ? `Nobody matching "${query}".` : "Nothing in this group."}
            </Typography>
          ) : null}

          {paged.shown.map((row) => (
            <RosterRow key={row.bookingId} row={row} faction={faction}
              busy={busy && pendingId === row.bookingId}
              onCheckIn={(arrived) => send(row.bookingId, {
                intent: "check-in", arrived: arrived ? "yes" : "no",
              })}
              onPayment={() => setPaying(row)}
              onCancel={() => setCancelling(row)}
              onEdit={() => setEditing(row)}
              onRefund={(status) => send(row.bookingId,
                { intent: "refund", refundStatus: status })}
            />
          ))}
        </Stack>
      </BusyOverlay>

      <Pager page={paged.page} total={paged.total} noun="bookings"
        size={PER_PAGE.rows} onChange={paged.goTo} />

      <PaymentDialog row={paying} saving={busy} onClose={() => setPaying(null)}
        onSave={(fields) => {
          if (!paying) return;
          setPaying(null);
          send(paying.bookingId,
            { intent: "payment", total: String(paying.total), ...fields });
        }} />

      <CancelPlaceDialog row={cancelling} saving={busy} onClose={() => setCancelling(null)}
        onConfirm={(reason) => {
          if (!cancelling) return;
          setCancelling(null);
          send(cancelling.bookingId, { intent: "cancel", reason });
        }} />

      <EditBookingDialog row={editing} saving={busy} onClose={() => setEditing(null)}
        onSave={(fields) => {
          if (!editing) return;
          setEditing(null);
          send(editing.bookingId, { intent: "edit", ...fields });
        }} />
    </Stack>
  );
}
