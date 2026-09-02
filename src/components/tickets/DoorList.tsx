"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/account/FilterBar";
import Pager from "@/components/ui/Pager";
import AttendeeRow from "./AttendeeRow";
import { usePagedList } from "@/hooks/usePagedList";
import { filterAttendees, typeCounts, type Attendee, type AttendeeSort }
  from "@/utils/attendee-filter";
import { formatMoney } from "@/utils/format";
import { tokens, type Faction } from "@/lib/tokens";
import { PER_PAGE } from "@/utils/paging";

/** A page of names, sized so a filtered list is still one glance. */
const PAGE = PER_PAGE.rows;

/**
 * The door list, built for the door.
 *
 * The job on the day is not reading a hundred names, it is finding the one
 * person standing in front of you, so search leads. The rest answers the two
 * other questions a club asks of this list: how many of a given ticket type are
 * coming, and did the booking I was just told about actually land.
 *
 * The same FilterBar as merchandise orders, memberships and coaching, so an
 * owner is not learning a fourth way to search a list.
 */
export default function DoorList({
  attendees, faction,
}: {
  attendees: Attendee[];
  faction: Faction;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState<AttendeeSort>("name");
  const [busy, startReorder] = useTransition();

  const types = useMemo(() => typeCounts(attendees), [attendees]);
  const results = useMemo(
    () => filterAttendees(attendees, { query, type, sort }), [attendees, query, type, sort]);

  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PAGE, top);

  // Figures for the whole event, not the filtered view: what the club is owed
  // does not change because somebody typed a name into a search box.
  const seats = attendees.reduce((n, a) => n + a.tickets, 0);
  const takings = attendees.reduce((n, a) => n + a.total, 0);
  const currency = attendees[0]?.currency ?? "GBP";

  if (!attendees.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Nobody has booked yet. Names appear here the moment they do.
      </Typography>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: "wrap", alignItems: "baseline" }}>
        <Figure value={String(attendees.length)}
          label={attendees.length === 1 ? "booking" : "bookings"} />
        <Figure value={String(seats)} label={seats === 1 ? "ticket" : "tickets"} />
        <Figure value={formatMoney(takings, currency)} label="to pay" tone={tokens.brass} />
      </Stack>

      {/* Only worth the space once the list is long enough to need it. */}
      {attendees.length >= 8 ? (
        <FilterBar
          query={query}
          onQuery={(value) => startReorder(() => setQuery(value))}
          placeholder="Find a name, email or reference"
          tabs={[
            { value: "all", label: "All", count: attendees.length },
            ...types.map((t) => ({ value: t.label, label: t.label, count: t.count })),
          ]}
          filter={type}
          onFilter={(value) => startReorder(() => setType(value))}
          sorts={[
            { value: "name" as const, label: "Name" },
            { value: "newest" as const, label: "Newest first" },
            { value: "value" as const, label: "Highest value" },
          ]}
          sort={sort}
          onSort={(value) => startReorder(() => setSort(value))}
        />
      ) : null}

      {results.length ? (
        <BusyOverlay busy={busy} variant="dim" label="Updating the door list">
          <Box ref={top} sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                               overflow: "hidden",
                               "& > *:not(:first-of-type)": { borderTop: `1px solid ${tokens.rule}` } }}>
            {paged.shown.map((a, i) => (
              <AttendeeRow key={a.id} attendee={a} faction={faction} striped={i % 2 === 1} />
            ))}
          </Box>

          <Pager page={paged.page} total={paged.total} noun="bookings"
            size={PAGE} onChange={paged.goTo} />
        </BusyOverlay>
      ) : (
        <EmptyState
          title="Nobody matches"
          description="Clear the search or pick a different ticket type."
        />
      )}
    </Stack>
  );
}

function Figure({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.3rem", fontWeight: 700,
                        lineHeight: 1, color: tone }}>
        {value}
      </Typography>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        {label.toUpperCase()}
      </Typography>
    </Stack>
  );
}
