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
import MembershipCard from "./MembershipCard";
import UpgradeRequest from "./UpgradeRequest";
import {
  countNeedingAttention, filterMemberships,
  type MembershipFilter, type MembershipSort,
} from "@/utils/membership-filter";
import { tokens } from "@/lib/tokens";
import type { MyClubMembership } from "@/services/myMemberships.service";
import { PER_PAGE } from "@/utils/paging";

/** Cards drawn before the list stops and offers more. */
const PAGE = PER_PAGE.cards;

/**
 * Search, filter and sort over the member's clubs, then a grid.
 *
 * Built for a list that grows: filtering happens over the whole set, the grid
 * draws a page at a time so a long list cannot bury the page in DOM, and
 * "Needs you" exists because with more than a screenful the one question
 * somebody actually has is "is anything wrong".
 */
export default function MembershipBrowser({
  memberships,
}: {
  memberships: MyClubMembership[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MembershipFilter>("all");
  const [sort, setSort] = useState<MembershipSort>("recent");

  // The field stays instant while the grid catches up. On four clubs that is
  // the same frame and nothing shows; on a long list it is the difference
  // between a responsive box and a page that stutters as you type.
  const settled = useDeferredValue(query);
  const [reordering, startReorder] = useTransition();
  const busy = reordering || settled !== query;

  const counts = useMemo(() => ({
    all: memberships.length,
    approved: memberships.filter((m) => m.status === "approved").length,
    pending: memberships.filter((m) => m.status === "pending").length,
    past: memberships.filter((m) => m.status === "declined" || m.status === "cancelled").length,
    attention: countNeedingAttention(memberships),
  }), [memberships]);

  const results = useMemo(
    () => filterMemberships(memberships, { query: settled, filter, sort }),
    [memberships, settled, filter, sort],
  );

  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PAGE, top);

  const change = (next: Partial<{ query: string; filter: MembershipFilter; sort: MembershipSort }>) => {
    // Any change to what is being looked at starts the page count again, so
    // "Show more" never carries over from a previous filter.
    if (next.query !== undefined) setQuery(next.query);
    // Changing group or order rebuilds the whole grid, so it goes through a
    // transition and the results show that they are catching up.
    if (next.filter !== undefined) startReorder(() => setFilter(next.filter!));
    if (next.sort !== undefined) startReorder(() => setSort(next.sort!));
  };

  return (
    <Stack spacing={2.5}>
      <FilterBar
        query={query}
        onQuery={(value) => change({ query: value })}
        placeholder="Search by club, town or tier"
        tabs={[
          { value: "all" as const, label: "All", count: counts.all },
          { value: "approved" as const, label: "Member", count: counts.approved },
          { value: "pending" as const, label: "Waiting", count: counts.pending },
          { value: "past" as const, label: "Past", count: counts.past },
        ]}
        filter={filter}
        onFilter={(value) => change({ filter: value })}
        sorts={[
          { value: "recent" as const, label: "Most recent" },
          { value: "name" as const, label: "Club name" },
          { value: "attention" as const, label: "Needs you first" },
        ]}
        sort={sort}
        onSort={(value) => change({ sort: value })}
      />

      {counts.attention && filter === "all" && sort !== "attention" ? (
        <Stack direction="row" spacing={1.5}
          sx={{ px: 2, py: 1.25, borderRadius: 2, alignItems: "center",
                backgroundColor: tokens.brassSoft }}>
          <Typography variant="body2" sx={{ color: "#5c4310", flex: 1 }}>
            {counts.attention === 1
              ? "One membership needs something from you."
              : `${counts.attention} memberships need something from you.`}
          </Typography>
          <Button size="small" variant="text" sx={{ color: "#5c4310", flexShrink: 0 }}
            onClick={() => change({ sort: "attention" })}>
            Show those first
          </Button>
        </Stack>
      ) : null}

      {results.length ? (
        <BusyOverlay busy={busy} variant="dim" label="Updating memberships">
          <Box ref={top} sx={{ display: "grid", gap: 2.5, alignItems: "start",
                     gridTemplateColumns: {
                       xs: "minmax(0, 1fr)",
                       md: "repeat(2, minmax(0, 1fr))",
                       xl: "repeat(3, minmax(0, 1fr))",
                     } }}>
            {paged.shown.map((membership) => (
              <MembershipCard
                key={membership.membershipId}
                membership={membership}
                action={membership.status === "approved"
                  ? <UpgradeRequest membership={membership} />
                  : undefined}
              />
            ))}
          </Box>


          <Pager page={paged.page} total={paged.total} noun="memberships"
            size={PAGE} onChange={paged.goTo} />
        </BusyOverlay>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 3 }}>
          {query
            ? `No club matching "${query}".`
            : "Nothing in this group."}
        </Typography>
      )}
    </Stack>
  );
}
