"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import BusyOverlay from "@/components/ui/BusyOverlay";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/account/FilterBar";
import ClubLogo from "@/components/clubs/ClubLogo";
import {
  countClubOrders, filterClubOrders,
  type ClubOrderFilter, type ClubOrderSort,
} from "@/utils/club-order-filter";
import { clubIdentity } from "@/utils/club-identity";
import { shortDate } from "@/utils/dates";
import { formatPence } from "@/utils/format";
import { orderTotalLabel } from "@/utils/order-total";
import { mono, tokens } from "@/lib/tokens";
import type { OwnerOrder } from "@/services/ownerBookings.service";
import { PER_PAGE } from "@/utils/paging";

const STATES: Record<string, { label: string; tone: string; wash: string }> = {
  placed: { label: "Placed", tone: "#5c4310", wash: tokens.brassSoft },
  paid: { label: "Paid", tone: tokens.brand, wash: tokens.brandSoft },
  fulfilled: { label: "Collected", tone: "#1B5E20", wash: "#E7F3E8" },
  cancelled: { label: "Cancelled", tone: tokens.inkMuted, wash: tokens.surface },
};

/**
 * Every merchandise order across every club, filtered by status.
 *
 * Answering an order still happens on the club's own shop page, where the
 * order log and the status control live. This is the view that says whether
 * anything is waiting anywhere, which four shop pages cannot.
 */
export default function OwnerOrders({ orders }: { orders: OwnerOrder[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClubOrderFilter>("all");
  const [sort, setSort] = useState<ClubOrderSort>("recent");
  const [busy, startReorder] = useTransition();

  const counts = useMemo(() => countClubOrders(orders), [orders]);
  const results = useMemo(
    () => filterClubOrders(orders, { query, filter, sort }) as OwnerOrder[],
    [orders, query, filter, sort]);
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, PER_PAGE.cards, top);

  return (
    <Stack spacing={2}>
      <FilterBar
        query={query}
        onQuery={(value) => startReorder(() => setQuery(value))}
        placeholder="Search by member, item or note"
        tabs={[
          { value: "all" as const, label: "All", count: counts.all },
          { value: "placed" as const, label: "Placed", count: counts.placed },
          { value: "paid" as const, label: "Paid", count: counts.paid },
          { value: "fulfilled" as const, label: "Collected", count: counts.fulfilled },
          { value: "cancelled" as const, label: "Cancelled", count: counts.cancelled },
        ]}
        filter={filter}
        onFilter={(value) => startReorder(() => setFilter(value))}
        sorts={[
          { value: "recent" as const, label: "Newest first" },
          { value: "value" as const, label: "Highest value" },
          { value: "name" as const, label: "Member name" },
        ]}
        sort={sort}
        onSort={(value) => startReorder(() => setSort(value))}
      />

      {results.length ? (
        <BusyOverlay busy={busy} variant="dim" label="Updating orders">
          <Box ref={top} sx={{ display: "grid", gap: 2, alignItems: "start",
                     gridTemplateColumns: {
                       xs: "1fr",
                       sm: "repeat(2, minmax(0, 1fr))",
                       lg: "repeat(3, minmax(0, 1fr))",
                     } }}>
            {paged.shown.map((order) => {
              const state = STATES[order.status] ?? STATES.placed;
              const { faction } = clubIdentity(order.club.slug, order.club.name);
              const pieces = order.lines.reduce((n, l) => n + l.quantity, 0);

              return (
                <Stack key={`${order.club.id}-${order.id}`}
                  sx={{ height: "100%", borderRadius: 2, overflow: "hidden",
                        backgroundColor: tokens.paper,
                        border: `1px solid ${
                          order.status === "placed" ? tokens.brass : tokens.rule}`,
                        transition: "border-color 140ms ease",
                        "&:hover": { borderColor: faction.base } }}>
                  <Stack spacing={0.75} sx={{ p: 2, flex: 1 }}>
                    <Stack direction="row" spacing={1.5}
                      sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
                      <Typography variant="subtitle2" noWrap>{order.personName}</Typography>
                      <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                                        color: state.tone, fontWeight: 700, flexShrink: 0 }}>
                        {state.label.toUpperCase()}
                      </Typography>
                    </Stack>

                    <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                      {order.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}
                    </Typography>

                    {order.notes ? (
                      <Typography variant="body2" noWrap
                        sx={{ color: tokens.inkMuted, fontStyle: "italic" }}>
                        {order.notes}
                      </Typography>
                    ) : null}
                  </Stack>

                  <Stack direction="row" spacing={1.5}
                    sx={{ px: 2, py: 1.25, alignItems: "center",
                          justifyContent: "space-between",
                          borderTop: `1px solid ${tokens.rule}`,
                          backgroundColor: state.wash }}>
                    <Stack direction="row" spacing={0.875}
                      sx={{ alignItems: "center", minWidth: 0 }}>
                      <ClubLogo slug={order.club.slug} name={order.club.name}
                        logoUrl={null} size={22} ring={tokens.rule} />
                      <Typography noWrap sx={{ fontFamily: mono, fontSize: "0.62rem",
                                               letterSpacing: "0.06em", color: tokens.inkMuted }}>
                        {`${order.club.name.toUpperCase()} · ${pieces} ITEM${pieces === 1 ? "" : "S"} · ${(shortDate(order.createdAt) ?? "").toUpperCase()}`}
                      </Typography>
                    </Stack>

                    <NextLink href={`/clubs/${order.club.slug}/shop`}
                      style={{ textDecoration: "none" }}>
                      <Typography sx={{ fontFamily: mono, fontSize: "0.86rem", fontWeight: 700,
                                        color: faction.deep, flexShrink: 0 }}>
                        {orderTotalLabel(order, formatPence)}
                      </Typography>
                    </NextLink>
                  </Stack>
                </Stack>
              );
            })}
          </Box>
          <Pager page={paged.page} total={paged.total} noun="orders" onChange={paged.goTo} />
        </BusyOverlay>
      ) : (
        <EmptyState
          title={orders.length ? "Nothing matches" : "No orders yet"}
          description={orders.length
            ? "Clear the search or pick a different tab."
            : "Orders members place at any of your clubs' shops appear here."}
        />
      )}
    </Stack>
  );
}
