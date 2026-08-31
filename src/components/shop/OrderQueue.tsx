"use client";

import { startTransition, useActionState, useMemo, useRef, useState, useTransition } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import FilterBar from "@/components/account/FilterBar";
import {
  countClubOrders, filterClubOrders,
  type ClubOrderFilter, type ClubOrderSort,
} from "@/utils/club-order-filter";
import Counter from "@/components/ui/Counter";
import { shopAction, type ShopState } from "@/app/clubs/[slug]/shop/actions";
import { formatMoney, initialsOf } from "@/utils/format";
import { needsQuote } from "@/utils/merch-bag";
import { orderTotalLabel } from "@/utils/order-total";
import { messageTime } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";
import type { MerchOrder } from "@/types/clubExtras";

const STATES: { value: MerchOrder["status"]; label: string; tone: string }[] = [
  { value: "placed", label: "Placed", tone: tokens.brass },
  { value: "paid", label: "Paid", tone: tokens.brand },
  { value: "fulfilled", label: "Fulfilled", tone: tokens.positive },
  { value: "cancelled", label: "Cancelled", tone: tokens.inkMuted },
];

/**
 * The orders waiting on the club.
 *
 * Status is a select rather than four buttons: there are four states and only
 * one is ever right, so a row of buttons would be three wrong answers sitting
 * next to the correct one.
 */
export default function OrderQueue({
  orders, slug, faction,
}: {
  orders: MerchOrder[];
  slug: string;
  faction: Faction;
}) {
  const [state, submit, busy] = useActionState<ShopState, FormData>(shopAction, {});
  useActionToast(state);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClubOrderFilter>("all");
  const [sort, setSort] = useState<ClubOrderSort>("recent");
  const [reordering, startReorder] = useTransition();

  const counts = useMemo(() => countClubOrders(orders), [orders]);
  const results = useMemo(
    () => filterClubOrders(orders, { query, filter, sort }), [orders, query, filter, sort]);
  const top = useRef<HTMLDivElement>(null);
  // Twelve, not the usual page: each order carries its own note log and status
  // control, so a page of them is far taller than a page of cards.
  const paged = usePagedList(results, 12, top);

  const setStatus = (orderId: number, status: string) => {
    const data = new FormData();
    data.set("intent", "set-status");
    data.set("slug", slug);
    data.set("orderId", String(orderId));
    data.set("status", status);
    startTransition(() => submit(data));
  };

  const addNote = (orderId: number) => {
    const body = (drafts[orderId] ?? "").trim();
    if (!body) return;

    const data = new FormData();
    data.set("intent", "note");
    data.set("slug", slug);
    data.set("orderId", String(orderId));
    data.set("body", body);
    startTransition(() => submit(data));
    setDrafts((d) => ({ ...d, [orderId]: "" }));
  };

  if (!orders.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        No orders yet. They appear here the moment a member places one.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      {/* The same FilterBar as everywhere else. A club with forty orders was
          scrolling to find the one somebody is standing in front of them
          asking about. */}
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

      {!results.length ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Nothing matches. Clear the search or pick a different tab.
        </Typography>
      ) : null}

      <BusyOverlay busy={busy || reordering} label="Saving">
      <Stack ref={top} spacing={2}>
      {paged.shown.map((order) => {
        const tone = STATES.find((s) => s.value === order.status)?.tone ?? tokens.inkMuted;
        return (
          <Box key={order.id}
            sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, p: 2,
                  backgroundColor: order.status === "cancelled" ? tokens.surface : tokens.paper,
                  opacity: order.status === "cancelled" ? 0.75 : 1 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", mb: 1.5 }}>
              <Counter kind="person" faction={faction} primary={initialsOf(order.personName)} />

              <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1">{order.personName}</Typography>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                  letterSpacing: "0.08em", color: tokens.inkMuted }}>
                  {messageTime(order.createdAt)}
                  {order.tierLabel ? ` · ${order.tierLabel.toUpperCase()}` : ""}
                </Typography>
              </Stack>

              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                                letterSpacing: "0.1em", fontWeight: 700, color: tone,
                                flexShrink: 0 }}>
                {order.status.toUpperCase()}
              </Typography>
            </Stack>

            <Stack spacing={0.5} sx={{ pl: { xs: 0, sm: 7 }, mb: 1.5 }}>
              {order.lines.map((line, i) => (
                <Stack key={i} direction="row" spacing={2}
                  sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
                  <Typography variant="body2">
                    <Box component="span" sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                                                color: faction.deep, mr: 0.75 }}>
                      {line.quantity}&times;
                    </Box>
                    {line.name}
                  </Typography>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                    {line.price ?? "—"}
                  </Typography>
                </Stack>
              ))}

              {order.notes ? (
                <Typography variant="body2" sx={{ color: tokens.inkMuted, pt: 0.5 }}>
                  &ldquo;{order.notes}&rdquo;
                </Typography>
              ) : null}

              {/* The money as it stood when they ordered, so a later reprice
                  cannot rewrite what the club quoted. */}
              <Stack spacing={0.25} sx={{ pt: 0.75 }}>
                {order.discountAmount > 0 ? (
                  <Typography variant="body2" sx={{ color: tokens.positive }}>
                    {order.discountPercent}% {order.tierLabel ?? "member"} discount
                    &mdash; {formatMoney(order.discountAmount)} off
                  </Typography>
                ) : null}
                {order.pointsSpent > 0 ? (
                  <Typography variant="body2" sx={{ color: tokens.positive }}>
                    {order.pointsSpent} points used &mdash; {formatMoney(order.pointsValue)} off
                  </Typography>
                ) : null}
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem",
                                  fontWeight: 700 }}>
                  {orderTotalLabel(order, formatMoney)}
                  {order.lines.every((l) => needsQuote(l.price)) ? "" : " total"}
                </Typography>
              </Stack>
            </Stack>

            <Stack spacing={1.5} sx={{ pl: { xs: 0, sm: 7 } }}>
              <TextField select size="small" label="Status" value={order.status}
                disabled={busy || order.status === "cancelled"}
                onChange={(e) => setStatus(order.id, e.target.value)}
                sx={{ minWidth: 150, alignSelf: "flex-start" }}>
                {STATES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </TextField>

              {/* A log, not a field. Notes are added; nothing overwrites the
                  last one, and a status change writes its own line. */}
              {order.log.length ? (
                <Stack spacing={0.75}
                  sx={{ pl: 1.5, borderLeft: `2px solid ${tokens.rule}` }}>
                  {order.log.map((note) => (
                    <Stack key={note.id} spacing={0.15}>
                      <Typography variant="body2"
                        sx={{ color: note.automatic ? tokens.inkMuted : tokens.ink,
                              fontStyle: note.automatic ? "italic" : "normal" }}>
                        {note.body}
                      </Typography>
                      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem",
                                        letterSpacing: "0.06em", color: tokens.inkMuted }}>
                        {note.author.toUpperCase()} · {messageTime(note.at)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : null}

              <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                <TextField size="small" label="Add a note" fullWidth multiline maxRows={4}
                  value={drafts[order.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [order.id]: e.target.value }))}
                  slotProps={{ htmlInput: { maxLength: 2000 } }} />
                <Button size="small" variant="outlined" sx={{ flexShrink: 0, mt: 0.25 }}
                  disabled={busy || !(drafts[order.id] ?? "").trim()}
                  onClick={() => addNote(order.id)}>
                  Add
                </Button>
              </Stack>
            </Stack>
          </Box>
        );
      })}
      </Stack>

      <Pager page={paged.page} total={paged.total} noun="orders" size={12}
        onChange={paged.goTo} />
      </BusyOverlay>
    </Stack>
  );
}
