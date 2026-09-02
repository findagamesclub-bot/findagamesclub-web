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
import OrderCard from "./OrderCard";
import {
  countWaiting, filterOrders, type OrderFilter, type OrderSort,
} from "@/utils/order-filter";
import { mono, tokens } from "@/lib/tokens";
import type { MyOrder } from "@/services/myActivity.service";
import { PER_PAGE } from "@/utils/paging";

const PAGE = PER_PAGE.cards;

/** Search, filter and sort over the member's kit orders, then a grid. */
export default function OrderBrowser({ orders }: { orders: MyOrder[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [sort, setSort] = useState<OrderSort>("recent");

  const settled = useDeferredValue(query);
  const [reordering, startReorder] = useTransition();
  const busy = reordering || settled !== query;

  const counts = useMemo(() => ({
    all: orders.length,
    waiting: countWaiting(orders),
    collected: orders.filter((o) => o.status === "fulfilled").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  }), [orders]);

  const results = useMemo(
    () => filterOrders(orders, { query: settled, filter, sort }),
    [orders, settled, filter, sort],
  );
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PAGE, top);

  const spent = useMemo(
    () => results
      .filter((order) => order.status !== "cancelled")
      .reduce((total, order) => total + order.total, 0),
    [results],
  );

  return (
    <Stack spacing={2.5}>
      <FilterBar
        query={query}
        onQuery={(value) => setQuery(value)}
        placeholder="Search by club or item"
        tabs={[
          { value: "all" as const, label: "All", count: counts.all },
          { value: "waiting" as const, label: "To collect", count: counts.waiting },
          { value: "collected" as const, label: "Collected", count: counts.collected },
          { value: "cancelled" as const, label: "Cancelled", count: counts.cancelled },
        ]}
        filter={filter}
        onFilter={(value) => startReorder(() => setFilter(value))}
        sorts={[
          { value: "recent" as const, label: "Most recent" },
          { value: "value" as const, label: "Highest value" },
          { value: "club" as const, label: "Club name" },
        ]}
        sort={sort}
        onSort={(value) => startReorder(() => setSort(value))}
      />

      {counts.waiting && filter !== "waiting" ? (
        <Stack direction="row" spacing={1.5}
          sx={{ px: 2, py: 1.25, borderRadius: 2, alignItems: "center",
                backgroundColor: tokens.brassSoft }}>
          <Typography variant="body2" sx={{ color: "#5c4310", flex: 1 }}>
            {counts.waiting === 1
              ? "One order is waiting with the club to collect."
              : `${counts.waiting} orders are waiting with the club to collect.`}
          </Typography>
          <Button size="small" variant="text" sx={{ color: "#5c4310", flexShrink: 0 }}
            onClick={() => startReorder(() => setFilter("waiting"))}>
            Show them
          </Button>
        </Stack>
      ) : null}

      {results.length ? (
        <BusyOverlay busy={busy} variant="dim" label="Updating orders">
          <Box ref={top} sx={{ display: "grid", gap: 2.5, alignItems: "start",
                     gridTemplateColumns: {
                       xs: "1fr",
                       md: "repeat(2, minmax(0, 1fr))",
                       xl: "repeat(3, minmax(0, 1fr))",
                     } }}>
            {paged.shown.map((order) => <OrderCard key={order.id} order={order} />)}
          </Box>

          <Pager page={paged.page} total={paged.total} noun="orders" size={PAGE}
            onChange={paged.goTo} />

          {/* What the filtered set cost, which the page count does not say. */}
          <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted,
                            textAlign: "center", pt: 0.5 }}>
            {`£${spent.toFixed(2).replace(/\.00$/, "")} SPENT`}
          </Typography>
        </BusyOverlay>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 3 }}>
          {query ? `Nothing matching "${query}".` : "Nothing in this group."}
        </Typography>
      )}
    </Stack>
  );
}
