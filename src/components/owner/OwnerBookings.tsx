"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import BusyOverlay from "@/components/ui/BusyOverlay";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/account/FilterBar";
import OwnerBookingCard from "./OwnerBookingCard";
import type { OwnerResult } from "@/services/ownerBookings.service";
import { PER_PAGE } from "@/utils/paging";

/**
 * Tables across every club, either side of today.
 *
 * Managing a night still happens on the club's own page, where the waiting
 * list and the free tables are, so each card links there rather than
 * duplicating those controls.
 *
 * Upcoming leads because the usual question is "what is happening on
 * Thursday". It is a tab rather than the whole page, which is the client's
 * item 7: the heading says "All table bookings", the list read forwards only,
 * and a club whose last night was on Saturday opened an empty page under it.
 * The club was not quiet — it had thirty-five tables behind it and no way to
 * see one.
 *
 * The club moved from the tab row to a picker in the same pass. Seven clubs
 * plus "All clubs" is eight tabs competing with the three that answer the
 * question this page is actually about.
 */
export default function OwnerBookings({
  bookings, today,
}: {
  bookings: OwnerResult[];
  /** London's today from the server, so the split is not the browser's. */
  today: string;
}) {
  const [query, setQuery] = useState("");
  const [club, setClub] = useState("all");
  const [when, setWhen] = useState<"upcoming" | "past" | "all">("upcoming");
  const [busy, startReorder] = useTransition();

  const ahead = useMemo(
    () => bookings.filter((b) => b.date >= today).length, [bookings, today]);
  const behind = bookings.length - ahead;

  const clubs = useMemo(() => {
    const seen = new Map<string, { slug: string; name: string; count: number }>();
    for (const b of bookings) {
      const held = seen.get(b.club.slug);
      seen.set(b.club.slug, { slug: b.club.slug, name: b.club.name, count: (held?.count ?? 0) + 1 });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [bookings]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return bookings.filter((b) => {
      if (when === "upcoming" && b.date < today) return false;
      if (when === "past" && b.date >= today) return false;
      if (club !== "all" && b.club.slug !== club) return false;
      if (!needle) return true;
      return [b.homeName, b.awayName, b.title, b.club.name]
        .join(" ").toLowerCase().includes(needle);
    });
  }, [bookings, query, club, when, today]);
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PER_PAGE.cards, top);

  return (
    <Stack spacing={2}>
      <FilterBar
        query={query}
        onQuery={(value) => startReorder(() => setQuery(value))}
        placeholder="Search by player, game or club"
        tabs={[
          { value: "upcoming" as const, label: "Upcoming", count: ahead },
          { value: "past" as const, label: "Past", count: behind },
          { value: "all" as const, label: "All", count: bookings.length },
        ]}
        filter={when}
        onFilter={(value) => startReorder(() => setWhen(value))}
        sorts={[{ value: "soonest", label: "Soonest first" }]}
        sort="soonest"
        onSort={() => undefined}
        pickers={clubs.length > 1 ? [{
          label: "Club",
          value: club,
          options: [{ value: "all", label: "All clubs" },
                    ...clubs.map((c) => ({ value: c.slug, label: c.name }))],
          onChange: (value) => startReorder(() => setClub(value)),
        }] : []}
      />

      {results.length ? (
        <BusyOverlay busy={busy} variant="dim" label="Updating bookings">
          <Box ref={top} sx={{ display: "grid", gap: 2, alignItems: "start",
                     gridTemplateColumns: {
                       xs: "minmax(0, 1fr)",
                       sm: "repeat(2, minmax(0, 1fr))",
                       lg: "repeat(3, minmax(0, 1fr))",
                     } }}>
            {paged.shown.map((row) => <OwnerBookingCard key={row.id} booking={row} />)}
          </Box>
          <Pager page={paged.page} total={paged.total} noun="tables" onChange={paged.goTo} />
        </BusyOverlay>
      ) : (
        /* The one case worth its own words. "Nothing matches" under an
           Upcoming tab, at a club with a season behind it, is what made this
           read as a broken page rather than a quiet week. */
        when === "upcoming" && behind > 0 && !query.trim() && club === "all" ? (
          <EmptyState
            title="Nothing booked yet"
            description={`No tables are booked at your clubs at the moment. ${
              behind === 1 ? "One has" : `${behind} have`} been played — open Past to see ${
              behind === 1 ? "it" : "them"}.`}
            onAction={{ label: "Show past tables", onClick: () => setWhen("past") }}
          />
        ) : (
          <EmptyState
            title="Nothing matches"
            description="Clear the search, or pick a different club or group."
          />
        )
      )}
    </Stack>
  );
}
