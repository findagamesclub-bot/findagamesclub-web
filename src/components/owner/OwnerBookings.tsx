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
 * Upcoming tables across every club, grouped by night.
 *
 * Grouped rather than a flat list because the question is "what is happening on
 * Thursday", not "what is the 47th booking". Managing a night still happens on
 * the club's own page, where the waiting list and the free tables are, so each
 * night heading links there rather than duplicating those controls here.
 */
export default function OwnerBookings({ bookings }: { bookings: OwnerResult[] }) {
  const [query, setQuery] = useState("");
  const [club, setClub] = useState("all");
  const [busy, startReorder] = useTransition();

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
      if (club !== "all" && b.club.slug !== club) return false;
      if (!needle) return true;
      return [b.homeName, b.awayName, b.title, b.club.name]
        .join(" ").toLowerCase().includes(needle);
    });
  }, [bookings, query, club]);
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PER_PAGE.cards, top);

  return (
    <Stack spacing={2}>
      <FilterBar
        query={query}
        onQuery={(value) => startReorder(() => setQuery(value))}
        placeholder="Search by player, game or club"
        tabs={[
          { value: "all", label: "All clubs", count: bookings.length },
          ...clubs.map((c) => ({ value: c.slug, label: c.name, count: c.count })),
        ]}
        filter={club}
        onFilter={(value) => startReorder(() => setClub(value))}
        sorts={[{ value: "soonest", label: "Soonest first" }]}
        sort="soonest"
        onSort={() => undefined}
      />

      {results.length ? (
        <BusyOverlay busy={busy} variant="dim" label="Updating bookings">
          <Box ref={top} sx={{ display: "grid", gap: 2, alignItems: "start",
                     gridTemplateColumns: {
                       xs: "1fr",
                       sm: "repeat(2, minmax(0, 1fr))",
                       lg: "repeat(3, minmax(0, 1fr))",
                     } }}>
            {paged.shown.map((row) => <OwnerBookingCard key={row.id} booking={row} />)}
          </Box>
          <Pager page={paged.page} total={paged.total} noun="tables" onChange={paged.goTo} />
        </BusyOverlay>
      ) : (
        <EmptyState
          title="Nothing matches"
          description="Clear the search or pick a different club."
        />
      )}
    </Stack>
  );
}
