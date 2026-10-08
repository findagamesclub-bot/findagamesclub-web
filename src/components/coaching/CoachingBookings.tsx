"use client";

import { startTransition, useActionState, useMemo, useRef, useState, useTransition } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/account/FilterBar";
import Pager from "@/components/ui/Pager";
import BookingRow from "./BookingRow";
import { usePagedList } from "@/hooks/usePagedList";
import { PER_PAGE } from "@/utils/paging";
import { useActionToast } from "@/components/ui/Toaster";
import { coachingAction, type CoachingState } from
  "@/app/clubs/[slug]/(console)/coaching/actions";
import {
  countCoachingBookings, filterCoachingBookings,
  type BookingFilter, type BookingSort, type CoachingBookingRow,
} from "@/utils/coaching-bookings-filter";
import { mono, tokens } from "@/lib/tokens";

/**
 * Everybody booked on to anything, in one list.
 *
 * The same names are on the session cards, which is right when you are running
 * one session. It is the wrong shape for the other question a club asks, "who
 * still owes me and who am I out of pocket to", because that answer is spread
 * across every card and **the cancelled ones are not on the cards at all**.
 *
 * So the rows come from `club_coaching_bookings_list` (0158) rather than being
 * folded out of the slots, which is how the event roster already works. That
 * is also what makes "filter like event bookings" possible: you cannot filter
 * to Cancelled a list that never contained them.
 */
export default function CoachingBookings({
  rows, slug,
}: {
  rows: CoachingBookingRow[];
  slug: string;
}) {
  const [state, submit, busy] = useActionState<CoachingState, FormData>(coachingAction, {});
  useActionToast(state);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [sort, setSort] = useState<BookingSort>("soonest");
  const [session, setSession] = useState("");
  const [sifting, startSift] = useTransition();

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
  const sessions = useMemo(() => {
    const seen = new Map<number, { title: string; n: number }>();
    for (const row of rows) {
      const held = seen.get(row.slotId);
      seen.set(row.slotId, { title: row.title, n: (held?.n ?? 0) + 1 });
    }
    return [...seen].map(([id, one]) => ({
      value: String(id), label: `${one.title} (${one.n})`,
    }));
  }, [rows]);

  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PER_PAGE.rows, top);

  const send = (fields: Record<string, string>) => {
    const data = new FormData();
    data.set("slug", slug);
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
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
                        color: counts.unpaid || counts.refund
                          ? tokens.brass : tokens.inkMuted }}>
        {[
          `${counts.all} BOOKED`,
          counts.unpaid ? `${counts.unpaid} STILL TO PAY` : "",
          // The one figure that means money out rather than money in, so it is
          // said up here rather than only being a tab somebody might not press.
          counts.refund ? `${counts.refund} REFUND${counts.refund === 1 ? "" : "S"} TO SETTLE` : "",
        ].filter(Boolean).join(" · ")}
        {!counts.unpaid && !counts.refund ? " · ALL SETTLED" : ""}
      </Typography>

      {/* The same bar as the orders queue and the memberships list, and the
          same groups the event roster uses minus the one that cannot apply:
          there is no checking in to a coaching session. */}
      <FilterBar
        query={query}
        onQuery={(value) => startSift(() => setQuery(value))}
        placeholder="Search by member, session or reason"
        tabs={[
          { value: "all" as const, label: "All", count: counts.all },
          { value: "unpaid" as const, label: "To pay", count: counts.unpaid },
          { value: "paid" as const, label: "Paid", count: counts.paid },
          { value: "refund" as const, label: "Refund due", count: counts.refund },
          { value: "cancelled" as const, label: "Cancelled", count: counts.cancelled },
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
            <BookingRow
              key={row.id}
              row={row}
              busy={busy}
              onPaid={(bookingId, paid) =>
                send({ intent: "mark-paid", bookingId: String(bookingId), paid: String(paid) })}
              onCancel={(bookingId, reason) =>
                send({ intent: "club-cancel", bookingId: String(bookingId), reason })}
              onRefund={(bookingId, refund) =>
                send({ intent: "set-refund", bookingId: String(bookingId), refund })}
            />
          ))}
        </Stack>
      </BusyOverlay>

      <Pager page={paged.page} total={paged.total} noun="bookings"
        size={PER_PAGE.rows} onChange={paged.goTo} />
    </Stack>
  );
}
