"use client";

import { startTransition, useActionState, useMemo, useRef, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/account/FilterBar";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { PER_PAGE } from "@/utils/paging";
import { useActionToast } from "@/components/ui/Toaster";
import { coachingAction, type CoachingState } from
  "@/app/clubs/[slug]/(console)/coaching/actions";
import { nightLabel } from "@/utils/dates";
import {
  countCoachingBookings, filterCoachingBookings,
  type BookingFilter, type BookingSort, type CoachingBookingRow,
} from "@/utils/coaching-bookings-filter";
import { display, mono, tokens } from "@/lib/tokens";
import type { CoachingSlot } from "@/types/clubExtras";

/**
 * Everybody booked on to anything, in one list.
 *
 * The same names are on the session cards, which is right when you are running
 * one session. It is the wrong shape for the other question a club asks, "who
 * still owes me", because that answer is spread across every card and the
 * cancelled ones have to be read as well.
 */
export default function CoachingBookings({
  slots, slug,
}: {
  slots: CoachingSlot[];
  slug: string;
}) {
  const [state, submit, busy] = useActionState<CoachingState, FormData>(coachingAction, {});
  useActionToast(state);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [sort, setSort] = useState<BookingSort>("soonest");
  const [session, setSession] = useState("");
  const [sifting, startSift] = useTransition();

  const rows: CoachingBookingRow[] = useMemo(() => slots.flatMap((slot) =>
    slot.attendees.map((person) => ({
      id: person.id, name: person.name, paid: person.paid, slotId: slot.id,
      title: slot.title, date: slot.date, time: slot.startTime,
      price: slot.price, cancelled: slot.status === "cancelled",
    }))), [slots]);

  // Narrowed to one session first, so every count below describes what is on
  // screen. Tabs reading 11 while showing one session's three is the sort of
  // number nobody can act on.
  const inSession = useMemo(
    () => (session ? rows.filter((row) => String(row.slotId) === session) : rows),
    [rows, session]);

  const counts = useMemo(() => countCoachingBookings(inSession), [inSession]);
  const results = useMemo(
    () => filterCoachingBookings(inSession, { query, filter, sort }),
    [inSession, query, filter, sort]);

  // Only sessions anybody has actually booked, with how many, because a club
  // picking a session wants to know that before it picks.
  const sessions = useMemo(() => slots
    .filter((slot) => slot.attendees.length)
    .map((slot) => ({
      value: String(slot.id),
      label: `${slot.title} (${slot.attendees.length})`,
    })), [slots]);

  // A session takes fifty places, and a club running one a week has a year of
  // them by next autumn. One line each, so the taller page size.
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PER_PAGE.rows, top);

  const setPaid = (bookingId: number, paid: boolean) => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("intent", "mark-paid");
    data.set("bookingId", String(bookingId));
    data.set("paid", String(paid));
    startTransition(() => submit(data));
  };

  if (!rows.length) {
    return (
      <EmptyState
        title="Nobody has booked yet"
        description="Bookings appear here as members take places, with what each of them owes you."
      />
    );
  }

  return (
    <Stack spacing={2} ref={top}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                        letterSpacing: "0.1em",
                        color: counts.unpaid ? tokens.brass : tokens.inkMuted }}>
        {counts.unpaid
          ? `${counts.all} BOOKED · ${counts.unpaid} STILL TO PAY`
          : `${counts.all} BOOKED · ALL PAID`}
      </Typography>

      {/* The same bar as the orders queue and the memberships list. A club with
          forty bookings should not scroll to find the one person in front of
          them asking. */}
      <FilterBar
        query={query}
        onQuery={(value) => startSift(() => setQuery(value))}
        placeholder="Search by member or session"
        tabs={[
          { value: "all" as const, label: "All", count: counts.all },
          { value: "unpaid" as const, label: "To pay", count: counts.unpaid },
          { value: "paid" as const, label: "Paid", count: counts.paid },
        ]}
        filter={filter}
        onFilter={(value) => startSift(() => setFilter(value))}
        sorts={[
          { value: "soonest" as const, label: "Soonest first" },
          { value: "latest" as const, label: "Latest first" },
        ]}
        sort={sort}
        onSort={(value) => startSift(() => setSort(value))}
        second={sessions.length > 1 ? {
          label: "Session",
          value: session,
          options: [{ value: "", label: "All sessions" }, ...sessions],
          onChange: (value) => startSift(() => setSession(value)),
        } : undefined}
      />

      <BusyOverlay busy={busy || sifting} variant="dim" label="Saving">
        <Stack spacing={1}>
          {results.length === 0 ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
              {query ? `Nobody matching "${query}".` : "Nothing in this group."}
            </Typography>
          ) : null}

          {paged.shown.map((row) => (
            <Box key={row.id}
              sx={{ display: "grid", gap: 1.5, alignItems: "center", p: 1.75,
                    borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
                    backgroundColor: tokens.paper,
                    gridTemplateColumns: {
                      xs: "minmax(0, 1fr) auto",
                      sm: "minmax(0, 1.1fr) minmax(0, 1.4fr) auto" } }}>
              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 700 }}
                  noWrap>
                  {row.name}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                                  letterSpacing: "0.08em", color: tokens.inkMuted }}>
                  {[nightLabel(row.date), row.time, row.cancelled ? "CALLED OFF" : ""]
                    .filter(Boolean).join(" · ").toUpperCase()}
                </Typography>
              </Stack>

              {/* The session, on its own line on a phone rather than squeezed
                  beside a name that is already truncating. */}
              <Typography variant="body2"
                sx={{ color: tokens.inkMuted, minWidth: 0,
                      gridColumn: { xs: "1 / -1", sm: "auto" } }}>
                {row.title}{row.price ? ` · ${row.price}` : ""}
              </Typography>

              <Button size="small" variant={row.paid ? "text" : "outlined"}
                disabled={busy}
                onClick={() => setPaid(row.id, !row.paid)}
                sx={{ justifySelf: "end", flexShrink: 0,
                      color: row.paid ? tokens.positive : undefined }}>
                {row.paid ? "Paid" : "Mark paid"}
              </Button>
            </Box>
          ))}
        </Stack>
      </BusyOverlay>

      <Pager page={paged.page} total={paged.total} noun="bookings"
        size={PER_PAGE.rows} onChange={paged.goTo} />
    </Stack>
  );
}
