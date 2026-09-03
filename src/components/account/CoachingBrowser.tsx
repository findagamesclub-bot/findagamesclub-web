"use client";

import { useDeferredValue, useMemo, useRef, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import FilterBar from "./FilterBar";
import CoachingCard from "./CoachingCard";
import {
  countUnpaid, countUpcoming, filterCoaching,
  type CoachingFilter, type CoachingSort,
} from "@/utils/coaching-filter";
import { tokens } from "@/lib/tokens";
import type { MyCoaching } from "@/services/myActivity.service";
import { PER_PAGE } from "@/utils/paging";

const PAGE = PER_PAGE.cards;

/** Search, filter and sort over the member's coaching, then a grid. */
export default function CoachingBrowser({ sessions }: { sessions: MyCoaching[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CoachingFilter>("all");
  const [sort, setSort] = useState<CoachingSort>("soonest");

  const settled = useDeferredValue(query);
  const [reordering, startReorder] = useTransition();
  const busy = reordering || settled !== query;

  const counts = useMemo(() => ({
    all: sessions.length,
    upcoming: countUpcoming(sessions),
    unpaid: countUnpaid(sessions),
    past: sessions.filter((s) => s.past || s.cancelled).length,
  }), [sessions]);

  const results = useMemo(
    () => filterCoaching(sessions, { query: settled, filter, sort }),
    [sessions, settled, filter, sort],
  );
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PAGE, top);

  return (
    <Stack spacing={2.5}>
      <FilterBar
        query={query}
        onQuery={(value) => setQuery(value)}
        placeholder="Search by session, club or kind"
        tabs={[
          { value: "all" as const, label: "All", count: counts.all },
          { value: "upcoming" as const, label: "Coming up", count: counts.upcoming },
          { value: "unpaid" as const, label: "To pay", count: counts.unpaid },
          { value: "past" as const, label: "Past", count: counts.past },
        ]}
        filter={filter}
        onFilter={(value) => startReorder(() => setFilter(value))}
        sorts={[
          { value: "soonest" as const, label: "Soonest first" },
          { value: "recent" as const, label: "Most recent" },
          { value: "club" as const, label: "Club name" },
        ]}
        sort={sort}
        onSort={(value) => startReorder(() => setSort(value))}
      />

      {counts.unpaid && filter !== "unpaid" ? (
        <Stack direction="row" spacing={1.5}
          sx={{ px: 2, py: 1.25, borderRadius: 2, alignItems: "center",
                backgroundColor: tokens.brassSoft }}>
          <Typography variant="body2" sx={{ color: "#5c4310", flex: 1 }}>
            {counts.unpaid === 1
              ? "One session still to pay for. The club takes payment on the day."
              : `${counts.unpaid} sessions still to pay for. Clubs take payment on the day.`}
          </Typography>
          <Button size="small" variant="text" sx={{ color: "#5c4310", flexShrink: 0 }}
            onClick={() => startReorder(() => setFilter("unpaid"))}>
            Show them
          </Button>
        </Stack>
      ) : null}

      {results.length ? (
        <BusyOverlay busy={busy} variant="dim" label="Updating coaching">
          <Box ref={top} sx={{ display: "grid", gap: 2.5, alignItems: "start",
                     gridTemplateColumns: {
                       xs: "minmax(0, 1fr)",
                       md: "repeat(2, minmax(0, 1fr))",
                       xl: "repeat(3, minmax(0, 1fr))",
                     } }}>
            {paged.shown.map((session) => (
              <CoachingCard key={session.id} session={session} />
            ))}
          </Box>


          <Pager page={paged.page} total={paged.total} noun="sessions"
            size={PAGE} onChange={paged.goTo} />
        </BusyOverlay>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 3 }}>
          {query ? `No session matching "${query}".` : "Nothing in this group."}
        </Typography>
      )}
    </Stack>
  );
}
