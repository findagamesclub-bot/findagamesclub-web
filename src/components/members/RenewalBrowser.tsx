"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/account/FilterBar";
import RenewalRow from "./RenewalRow";
import {
  countRenewals, filterRenewals,
  type RenewalBilling, type RenewalFilter, type RenewalRow as Row, type RenewalSort,
} from "@/utils/renewal-filter";
import { tokens, type Faction } from "@/lib/tokens";
import type { MembershipTier } from "@/types/clubDetail";
import { PER_PAGE } from "@/utils/paging";

const PAGE = PER_PAGE.cards;

/**
 * The club's memberships, searched and filtered.
 *
 * The same FilterBar as Memberships, Coaching, Merchandise and Your games, so a
 * club owner is not learning a fourth way to search a list. Filtering happens
 * in the browser because a club roster is tens of rows, not thousands, and the
 * whole set is already on the page for the counts.
 */
export default function RenewalBrowser({
  rows, slug, tiers, faction,
}: {
  rows: Row[];
  slug: string;
  tiers: MembershipTier[];
  faction: Faction;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RenewalFilter>("all");
  const [billing, setBilling] = useState<RenewalBilling>("any");
  const [sort, setSort] = useState<RenewalSort>("soonest");
  const [busy, startReorder] = useTransition();

  // Counted against the billing type in force, or a tab reads "Lapsed 3" over
  // an empty list.
  const counts = useMemo(() => countRenewals(rows, billing), [rows, billing]);
  const results = useMemo(
    () => filterRenewals(rows, { query, filter, billing, sort }),
    [rows, query, filter, billing, sort]);
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PAGE, top);
  const narrowed = Boolean(query) || filter !== "all" || billing !== "any";

  return (
    <Stack spacing={2}>
      <FilterBar
        query={query}
        onQuery={(value) => startReorder(() => setQuery(value))}
        placeholder="Search by name, tier, price or state"
        tabs={[
          { value: "all" as const, label: "Everyone", count: counts.all },
          { value: "due" as const, label: "Owing", count: counts.due },
          { value: "expiring" as const, label: "Due soon", count: counts.expiring },
          { value: "overdue" as const, label: "Lapsed", count: counts.overdue },
          { value: "paid" as const, label: "Paid up", count: counts.paid },
        ]}
        filter={filter}
        onFilter={(value) => startReorder(() => setFilter(value))}
        second={{
          label: "Billing",
          value: billing,
          onChange: (value) => startReorder(() => setBilling(value as RenewalBilling)),
          options: [
            { value: "any", label: "Any billing" },
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
            { value: "one-off", label: "One-off" },
            { value: "free", label: "Free tier" },
          ],
        }}
        sorts={[
          { value: "soonest" as const, label: "Needs chasing first" },
          { value: "name" as const, label: "Name" },
          { value: "joined" as const, label: "Newest member" },
        ]}
        sort={sort}
        onSort={(value) => startReorder(() => setSort(value))}
      />

      {/* The tabs above are views, not buckets, and they overlap on purpose:
          somebody due in ten days is still paid up. Saying so once beats a club
          wondering why the numbers do not add up to the total. */}
      {counts.due > 0 ? (
        <Typography variant="body2" sx={{ color: tokens.danger, fontWeight: 600 }}>
          {counts.due === 1
            ? "One membership is owing."
            : `${counts.due} memberships are owing.`}
          {counts.expiring > 0
            ? ` ${counts.expiring} more ${counts.expiring === 1 ? "is" : "are"} due within a month.`
            : ""}
        </Typography>
      ) : null}

      {results.length ? (
        <BusyOverlay busy={busy} variant="dim" label="Updating memberships">
          <Box ref={top} sx={{ display: "grid", gap: 2, alignItems: "start",
                     gridTemplateColumns: {
                       xs: "1fr",
                       sm: "repeat(2, minmax(0, 1fr))",
                       lg: "repeat(3, minmax(0, 1fr))",
                     } }}>
            {paged.shown.map((row) => (
              <RenewalRow key={row.member.membershipId} row={row}
                slug={slug} tiers={tiers} faction={faction} />
            ))}
          </Box>

          <Pager page={paged.page} total={paged.total} noun="memberships"
            size={PAGE} onChange={paged.goTo} />
        </BusyOverlay>
      ) : (
        <EmptyState
          title={narrowed ? "Nothing matches" : "No approved members yet"}
          description={narrowed
            // Billing is a dropdown that stays set while you change tabs, so
            // it is the one people forget they are still filtering by.
            ? "Clear the search, pick a different tab, or set Billing back to any."
            : "Memberships appear here once you have approved somebody."}
        />
      )}
    </Stack>
  );
}
